import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  NEIGHBORS,
  checkWin,
  configForLevel,
  countFlags,
  inBounds,
  makeEmptyBoard,
  placeBonusTiles,
  placeItems,
  placeMines,
  revealAllMines,
  revealCascade,
  revealSingle,
  toggleFlag,
} from "@/game/engine"
import { ITEM_MAX, ITEMS, type ItemType } from "@/game/items"
import { paletteFor } from "@/game/palette"
import {
  ACTIVE_ROUND_KEY,
  buildSnapshot,
  configFromSaved,
  readActiveRound,
  readPersistedLevel,
} from "@/game/round-storage"
import type { Board as BoardT, LevelConfig, ModifierId } from "@/game/types"
import { useGameTimer, SHAKE_DURATION_MS } from "@/hooks/useGameTimer"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useTheme } from "@/hooks/useTheme"
import { multiTouchRef } from "@/lib/touch-state"
import { Board } from "./Board"
import { ItemsBar } from "./ItemsBar"
import { MenuSheet } from "./MenuSheet"
import { Overlay } from "./Overlay"
import { PlayBar } from "./PlayBar"
import { ReadyOverlay } from "./ReadyOverlay"
import { SwapDialog } from "./SwapDialog"

// ─── Timing constants ─────────────────────────────────────────────────────────

/** How long a toast notification stays visible (ms). */
const TOAST_DURATION_MS = 1_800
/** How long the +Ns float text is visible after a bonus tile (ms). */
const FLOAT_LIFETIME_MS = 900
/** How long Mine Scan highlights mines (ms). */
const SCAN_DURATION_MS = 2_000

// ─── Gradient colours per modifier ───────────────────────────────────────────
// Applied as --gradient-a/b on :root so the animated background blobs in
// App.tsx pick up the active modifier's colour scheme automatically.
const MODIFIER_GRADIENTS: Record<ModifierId, [string, string]> = {
  calm:   ["oklch(0.78 0.18 220)", "oklch(0.75 0.15 180)"], // blue / cyan
  fog:    ["oklch(0.65 0.08 260)", "oklch(0.65 0.06 300)"], // slate / lavender
  bonus:  ["oklch(0.82 0.16 80)",  "oklch(0.78 0.18 40)"],  // gold / amber
  twin:   ["oklch(0.72 0.21 15)",  "oklch(0.75 0.15 340)"], // red / magenta
  quick:  ["oklch(0.80 0.18 145)", "oklch(0.75 0.15 170)"], // green / teal
  dense:  ["oklch(0.72 0.21 35)",  "oklch(0.75 0.18 60)"],  // orange / gold
  big:    ["oklch(0.72 0.18 285)", "oklch(0.75 0.15 310)"], // violet / purple
  sniper: ["oklch(0.76 0.16 195)", "oklch(0.73 0.13 220)"], // teal / blue
}

// ─── Float text ───────────────────────────────────────────────────────────────
interface FloatText {
  id: number
  text: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Game() {
  // Try to restore an in-flight round first. Falls back to "fresh round at
  // the persisted current level" if nothing is saved or the save is stale.
  const savedRound = readActiveRound()
  const initialLevel = readPersistedLevel()
  const [config, setConfig] = useState<LevelConfig>(() =>
    savedRound
      ? configFromSaved(savedRound)
      : configForLevel(initialLevel, initialLevel === 1 ? { force: "calm" } : undefined),
  )
  const [board, setBoard] = useState<BoardT>(() =>
    savedRound ? savedRound.board : makeEmptyBoard(config.rows, config.cols),
  )
  const [status, setStatus] = useState(savedRound?.status ?? "ready" as const)
  const [exploded, setExploded] = useState<[number, number] | null>(savedRound?.exploded ?? null)
  const [shake, setShake] = useState(false)
  const [floats, setFloats] = useState<FloatText[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [introDismissed, setIntroDismissed] = useState(savedRound?.status === "playing")
  const [lossReason, setLossReason] = useState<"mine" | "time" | null>(
    savedRound?.lossReason ?? null,
  )
  const [itemToast, setItemToast] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [pendingItem, setPendingItem] = useState<ItemType | null>(null)

  const floatId = useRef(0)
  // Live ref so timer / event-handler closures always read the current config
  // without needing to be re-bound on every render.
  const configRef = useRef(config)
  configRef.current = config

  // ── Persisted cross-round state ──────────────────────────────────────────
  const [bestLevel, setBestLevel] = useLocalStorage<number>("ms.bestLevel", 0)
  const [streak, setStreak] = useLocalStorage<number>("ms.streak", 0)
  const [totalWins, setTotalWins] = useLocalStorage<number>("ms.totalWins", 0)
  const [flagMode, setFlagMode] = useLocalStorage<boolean>("ms.flagMode", false)
  const [, setCurrentLevel] = useLocalStorage<number>("ms.currentLevel", initialLevel)
  const [unlockedModifiers, setUnlockedModifiers] = useLocalStorage<ModifierId[]>(
    "ms.unlockedModifiers", [],
  )
  const [bestTimes, setBestTimes] = useLocalStorage<Partial<Record<ModifierId, number>>>(
    "ms.bestTimes", {},
  )
  const [items, setItems] = useLocalStorage<ItemType[]>("ms.items", [])
  const [itemLocks, setItemLocks] = useLocalStorage<boolean[]>("ms.itemLocks", [])
  const [discoveredItems, setDiscoveredItems] = useLocalStorage<ItemType[]>(
    "ms.discoveredItems", [],
  )
  // Snapshot taken when "Start" is clicked — used to restore inventory on Retry.
  const [roundStartItems, setRoundStartItems] = useLocalStorage<ItemType[]>(
    "ms.roundStartItems", [],
  )
  const [roundStartItemLocks, setRoundStartItemLocks] = useLocalStorage<boolean[]>(
    "ms.roundStartItemLocks", [],
  )

  // ── Timer ────────────────────────────────────────────────────────────────
  const handleCountdownExpired = useCallback(() => {
    setShake(true)
    setStatus("lost")
    setLossReason("time")
    window.setTimeout(() => setShake(false), SHAKE_DURATION_MS)
  }, [])

  const { seconds, setSeconds, startTimer, stopTimer, lostOverlayReady } = useGameTimer({
    initialSeconds: savedRound?.seconds ?? config.countdown ?? 0,
    configRef,
    status,
    menuOpen,
    onCountdownExpired: handleCountdownExpired,
  })

  // ── Side effects ─────────────────────────────────────────────────────────

  // Track total active touches globally so cells skip long-press during pinch.
  useEffect(() => {
    const update = (e: TouchEvent) => { multiTouchRef.current = e.touches.length }
    window.addEventListener("touchstart", update, { passive: true })
    window.addEventListener("touchend",   update, { passive: true })
    window.addEventListener("touchcancel", update, { passive: true })
    return () => {
      window.removeEventListener("touchstart", update)
      window.removeEventListener("touchend",   update)
      window.removeEventListener("touchcancel", update)
    }
  }, [])

  // Sync modifier gradient colours to CSS variables for the animated blobs.
  useEffect(() => {
    const [a, b] = MODIFIER_GRADIENTS[config.modifier.id]
    document.documentElement.style.setProperty("--gradient-a", a)
    document.documentElement.style.setProperty("--gradient-b", b)
  }, [config.modifier.id])

  // Persist a full round snapshot on every meaningful state change so a reload
  // or app-close drops the player back exactly where they were.
  useEffect(() => {
    try {
      localStorage.setItem(
        ACTIVE_ROUND_KEY,
        JSON.stringify(buildSnapshot(config, board, status, seconds, exploded, lossReason)),
      )
    } catch {
      // Quota exceeded or storage disabled — degrade silently.
    }
  }, [config, board, status, seconds, exploded, lossReason])

  // ── Derived state ────────────────────────────────────────────────────────
  const palette = useMemo(() => paletteFor(config.paletteSeed), [config.paletteSeed])
  // Allow negative counts so the UI can warn the player they've over-flagged.
  const minesLeft = config.mines - countFlags(board)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pushFloat = useCallback((text: string) => {
    const id = ++floatId.current
    setFloats((f) => [...f, { id, text }])
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_LIFETIME_MS)
  }, []) // setFloats is stable; floatId is a ref

  const pushItemToast = useCallback((text: string) => {
    setItemToast(text)
    window.setTimeout(() => setItemToast(null), TOAST_DURATION_MS)
  }, [])

  // ── Win bookkeeping ──────────────────────────────────────────────────────
  // Declared before commitReveal so it can be listed in commitReveal's deps.
  const recordWin = useCallback(
    (finalSeconds: number) => {
      setStatus("won")
      stopTimer()
      const id = config.modifier.id
      const timeUsed = config.countdown != null ? config.countdown - finalSeconds : finalSeconds
      setBestLevel((b) => Math.max(b, config.level))
      setStreak((s) => s + 1)
      setTotalWins((w) => w + 1)
      setUnlockedModifiers((prev) => (prev.includes(id) ? prev : [...prev, id]))
      setBestTimes((prev) => {
        const prevBest = prev[id]
        return prevBest == null || timeUsed < prevBest ? { ...prev, [id]: timeUsed } : prev
      })
    },
    [
      config.level,
      config.modifier.id,
      config.countdown,
      stopTimer,
      setBestLevel,
      setStreak,
      setTotalWins,
      setUnlockedModifiers,
      setBestTimes,
    ],
  )

  // ── Shared helpers ───────────────────────────────────────────────────────

  /** Splice the Extra Life out of inventory and fire haptics + toast. */
  const consumeExtraLife = useCallback(
    (lifeIdx: number) => {
      setItems((prev) => { const n = [...prev]; n.splice(lifeIdx, 1); return n })
      setItemLocks((prev) => { const n = [...prev]; n.splice(lifeIdx, 1); return n })
      pushItemToast("Extra Life used")
      if ("vibrate" in navigator) navigator.vibrate(20)
    },
    [setItems, setItemLocks, pushItemToast],
  )

  /**
   * Finalise a reveal: count any bonus tiles in `revealed`, adjust the timer,
   * commit the board, and check for a win.  Used by handleReveal, handleChord,
   * and handleUseItem so the bonus-and-win block isn't duplicated three times.
   */
  const commitReveal = useCallback(
    (nextBoard: BoardT, revealed: [number, number][]) => {
      let bonusGained = 0
      for (const [rr, cc] of revealed) {
        if (nextBoard[rr][cc].bonus) bonusGained += config.bonusValue
      }
      if (bonusGained > 0) {
        if (config.countdown != null) setSeconds((s) => s + bonusGained)
        else setSeconds((s) => Math.max(0, s - bonusGained))
        pushFloat(`+${bonusGained}s`)
      }
      setBoard(nextBoard)
      if (checkWin(nextBoard)) {
        const finalSeconds =
          config.countdown != null
            ? seconds + bonusGained
            : Math.max(0, seconds - bonusGained)
        recordWin(finalSeconds)
      }
    },
    [config.bonusValue, config.countdown, seconds, setSeconds, pushFloat, recordWin],
  )

  // ── Level management ─────────────────────────────────────────────────────
  const startLevel = useCallback(
    (nextLevel: number, opts?: { force?: LevelConfig["modifier"]["id"] }) => {
      const cfg = configForLevel(nextLevel, opts)
      setConfig(cfg)
      setBoard(makeEmptyBoard(cfg.rows, cfg.cols))
      setStatus("ready")
      setSeconds(cfg.countdown ?? 0)
      setExploded(null)
      setShake(false)
      setLossReason(null)
      setIntroDismissed(false)
      setCurrentLevel(nextLevel)
      stopTimer()
    },
    [stopTimer, setCurrentLevel, setSeconds],
  )

  // ── Event handlers ───────────────────────────────────────────────────────

  const handleReveal = useCallback(
    (r: number, c: number) => {
      if (status === "won" || status === "lost") return

      let working = board
      if (status === "ready") {
        working = placeMines(working, config.mines, r, c, config.modifier.id)
        if (config.bonusTiles > 0) working = placeBonusTiles(working, config.bonusTiles)
        working = placeItems(working, config.level, r, c)
        setStatus("playing")
        startTimer()
      }

      const cell = working[r][c]
      if (cell.state === "flagged") return

      if (cell.mine) {
        // Extra Life: defuse the mine instead of losing.
        const lifeIdx = items.findIndex(
          (item, idx) => item === "life" && !(itemLocks[idx] ?? false),
        )
        if (lifeIdx !== -1) {
          const defused = working.map((row) => row.map((c) => ({ ...c })))
          defused[r][c] = { ...defused[r][c], mine: false, state: "flagged" }
          setBoard(defused)
          consumeExtraLife(lifeIdx)
          return
        }
        const revealed = revealAllMines(working)
        revealed[r][c] = { ...revealed[r][c], state: "revealed" }
        setBoard(revealed)
        setExploded([r, c])
        setShake(true)
        setStatus("lost")
        setLossReason("mine")
        stopTimer()
        setStreak(0)
        window.setTimeout(() => setShake(false), SHAKE_DURATION_MS)
        return
      }

      const { board: nextBoard, revealed } =
        config.modifier.id === "sniper"
          ? revealSingle(working, r, c)
          : revealCascade(working, r, c)
      commitReveal(nextBoard, revealed)
    },
    [
      board, config, status, items, itemLocks,
      startTimer, stopTimer, setStreak,
      consumeExtraLife, commitReveal,
    ],
  )

  const handleFlag = useCallback(
    (r: number, c: number) => {
      if (status === "won" || status === "lost") return
      setBoard((b) => toggleFlag(b, r, c))
    },
    [status],
  )

  // Chord: tap a revealed number whose surrounding flag count equals the number
  // to reveal all remaining hidden neighbours in one shot.
  const handleChord = useCallback(
    (r: number, c: number) => {
      if (status !== "playing") return
      const cell = board[r][c]
      if (cell.state !== "revealed" || cell.adjacent === 0) return

      let flagged = 0
      const hidden: [number, number][] = []
      for (const [dr, dc] of NEIGHBORS) {
        const nr = r + dr
        const nc = c + dc
        if (!inBounds(board, nr, nc)) continue
        const n = board[nr][nc]
        if (n.state === "flagged") flagged++
        else if (n.state === "hidden") hidden.push([nr, nc])
      }
      if (flagged !== cell.adjacent || hidden.length === 0) return

      const lifeIdx = items.findIndex(
        (item, idx) => item === "life" && !(itemLocks[idx] ?? false),
      )
      let working = board
      const allRevealed: [number, number][] = []
      let hitMine: [number, number] | null = null
      let lifeUsed = false

      for (const [nr, nc] of hidden) {
        if (working[nr][nc].state !== "hidden") continue
        if (working[nr][nc].mine) {
          if (lifeIdx !== -1 && !lifeUsed) {
            lifeUsed = true
            const defused = working.map((row) => row.map((c2) => ({ ...c2 })))
            defused[nr][nc] = { ...defused[nr][nc], mine: false, state: "flagged" }
            working = defused
            continue
          }
          hitMine = [nr, nc]
          break
        }
        const step = revealCascade(working, nr, nc)
        working = step.board
        allRevealed.push(...step.revealed)
      }

      if (lifeUsed) consumeExtraLife(lifeIdx)

      if (hitMine) {
        const final = revealAllMines(working)
        final[hitMine[0]][hitMine[1]] = { ...final[hitMine[0]][hitMine[1]], state: "revealed" }
        setBoard(final)
        setExploded(hitMine)
        setShake(true)
        setStatus("lost")
        setLossReason("mine")
        stopTimer()
        setStreak(0)
        window.setTimeout(() => setShake(false), SHAKE_DURATION_MS)
        return
      }

      commitReveal(working, allRevealed)
    },
    [
      board, status, items, itemLocks,
      stopTimer, setStreak,
      consumeExtraLife, commitReveal,
    ],
  )

  // Collect an item badge from a revealed cell.
  const handleCollect = useCallback(
    (r: number, c: number) => {
      if (status !== "playing") return
      const cell = board[r][c]
      if (!cell.item || cell.state !== "revealed") return
      const dropped = cell.item
      const next = board.map((row) => row.map((c) => ({ ...c })))
      next[r][c].item = null
      setBoard(next)
      if (items.length < ITEM_MAX) {
        pushItemToast(`+ ${ITEMS[dropped].name}`)
        setItems((prev) => [...prev, dropped])
        setItemLocks((prev) => [...prev, true])
      } else {
        setPendingItem(dropped)
      }
      setDiscoveredItems((prev) => (prev.includes(dropped) ? prev : [...prev, dropped]))
      if ("vibrate" in navigator) navigator.vibrate(8)
    },
    [board, status, items, setItems, setItemLocks, setDiscoveredItems, pushItemToast],
  )

  // Manually consume an item from inventory by slot index.
  const handleUseItem = useCallback(
    (slot: number) => {
      const type = items[slot]
      if (!type || status !== "playing") return
      if (type === "life") return // auto-fires on mine hit; not manually usable

      if (type === "scan") {
        setScanning(true)
        window.setTimeout(() => setScanning(false), SCAN_DURATION_MS)
        if ("vibrate" in navigator) navigator.vibrate(10)
      } else if (type === "pick") {
        const candidates: [number, number][] = []
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[0].length; c++) {
            const cell = board[r][c]
            if (cell.state === "hidden" && !cell.mine) candidates.push([r, c])
          }
        }
        if (candidates.length === 0) return
        const [pr, pc] = candidates[Math.floor(Math.random() * candidates.length)]
        const { board: nextBoard, revealed } =
          config.modifier.id === "sniper"
            ? revealSingle(board, pr, pc)
            : revealCascade(board, pr, pc)
        commitReveal(nextBoard, revealed)
      }

      setItems((prev) => { const n = [...prev]; n.splice(slot, 1); return n })
      setItemLocks((prev) => { const n = [...prev]; n.splice(slot, 1); return n })
    },
    [items, status, board, config.modifier.id, setItems, setItemLocks, commitReveal],
  )

  // ── Navigation actions ───────────────────────────────────────────────────
  const restartCurrent = () => {
    setMenuOpen(false)
    setItems([...roundStartItems])
    setItemLocks([...roundStartItemLocks])
    startLevel(config.level, { force: config.modifier.id })
  }
  const nextLevel = () => startLevel(config.level + 1)
  const newRun = () => {
    setMenuOpen(false)
    setStreak(0)
    setItems([])
    setItemLocks([])
    setRoundStartItems([])
    setRoundStartItemLocks([])
    setPendingItem(null)
    startLevel(1, { force: "calm" })
  }

  const { theme, toggle: toggleTheme } = useTheme()

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="safe-area relative flex h-full w-full flex-col gap-2 overflow-hidden sm:gap-3">
      <PlayBar
        config={config}
        palette={palette}
        minesLeft={minesLeft}
        seconds={seconds}
        flagMode={flagMode}
        onToggleFlagMode={() => setFlagMode((v) => !v)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {/* Always rendered so the row reserves space even when inventory is empty. */}
      <ItemsBar
        items={items}
        itemLocks={itemLocks}
        canUse={status === "playing"}
        onUse={handleUseItem}
      />

      <div className="relative min-h-0 flex-1">
        <Board
          board={board}
          modifierId={config.modifier.id}
          exploded={exploded}
          shake={shake}
          scanning={scanning}
          // First tap must always reveal so mines can be placed around it.
          flagMode={status === "ready" ? false : flagMode}
          onReveal={handleReveal}
          onFlag={handleFlag}
          onChord={handleChord}
          onCollect={handleCollect}
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          {floats.map((f) => (
            <span
              key={f.id}
              className="float-up font-mono text-base font-semibold text-[var(--color-flag)]"
            >
              {f.text}
            </span>
          ))}
        </div>

        {itemToast && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span
              role="status"
              className="float-up rounded-full bg-[var(--color-surface)]/90 px-3 py-1 font-mono text-xs font-semibold text-[var(--color-accent)] shadow-lg backdrop-blur"
            >
              {itemToast}
            </span>
          </div>
        )}
      </div>

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        config={config}
        palette={palette}
        bestLevel={bestLevel}
        minesLeft={minesLeft}
        seconds={seconds}
        streak={streak}
        totalWins={totalWins}
        theme={theme}
        unlockedModifiers={unlockedModifiers}
        bestTimes={bestTimes}
        discoveredItems={discoveredItems}
        onToggleTheme={toggleTheme}
        onRestart={restartCurrent}
        onNewRun={newRun}
      />

      <ReadyOverlay
        visible={status === "ready" && !introDismissed}
        config={config}
        palette={palette}
        items={items}
        itemLocks={itemLocks}
        onStart={() => {
          const unlockedLocks = items.map(() => false)
          setItemLocks(unlockedLocks)
          setRoundStartItems([...items])
          setRoundStartItemLocks(unlockedLocks)
          setIntroDismissed(true)
        }}
      />

      <Overlay
        status={status}
        visible={status === "won" || (status === "lost" && lostOverlayReady)}
        config={config}
        palette={palette}
        seconds={seconds}
        bestLevel={bestLevel}
        lossReason={lossReason}
        onNext={nextLevel}
        onRetry={restartCurrent}
        onNewRun={newRun}
      />

      <SwapDialog
        pending={pendingItem}
        inventory={items}
        onReplace={(slot) => {
          if (pendingItem == null) return
          setItems((prev) => {
            const next = [...prev]
            next[slot] = pendingItem
            return next
          })
          setItemLocks((prev) => {
            const next = [...prev]
            next[slot] = true
            return next
          })
          setDiscoveredItems((prev) =>
            prev.includes(pendingItem) ? prev : [...prev, pendingItem],
          )
          pushItemToast(`+ ${ITEMS[pendingItem].name}`)
          setPendingItem(null)
        }}
        onSkip={() => setPendingItem(null)}
      />
    </div>
  )
}
