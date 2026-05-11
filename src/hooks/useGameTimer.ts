import { useCallback, useEffect, useRef, useState } from "react"
import type { GameStatus, LevelConfig } from "@/game/types"

// ─── Public timing constants ──────────────────────────────────────────────────
// Exported so Game.tsx and tests can reference the same values rather than
// embedding raw numbers in multiple places.

/** How long (ms) to wait after a loss before showing the overlay. */
export const LOSS_OVERLAY_DELAY_MS = 1_800

/** How long (ms) the board-shake animation runs after a hit. */
export const SHAKE_DURATION_MS = 400

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Starting value — only used for the initial `useState`. Reset by calling
   *  the returned `setSeconds` directly (e.g. when starting a new level). */
  initialSeconds: number
  /** Live ref to the current config — read inside the interval to pick up
   *  countdown mode changes without re-binding the interval. */
  configRef: React.MutableRefObject<LevelConfig>
  /** Current game status — drives the pause-on-menu and overlay-delay effects. */
  status: GameStatus
  /** Whether the menu is open — the timer pauses while the menu is shown. */
  menuOpen: boolean
  /** Called (once) when the countdown hits zero. The caller is responsible for
   *  setting status → "lost" and triggering any shake/vibration effects. */
  onCountdownExpired: () => void
}

interface Result {
  seconds: number
  setSeconds: React.Dispatch<React.SetStateAction<number>>
  startTimer: () => void
  stopTimer: () => void
  /** True once the 1.8s post-loss delay has elapsed — gates the loss overlay. */
  lostOverlayReady: boolean
}

export function useGameTimer({
  initialSeconds,
  configRef,
  status,
  menuOpen,
  onCountdownExpired,
}: Props): Result {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [lostOverlayReady, setLostOverlayReady] = useState(false)
  const timerRef = useRef<number | null>(null)
  // Live ref pattern: the interval closure always calls the current callback
  // without needing to be re-bound whenever the callback identity changes.
  const onExpiredRef = useRef(onCountdownExpired)
  onExpiredRef.current = onCountdownExpired

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (timerRef.current != null) return // already running
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const cfg = configRef.current
        if (cfg.countdown != null) {
          const next = s - 1
          if (next <= 0) {
            // Stop the interval before notifying so the caller doesn't race
            // with another tick when it calls setStatus("lost").
            stopTimer()
            onExpiredRef.current()
            return 0
          }
          return next
        }
        // Count-up mode.
        return s + 1
      })
    }, 1_000)
  }, [configRef, stopTimer])

  // Clean up on unmount.
  useEffect(() => () => stopTimer(), [stopTimer])

  // Pause while the menu is open; resume when the round is actively playing.
  useEffect(() => {
    if (menuOpen) stopTimer()
    else if (status === "playing") startTimer()
  }, [menuOpen, status, startTimer, stopTimer])

  // Delay the loss overlay so the player can see the revealed mines first.
  // Reset immediately whenever the round leaves the "lost" state.
  useEffect(() => {
    if (status !== "lost") {
      setLostOverlayReady(false)
      return
    }
    const t = window.setTimeout(() => setLostOverlayReady(true), LOSS_OVERLAY_DELAY_MS)
    return () => clearTimeout(t)
  }, [status])

  return { seconds, setSeconds, startTimer, stopTimer, lostOverlayReady }
}
