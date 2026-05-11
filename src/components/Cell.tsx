import { memo, useEffect, useRef } from "react"
import { Bomb, Flag, Sparkles } from "lucide-react"
import type { Cell as CellT } from "@/game/types"
import { cn } from "@/lib/utils"

const NUMBER_CLASSES: Record<number, string> = {
  1: "text-[oklch(0.85_0.14_220)] [[data-theme=light]_&]:text-[oklch(0.5_0.18_240)]",
  2: "text-[oklch(0.82_0.16_150)] [[data-theme=light]_&]:text-[oklch(0.45_0.18_150)]",
  3: "text-[oklch(0.78_0.18_30)] [[data-theme=light]_&]:text-[oklch(0.55_0.22_25)]",
  4: "text-[oklch(0.78_0.16_280)] [[data-theme=light]_&]:text-[oklch(0.45_0.2_290)]",
  5: "text-[oklch(0.78_0.18_60)] [[data-theme=light]_&]:text-[oklch(0.55_0.18_50)]",
  6: "text-[oklch(0.78_0.16_180)] [[data-theme=light]_&]:text-[oklch(0.5_0.16_200)]",
  7: "text-[oklch(0.78_0.16_320)] [[data-theme=light]_&]:text-[oklch(0.5_0.2_320)]",
  8: "text-[oklch(0.85_0.04_280)] [[data-theme=light]_&]:text-[oklch(0.4_0.04_280)]",
}

interface Props {
  cell: CellT
  row: number
  col: number
  size: number
  fogged: boolean
  exploded: boolean
  flagMode: boolean
  onReveal: (r: number, c: number) => void
  onFlag: (r: number, c: number) => void
  onChord: (r: number, c: number) => void
}

const LONG_PRESS_MS = 280
// Finger contact points jitter during a long hold — sometimes 30+ px between
// samples. Generous threshold so a steady press isn't canceled by drift.
const MOVE_TOLERANCE_PX = 48

function CellInner({
  cell,
  row,
  col,
  size,
  fogged,
  exploded,
  flagMode,
  onReveal,
  onFlag,
  onChord,
}: Props) {
  const isRevealed = cell.state === "revealed"
  const isFlagged = cell.state === "flagged"
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  // Timestamp of the most recent touchend on this cell. We use it to ignore
  // any synthetic click event the browser emits despite our preventDefault.
  // Android Chrome in particular sometimes still fires click after a long
  // touch — that leaked click was triggering reveals on cells the user had
  // just flagged/unflagged.
  const lastTouchEndAt = useRef(0)

  // Live ref into the latest props/state. The native touch listener below is
  // attached once and reads from this ref every fire — that way it always
  // sees the current `flagMode`, `cell`, etc. without needing to be
  // re-bound on every render.
  const live = useRef({ isRevealed, cell, flagMode, onReveal, onFlag, onChord, row, col })
  live.current = { isRevealed, cell, flagMode, onReveal, onFlag, onChord, row, col }

  // Touch handling has to coexist with browser-native panning:
  //   - touchstart: start the long-press timer, but DON'T preventDefault.
  //     Letting the browser see the gesture lets it start a scroll if the
  //     player drags.
  //   - touchmove past threshold: cancel the timer — this is a pan, not a tap.
  //   - touchend: if the timer fired (long-press), call onFlag and suppress
  //     the synthetic click that follows. Otherwise let the browser emit a
  //     normal click event, which `handleClick` below converts to a reveal /
  //     chord. The browser automatically swallows clicks after a scroll, so
  //     pans never trigger a tap.
  useEffect(() => {
    const el = buttonRef.current
    if (!el) return

    let timer: number | null = null
    let longPressFired = false
    let startX = 0
    let startY = 0
    const clearTimer = () => {
      if (timer != null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      longPressFired = false
      clearTimer()
      timer = window.setTimeout(() => {
        longPressFired = true
        if (!live.current.isRevealed) {
          live.current.onFlag(live.current.row, live.current.col)
          if ("vibrate" in navigator) navigator.vibrate(15)
        }
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) clearTimer()
    }

    const onTouchEnd = (e: TouchEvent) => {
      clearTimer()
      if (longPressFired) {
        // Stop the synthetic click from toggling the flag back off.
        e.preventDefault()
        lastTouchEndAt.current = Date.now()
      }
    }

    const onTouchCancel = () => {
      clearTimer()
      longPressFired = false
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: true })
    el.addEventListener("touchend", onTouchEnd, { passive: false })
    el.addEventListener("touchcancel", onTouchCancel, { passive: true })
    return () => {
      clearTimer()
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchCancel)
    }
  }, [])

  // Mouse / keyboard path: regular click handler. Touch *shouldn't* reach
  // this because touchstart called preventDefault — but Android Chrome
  // occasionally fires the synthetic click anyway. Drop any click that
  // arrives within 600ms of a touchend on this cell.
  const handleClick = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchEndAt.current < 600) return
    if (e.shiftKey || e.altKey) {
      onFlag(row, col)
      return
    }
    if (isRevealed) {
      if (cell.adjacent > 0) onChord(row, col)
      return
    }
    if (flagMode) onFlag(row, col)
    else onReveal(row, col)
  }

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isRevealed) onFlag(row, col)
  }

  const showNumber = isRevealed && !cell.mine && cell.adjacent > 0 && !fogged

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onContextMenu={handleContext}
      draggable={false}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.45)),
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      className={cn(
        "relative flex select-none items-center justify-center rounded-md font-mono font-semibold transition-all duration-150 touch-manipulation",
        !isRevealed &&
          "bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-border)] hover:border-[var(--color-accent)]/60",
        isRevealed &&
          !cell.mine &&
          "bg-[var(--color-surface)]/60 border border-[var(--color-border)]/40 cell-reveal",
        isRevealed &&
          cell.mine &&
          (exploded
            ? "bg-[var(--color-danger)]/30 border border-[var(--color-danger)]/60"
            : "bg-[var(--color-surface)]/40 border border-[var(--color-border)]/40"),
        isFlagged && "bg-[var(--color-surface-2)] border border-[var(--color-flag)]/60",
      )}
      aria-label={`Cell ${row + 1},${col + 1}`}
    >
      {!isRevealed && cell.bonus && !isFlagged && (
        <span className="absolute inset-0 rounded-md opacity-30 [background:radial-gradient(circle_at_center,var(--color-flag),transparent_70%)] pointer-events-none" />
      )}

      {isFlagged && (
        <Flag className="cell-pop h-4 w-4 text-[var(--color-flag)]" strokeWidth={2.5} />
      )}

      {isRevealed && cell.mine && (
        <Bomb
          className={cn(
            "cell-pop h-4 w-4",
            exploded ? "text-[var(--color-danger)]" : "text-[var(--color-fg-soft)]",
          )}
          strokeWidth={2.5}
        />
      )}

      {isRevealed && cell.bonus && !cell.mine && (
        <Sparkles className="cell-pop h-4 w-4 text-[var(--color-flag)]" strokeWidth={2.5} />
      )}

      {showNumber && (
        <span className={cn("cell-pop", NUMBER_CLASSES[cell.adjacent])}>{cell.adjacent}</span>
      )}
    </button>
  )
}

export const Cell = memo(CellInner)
