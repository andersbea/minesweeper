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
  toggleFlag,
} from "@/game/engine"
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

export function Game() {
  // Restore the player's current level on first mount so closing & re-opening
  // the app drops them back where they were.
  const initialLevel = readPersistedLevel()
  const [config, setConfig] = useState<LevelConfig>(() =>
    configForLevel(initialLevel, initialLevel === 1 ? { force: "calm" } : undefined),
  )
  const [board, setBoard] = useState<BoardT>(() => makeEmptyBoard(config.rows, config.cols))
  const [status, setStatus] = useState<GameStatus>("ready")
  const [seconds, setSeconds] = useState(0)
  const [exploded, setExploded] = useState<[number, number] | null>(null)
  const [shake, setShake] = useState(false)
  const [floats, setFloats] = useState<FloatText[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const floatId = useRef(0)
  const timerRef = useRef<number | null>(null)

  const [bestLevel, setBestLevel] = useLocalStorage<number>("ms.bestLevel", 0)
  const [streak, setStreak] = useLocalStorage<number>("ms.streak", 0)
  const [totalWins, setTotalWins] = useLocalStorage<number>("ms.totalWins", 0)
  const [flagMode, setFlagMode] = useLocalStorage<boolean>("ms.flagMode", false)
  const [, setCurrentLevel] = useLocalStorage<number>("ms.currentLevel", initialLevel)
  // Highest level the player has cleared. Unlocks the level picker for
  // levels [1..maxClearedLevel + 1].
  const [maxClearedLevel, setMaxClearedLevel] = useLocalStorage<number>("ms.maxClearedLevel", 0)
  // Modifier IDs the player has won at least once with — drives the
  // achievement grid in the menu.
  const [unlockedModifiers, setUnlockedModifiers] = useLocalStorage<ModifierId[]>(
    "ms.unlockedModifiers",
    [],
  )
  const { theme, toggle: toggleTheme } = useTheme()

  const palette = useMemo(() => paletteFor(config.paletteSeed), [config.paletteSeed])

  useEffect(() => {
    document.body.style.setProperty("--gradient-a", palette.a)
    document.body.style.setProperty("--gradient-b", palette.b)
  }, [palette])

  const minesLeft = Math.max(0, config.mines - countFlags(board))

  const startTimer = useCallback(() => {
    if (timerRef.current != null) return
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
  }, [])
  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])
  useEffect(() => () => stopTimer(), [stopTimer])

  const pushFloat = (text: string) => {
    const id = ++floatId.current
    setFloats((f) => [...f, { id, text }])
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900)
  }

  const startLevel = useCallback(
    (nextLevel: number, opts?: { force?: LevelConfig["modifier"]["id"] }) => {
      const cfg = configForLevel(nextLevel, opts)
      setConfig(cfg)
      setBoard(makeEmptyBoard(cfg.rows, cfg.cols))
      setStatus("ready")
      setSeconds(0)
      setExploded(null)
      setShake(false)
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
        stopTimer()
        setStreak(0)
        window.setTimeout(() => setShake(false), 400)
        return
      }

      const { board: nextBoard, revealed } = revealCascade(working, r, c)
      let bonusGained = 0
      for (const [rr, cc] of revealed) {
        if (nextBoard[rr][cc].bonus) bonusGained += 5
      }
      if (bonusGained > 0) {
        setSeconds((s) => Math.max(0, s - bonusGained))
        pushFloat(`+${bonusGained}s`)
      }
      setBoard(nextBoard)

      if (checkWin(nextBoard)) {
        setStatus("won")
        stopTimer()
        setBestLevel((b) => Math.max(b, config.level))
        setMaxClearedLevel((m) => Math.max(m, config.level))
        setStreak((s) => s + 1)
        setTotalWins((w) => w + 1)
        const id = config.modifier.id
        setUnlockedModifiers((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
    },
    [
      board,
      config,
      status,
      startTimer,
      stopTimer,
      setBestLevel,
      setMaxClearedLevel,
      setStreak,
      setTotalWins,
      setUnlockedModifiers,
    ],
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
        stopTimer()
        setStreak(0)
        window.setTimeout(() => setShake(false), 400)
        return
      }

      let bonusGained = 0
      for (const [rr, cc] of allRevealed) if (working[rr][cc].bonus) bonusGained += 5
      if (bonusGained > 0) {
        setSeconds((s) => Math.max(0, s - bonusGained))
        pushFloat(`+${bonusGained}s`)
      }

      setBoard(working)
      if (checkWin(working)) {
        setStatus("won")
        stopTimer()
        setBestLevel((b) => Math.max(b, config.level))
        setMaxClearedLevel((m) => Math.max(m, config.level))
        setStreak((s) => s + 1)
        setTotalWins((w) => w + 1)
        const id = config.modifier.id
        setUnlockedModifiers((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
    },
    [
      board,
      status,
      config.level,
      config.modifier.id,
      stopTimer,
      setBestLevel,
      setMaxClearedLevel,
      setStreak,
      setTotalWins,
      setUnlockedModifiers,
    ],
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
        maxClearedLevel={maxClearedLevel}
        onToggleTheme={toggleTheme}
        onRestart={restartCurrent}
        onNewRun={newRun}
        onJumpToLevel={(lvl) => {
          setMenuOpen(false)
          startLevel(lvl)
        }}
      />

      <Overlay
        status={status}
        config={config}
        seconds={seconds}
        bestLevel={bestLevel}
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
  onNext,
  onRetry,
  onNewRun,
}: {
  status: GameStatus
  config: LevelConfig
  seconds: number
  bestLevel: number
  onNext: () => void
  onRetry: () => void
  onNewRun: () => void
}) {
  if (status !== "won" && status !== "lost") return null
  const palette = paletteFor(config.paletteSeed)
  const won = status === "won"
  const isNewBest = won && config.level >= bestLevel

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
            {won ? "Level complete" : "You hit a mine"}
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {won
              ? `Level ${config.level} · ${config.modifier.name} · ${seconds}s`
              : `Made it ${seconds}s into level ${config.level}.`}
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
