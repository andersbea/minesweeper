import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Link2,
  Lock,
  Moon,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { LevelConfig, ModifierId } from "@/game/types"
import type { Palette } from "@/game/palette"
import type { Theme } from "@/hooks/useTheme"
import { MODIFIERS } from "@/game/modifiers"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { ModifierBanner } from "./ModifierBanner"
import { HUD } from "./HUD"
import { cn } from "@/lib/utils"

const MODIFIER_ICONS: Record<string, LucideIcon> = {
  Cloud,
  Link2,
  Sparkles,
  Target,
  Waves,
  Zap,
}

interface Props {
  open: boolean
  onClose: () => void
  config: LevelConfig
  palette: Palette
  bestLevel: number
  minesLeft: number
  seconds: number
  streak: number
  totalWins: number
  theme: Theme
  unlockedModifiers: ModifierId[]
  bestTimes: Partial<Record<ModifierId, number>>
  onToggleTheme: () => void
  onRestart: () => void
  onNewRun: () => void
}

export function MenuSheet({
  open,
  onClose,
  config,
  palette,
  bestLevel,
  minesLeft,
  seconds,
  streak,
  totalWins,
  theme,
  unlockedModifiers,
  bestTimes,
  onToggleTheme,
  onRestart,
  onNewRun,
}: Props) {
  // The sheet is unmounted when fully closed so its DOM doesn't sit offscreen.
  // We use CSS keyframe animations (sheet-enter / sheet-exit) instead of
  // class-toggled transitions because keyframes have a fixed `from`, so the
  // slide-up reliably plays even on the very first mount.
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  // Subpage navigation inside the sheet. Reset to "main" each time the sheet
  // re-opens so the user always lands on the top-level menu first.
  const [view, setView] = useState<"main" | "modifiers">("main")

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      setView("main")
    } else if (mounted) {
      setClosing(true)
      const t = window.setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-md ${
          closing ? "scrim-exit pointer-events-none" : "scrim-enter"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Game menu"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90svh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-3xl border border-x-0 border-b-0 border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:border-x sm:p-5 ${
          closing ? "sheet-exit" : "sheet-enter"
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden" />

        {view === "main" ? (
          <MainView
            config={config}
            palette={palette}
            theme={theme}
            streak={streak}
            totalWins={totalWins}
            bestLevel={bestLevel}
            minesLeft={minesLeft}
            seconds={seconds}
            unlockedModifiers={unlockedModifiers}
            onClose={onClose}
            onToggleTheme={onToggleTheme}
            onRestart={onRestart}
            onNewRun={onNewRun}
            onOpenModifiers={() => setView("modifiers")}
          />
        ) : (
          <ModifiersView
            palette={palette}
            unlockedModifiers={unlockedModifiers}
            bestTimes={bestTimes}
            onBack={() => setView("main")}
            onClose={onClose}
          />
        )}
      </div>
    </>
  )
}

function MainView({
  config,
  palette,
  theme,
  streak,
  totalWins,
  bestLevel,
  minesLeft,
  seconds,
  unlockedModifiers,
  onClose,
  onToggleTheme,
  onRestart,
  onNewRun,
  onOpenModifiers,
}: {
  config: LevelConfig
  palette: Palette
  theme: Theme
  streak: number
  totalWins: number
  bestLevel: number
  minesLeft: number
  seconds: number
  unlockedModifiers: ModifierId[]
  onClose: () => void
  onToggleTheme: () => void
  onRestart: () => void
  onNewRun: () => void
  onOpenModifiers: () => void
}) {
  const totalModifiers = Object.keys(MODIFIERS).length
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }}
            />
            Minesweeper
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            Level{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }}
            >
              {String(config.level).padStart(2, "0")}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          <Sparkles className="h-3 w-3" />
          Streak {streak}
        </Badge>
        <Badge variant="outline">{totalWins} total wins</Badge>
      </div>

      <HUD level={config.level} best={bestLevel} minesLeft={minesLeft} seconds={seconds} />
      <ModifierBanner config={config} palette={palette} />

      <button
        type="button"
        onClick={onOpenModifiers}
        aria-label="Open modifiers list"
        className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3 text-left transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)]/70"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black"
          style={{ background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }}
        >
          <Trophy className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-fg)]">Modifiers</div>
          <div className="text-xs text-[var(--color-muted)]">
            {unlockedModifiers.length} of {totalModifiers} discovered
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
      </button>

      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <MousePointerClick className="h-3.5 w-3.5" />
        <span>Tap to reveal · long-press or right-click to flag · tap a number to chord.</span>
      </div>

      <div className="mt-1 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" /> Restart level
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onNewRun}>
          New run
        </Button>
      </div>
    </>
  )
}

function ModifiersView({
  palette,
  unlockedModifiers,
  bestTimes,
  onBack,
  onClose,
}: {
  palette: Palette
  unlockedModifiers: ModifierId[]
  bestTimes: Partial<Record<ModifierId, number>>
  onBack: () => void
  onClose: () => void
}) {
  const total = Object.keys(MODIFIERS).length
  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to menu">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Achievements
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            Modifiers
          </h2>
        </div>
        <Badge variant="outline">
          <Trophy className="h-3 w-3" />
          {unlockedModifiers.length}/{total}
        </Badge>
        <Button variant="outline" size="icon" onClick={onClose} aria-label="Close menu">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Each round randomizes one modifier. Win a round to reveal it here. More modifiers will be
        added over time.
      </p>
      <ModifierAchievements
        unlocked={unlockedModifiers}
        palette={palette}
        bestTimes={bestTimes}
      />
    </>
  )
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function ModifierAchievements({
  unlocked,
  palette,
  bestTimes,
}: {
  unlocked: ModifierId[]
  palette: Palette
  bestTimes: Partial<Record<ModifierId, number>>
}) {
  const ids = Object.keys(MODIFIERS) as ModifierId[]
  const unlockedSet = new Set(unlocked)

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ids.map((id) => {
        const mod = MODIFIERS[id]
        const isUnlocked = unlockedSet.has(id)
        const Icon = MODIFIER_ICONS[mod.icon] ?? Sparkles
        const best = bestTimes[id]
        return (
          <div
            key={id}
            role="group"
            aria-label={isUnlocked ? mod.name : "Locked modifier"}
            data-unlocked={isUnlocked ? "true" : "false"}
            className={cn(
              "flex items-center gap-2 rounded-xl border p-2 text-left transition-colors",
              isUnlocked
                ? "border-[var(--color-border)] bg-[var(--color-surface)]/70"
                : "border-dashed border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/40",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                isUnlocked ? "text-black" : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
              )}
              style={
                isUnlocked
                  ? { background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }
                  : undefined
              }
            >
              {isUnlocked ? (
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-xs font-semibold",
                  isUnlocked ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]",
                )}
              >
                {isUnlocked ? mod.name : "???"}
              </div>
              <div className="truncate text-[10px] text-[var(--color-muted)]">
                {isUnlocked ? mod.description : "Win a round to reveal."}
              </div>
            </div>
            {isUnlocked && best != null && (
              <div className="ml-1 shrink-0 rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[var(--color-fg-soft)]">
                {fmtTime(best)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
