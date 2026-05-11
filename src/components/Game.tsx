import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bomb, Flag, RotateCcw, ChevronRight, Sparkles } from "lucide-react"
import {
  checkWin,
  configForLevel,
  countFlags,
  makeEmptyBoard,
  placeBonusTiles,
  placeMines,
  revealAllMines,
  revealCascade,
  revealSingle,
  toggleFlag,
} from "@/game/engine"
import { MODIFIERS } from "@/game/modifiers"
import type { Board as BoardT, GameStatus, LevelConfig, ModifierId } from "@/game/types"
import { paletteFor } from "@/game/palette"
import { Board } from "./Board"
import { PlayBar } from "./PlayBar"
import { MenuSheet } from "./MenuSheet"
import { Button } from "./ui/button"
import { Card, CardContent, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { useTheme } from "@/hooks/useTheme"
import { cn } from "@/lib/utils"

interface FloatText {
  id: number
  text: string
}

// Full snapshot of the round in progress, saved to localStorage so a refresh
// (or app close) drops the player back exactly where they were — same board,
// same modifier, same revealed cells, same timer value.
interface ActiveRound {
  level: number
  rows: number
  cols: number
  mines: number
  bonusTiles: number
  modifierId: ModifierId
  paletteSeed: number
  board: BoardT
  status: GameStatus
  seconds: number
  exploded: [number, number] | null
  // Persisted countdown values so a refresh resumes the same time budget.
  countdown?: number | null
  bonusValue?: number
  lossReason?: "mine" | "time" | null
}

const ACTIVE_ROUND_KEY = "ms.activeRound"

function readActiveRound(): ActiveRound | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_ROUND_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Defensive validation: a corrupt or stale snapshot shouldn't crash the app.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.level !== "number" ||
      !Array.isArray(parsed.board) ||
      !MODIFIERS[parsed.modifierId as ModifierId]
    )
      return null
    return parsed as ActiveRound
  } catch {
    return null
  }
}

function readPersistedLevel(): number {
  if (typeof window === "undefined") return 1
  try {
    const raw = window.localStorage.getItem("ms.currentLevel")
    if (!raw) return 1
    const n = JSON.parse(raw)
    return typeof n === "number" && n >= 1 ? n : 1
  } catch {
    return 1
  }
}

function configFromSaved(saved: ActiveRound): LevelConfig {
  return {
    level: saved.level,
    rows: saved.rows,
    cols: saved.cols,
    mines: saved.mines,
    bonusTiles: saved.bonusTiles,
    modifier: MODIFIERS[saved.modifierId],
    paletteSeed: saved.paletteSeed,
    countdown: saved.countdown ?? null,
    bonusValue: saved.bonusValue ?? 5,
  }
}

export function Game() {
  // Try to restore an in-flight round first. Falls back to "fresh round at
  // the persisted current level" if nothing was saved.
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
  const [status, setStatus] = useState<GameStatus>(savedRound?.status ?? "ready")
  // For countdown modes the timer counts DOWN from config.countdown, so the
  // initial value before any tick should be the full budget.
  const [seconds, setSeconds] = useState(
    savedRound?.seconds ?? config.countdown ?? 0,
  )
  const [exploded, setExploded] = useState<[number, number] | null>(savedRound?.exploded ?? null)
  const [shake, setShake] = useState(false)
  const [floats, setFloats] = useState<FloatText[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  // Whether the "Ready" intro is currently shown. Re-set on each new level so
  // the player always sees the mode declaration before they start.
  const [introDismissed, setIntroDismissed] = useState(savedRound?.status === "playing")
  // Why the player lost — drives the lost-overlay copy.
  const [lossReason, setLossReason] = useState<"mine" | "time" | null>(
    savedRound?.lossReason ?? null,
  )
  const floatId = useRef(0)
  const timerRef = useRef<number | null>(null)
  // Live ref so the interval body (set once) reads the current config.
  const configRef = useRef(config)
  configRef.current = config

  const [bestLevel, setBestLevel] = useLocalStorage<number>("ms.bestLevel", 0)
  const [streak, setStreak] = useLocalStorage<number>("ms.streak", 0)
  const [totalWins, setTotalWins] = useLocalStorage<number>("ms.totalWins", 0)
  const [flagMode, setFlagMode] = useLocalStorage<boolean>("ms.flagMode", false)
  const [, setCurrentLevel] = useLocalStorage<number>("ms.currentLevel", initialLevel)
  // Modifier IDs the player has won at least once with — drives the
  // achievement grid in the menu.
  const [unlockedModifiers, setUnlockedModifiers] = useLocalStorage<ModifierId[]>(
    "ms.unlockedModifiers",
    [],
  )
  // Fastest clear time (in seconds) per modifier. Recorded when a round is won.
  const [bestTimes, setBestTimes] = useLocalStorage<Partial<Record<ModifierId, number>>>(
    "ms.bestTimes",
    {},
  )
  const { theme, toggle: toggleTheme } = useTheme()

  const palette = useMemo(() => paletteFor(config.paletteSeed), [config.paletteSeed])

  useEffect(() => {
    document.body.style.setProperty("--gradient-a", palette.a)
    document.body.style.setProperty("--gradient-b", palette.b)
  }, [palette])

  // Persist a snapshot of the round on every change to board/status/seconds/
  // exploded/config. Refreshing or reopening the app rehydrates from this.
  useEffect(() => {
    const round: ActiveRound = {
      level: config.level,
      rows: config.rows,
      cols: config.cols,
      mines: config.mines,
      bonusTiles: config.bonusTiles,
      modifierId: config.modifier.id,
      paletteSeed: config.paletteSeed,
      countdown: config.countdown,
      bonusValue: config.bonusValue,
      board,
      status,
      seconds,
      exploded,
      lossReason,
    }
    try {
      localStorage.setItem(ACTIVE_ROUND_KEY, JSON.stringify(round))
    } catch {
      // Out of quota or disabled — degrade silently rather than crash.
    }
  }, [config, board, status, seconds, exploded, lossReason])

  const minesLeft = Math.max(0, config.mines - countFlags(board))

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])
  const startTimer = useCallback(() => {
    if (timerRef.current != null) return
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const cfg = configRef.current
        if (cfg.countdown != null) {
          const next = s - 1
          if (next <= 0) {
            // Countdown hit zero — player loses to the clock.
            stopTimer()
            setStatus("lost")
            setLossReason("time")
            setShake(true)
            window.setTimeout(() => setShake(false), 400)
            return 0
          }
          return next
        }
        return s + 1
      })
    }, 1000)
  }, [stopTimer])
  useEffect(() => () => stopTimer(), [stopTimer])

  // Pause the timer whenever the menu is open. Resume only if a round is
  // actively in progress when the menu closes.
  useEffect(() => {
    if (menuOpen) stopTimer()
    else if (status === "playing") startTimer()
  }, [menuOpen, status, startTimer, stopTimer])

  const pushFloat = (text: string) => {
    const id = ++floatId.current
    setFloats((f) => [...f, { id, text }])
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900)
  }

  // Shared post-win bookkeeping. `finalSeconds` is the on-clock value at the
  // moment of victory — elapsed for count-up modes, remaining for countdown
  // modes. We translate both to a single "time used" metric so best times
  // are comparable across modes.
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
        if (prevBest == null || timeUsed < prevBest) {
          return { ...prev, [id]: timeUsed }
        }
        return prev
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
    [stopTimer, setCurrentLevel],
  )

  const handleReveal = useCallback(
    (r: number, c: number) => {
      if (status === "won" || status === "lost") return

      let working = board
      if (status === "ready") {
        working = placeMines(working, config.mines, r, c, config.modifier.id)
        if (config.bonusTiles > 0) working = placeBonusTiles(working, config.bonusTiles)
        setStatus("playing")
        startTimer()
      }

      const cell = working[r][c]
      if (cell.state === "flagged") return

      if (cell.mine) {
        const revealed = revealAllMines(working)
        revealed[r][c] = { ...revealed[r][c], state: "revealed" }
        setBoard(revealed)
        setExploded([r, c])
        setShake(true)
        setStatus("lost")
        setLossReason("mine")
        stopTimer()
        setStreak(0)
        window.setTimeout(() => setShake(false), 400)
        return
      }

      // Sniper mode disables the cascade — each safe cell must be revealed
      // individually. Everything else flood-fills normally.
      const { board: nextBoard, revealed } =
        config.modifier.id === "sniper"
          ? revealSingle(working, r, c)
          : revealCascade(working, r, c)
      let bonusGained = 0
      for (const [rr, cc] of revealed) {
        if (nextBoard[rr][cc].bonus) bonusGained += config.bonusValue
      }
      if (bonusGained > 0) {
        // Countdown modes: extend the clock. Count-up modes: shave elapsed.
        if (config.countdown != null) {
          setSeconds((s) => s + bonusGained)
        } else {
          setSeconds((s) => Math.max(0, s - bonusGained))
        }
        pushFloat(`+${bonusGained}s`)
      }
      setBoard(nextBoard)

      if (checkWin(nextBoard)) {
        // Compute the on-clock value AFTER bonus adjustment for win recording.
        const finalSeconds =
          config.countdown != null ? seconds + bonusGained : Math.max(0, seconds - bonusGained)
        recordWin(finalSeconds)
      }
    },
    [board, config, status, seconds, startTimer, stopTimer, recordWin],
  )

  const handleFlag = useCallback(
    (r: number, c: number) => {
      if (status === "won" || status === "lost") return
      setBoard((b) => toggleFlag(b, r, c))
    },
    [status],
  )

  // Tap a revealed number → if the flag count around it equals the number,
  // reveal every remaining hidden neighbor. We do this as ONE state update so
  // a single chord can't get clobbered by stale closures from iterative reveals.
  const handleChord = useCallback(
    (r: number, c: number) => {
      if (status !== "playing") return
      const cell = board[r][c]
      if (cell.state !== "revealed" || cell.adjacent === 0) return

      let flagged = 0
      const hidden: [number, number][] = []
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nc < 0 || nr >= board.length || nc >= board[0].length) continue
          const n = board[nr][nc]
          if (n.state === "flagged") flagged++
          else if (n.state === "hidden") hidden.push([nr, nc])
        }
      }
      if (flagged !== cell.adjacent || hidden.length === 0) return

      // Walk the hidden neighbours, accumulating cascades on the same board.
      let working = board
      const allRevealed: [number, number][] = []
      let hitMine: [number, number] | null = null
      for (const [nr, nc] of hidden) {
        if (working[nr][nc].state !== "hidden") continue
        if (working[nr][nc].mine) {
          hitMine = [nr, nc]
          break
        }
        const step = revealCascade(working, nr, nc)
        working = step.board
        allRevealed.push(...step.revealed)
      }

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
        window.setTimeout(() => setShake(false), 400)
        return
      }

      let bonusGained = 0
      for (const [rr, cc] of allRevealed) if (working[rr][cc].bonus) bonusGained += config.bonusValue
      if (bonusGained > 0) {
        if (config.countdown != null) {
          setSeconds((s) => s + bonusGained)
        } else {
          setSeconds((s) => Math.max(0, s - bonusGained))
        }
        pushFloat(`+${bonusGained}s`)
      }

      setBoard(working)
      if (checkWin(working)) {
        const finalSeconds =
          config.countdown != null ? seconds + bonusGained : Math.max(0, seconds - bonusGained)
        recordWin(finalSeconds)
      }
    },
    [board, status, seconds, config.bonusValue, config.countdown, recordWin],
  )

  const restartCurrent = () => {
    setMenuOpen(false)
    startLevel(config.level)
  }
  const nextLevel = () => startLevel(config.level + 1)
  const newRun = () => {
    setMenuOpen(false)
    setStreak(0)
    startLevel(1, { force: "calm" })
  }

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

      <div className="relative min-h-0 flex-1">
        <Board
          board={board}
          modifierId={config.modifier.id}
          exploded={exploded}
          shake={shake}
          flagMode={flagMode}
          onReveal={handleReveal}
          onFlag={handleFlag}
          onChord={handleChord}
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
        onToggleTheme={toggleTheme}
        onRestart={restartCurrent}
        onNewRun={newRun}
      />

      <ReadyOverlay
        visible={status === "ready" && !introDismissed}
        config={config}
        palette={palette}
        onStart={() => setIntroDismissed(true)}
      />

      <Overlay
        status={status}
        config={config}
        seconds={seconds}
        bestLevel={bestLevel}
        lossReason={lossReason}
        onNext={nextLevel}
        onRetry={restartCurrent}
        onNewRun={newRun}
      />
    </div>
  )
}

function Overlay({
  status,
  config,
  seconds,
  bestLevel,
  lossReason,
  onNext,
  onRetry,
  onNewRun,
}: {
  status: GameStatus
  config: LevelConfig
  seconds: number
  bestLevel: number
  lossReason: "mine" | "time" | null
  onNext: () => void
  onRetry: () => void
  onNewRun: () => void
}) {
  if (status !== "won" && status !== "lost") return null
  const palette = paletteFor(config.paletteSeed)
  const won = status === "won"
  const isNewBest = won && config.level >= bestLevel
  const timeUsed = config.countdown != null ? config.countdown - seconds : seconds
  const lostTitle = lossReason === "time" ? "Time's up" : "You hit a mine"
  const lostSubtitle =
    lossReason === "time"
      ? `Ran out of time on level ${config.level}.`
      : `Made it ${timeUsed}s into level ${config.level}.`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md">
      <Card
        className={cn(
          "w-full max-w-md overflow-hidden border-2",
          won ? "border-[var(--color-success)]/40" : "border-[var(--color-danger)]/40",
        )}
      >
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: won
              ? `linear-gradient(135deg, color-mix(in oklch, ${palette.a} 25%, transparent), color-mix(in oklch, ${palette.b} 18%, transparent))`
              : "linear-gradient(135deg, color-mix(in oklch, var(--color-danger) 18%, transparent), transparent)",
          }}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            {won ? <Flag className="h-3 w-3" /> : <Bomb className="h-3 w-3" />}
            {won ? "Cleared" : "Boom"}
          </div>
          <CardTitle className="mt-2 text-3xl">
            {won ? "Level complete" : lostTitle}
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {won ? `Level ${config.level} · ${config.modifier.name} · ${timeUsed}s` : lostSubtitle}
          </p>
        </div>
        <CardContent className="flex flex-col gap-3 p-6 pt-3">
          {isNewBest && (
            <Badge variant="success" className="self-start">
              <Sparkles className="h-3 w-3" /> New best level
            </Badge>
          )}
          <div className="flex gap-2">
            {won ? (
              <>
                <Button className="flex-1" onClick={onNext}>
                  Next level <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={onRetry}>
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Button className="flex-1" onClick={onRetry}>
                  <RotateCcw className="h-4 w-4" /> Retry level
                </Button>
                <Button variant="outline" onClick={onNewRun}>
                  New run
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReadyOverlay({
  visible,
  config,
  palette,
  onStart,
}: {
  visible: boolean
  config: LevelConfig
  palette: { a: string; b: string; name: string }
  onStart: () => void
}) {
  if (!visible) return null
  const isCountdown = config.countdown != null
  const timeLabel = isCountdown
    ? `Countdown · ${formatMMSS(config.countdown!)}`
    : "Timer counts up"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md">
      <Card className="w-full max-w-md overflow-hidden border-2 border-[var(--color-accent)]/30">
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, ${palette.a} 25%, transparent), color-mix(in oklch, ${palette.b} 18%, transparent))`,
          }}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            <Sparkles className="h-3 w-3" />
            Level {config.level} · {palette.name}
          </div>
          <CardTitle className="mt-2 text-3xl">{config.modifier.name}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{config.modifier.description}</p>
        </div>
        <CardContent className="flex flex-col gap-3 p-6 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-[var(--color-surface-2)]/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Board
              </div>
              <div className="font-mono text-sm text-[var(--color-fg)]">
                {config.rows}×{config.cols} · {config.mines} mines
              </div>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-2)]/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Clock
              </div>
              <div className="font-mono text-sm text-[var(--color-fg)]">{timeLabel}</div>
            </div>
          </div>
          <Button className="w-full" onClick={onStart}>
            Start
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function formatMMSS(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
