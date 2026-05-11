import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Crosshair,
  Dice5,
  Heart,
  Link2,
  Lock,
  Maximize,
  Moon,
  MousePointerClick,
  Package,
  Radar,
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
import { ITEMS, type ItemType } from "@/game/items"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { ModifierBanner } from "./ModifierBanner"
import { HUD } from "./HUD"
import { cn } from "@/lib/utils"

const ITEM_ICONS: Record<ItemType, LucideIcon> = {
  life: Heart,
  pick: Dice5,
  scan: Radar,
}

const MODIFIER_ICONS: Record<string, LucideIcon> = {
  Cloud,
  Crosshair,
  Link2,
  Maximize,
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
  discoveredItems: ItemType[]
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
  discoveredItems,
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
  const [view, setView] = useState<"main" | "modifiers" | "items">("main")

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
            discoveredItems={discoveredItems}
            onClose={onClose}
            onToggleTheme={onToggleTheme}
            onRestart={onRestart}
            onNewRun={onNewRun}
            onOpenModifiers={() => setView("modifiers")}
            onOpenItems={() => setView("items")}
          />
        ) : view === "modifiers" ? (
          <ModifiersView
            palette={palette}
            unlockedModifiers={unlockedModifiers}
            bestTimes={bestTimes}
            onBack={() => setView("main")}
            onClose={onClose}
          />
        ) : (
          <ItemsDiscoveryView
            palette={palette}
            discoveredItems={discoveredItems}
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
  discoveredItems,
  onClose,
  onToggleTheme,
  onRestart,
  onNewRun,
  onOpenModifiers,
  onOpenItems,
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
  discoveredItems: ItemType[]
  onClose: () => void
  onToggleTheme: () => void
  onRestart: () => void
  onNewRun: () => void
  onOpenModifiers: () => void
  onOpenItems: () => void
}) {
  const totalModifiers = Object.keys(MODIFIERS).length
  const totalItemTypes = Object.keys(ITEMS).length
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

      <button
        type="button"
        onClick={onOpenItems}
        aria-label="Open items list"
        className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3 text-left transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)]/70"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black"
          style={{ background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }}
        >
          <Package className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-fg)]">Items</div>
          <div className="text-xs text-[var(--color-muted)]">
            {discoveredItems.length} of {totalItemTypes} discovered
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

function ItemsDiscoveryView({
  palette,
  discoveredItems,
  onBack,
  onClose,
}: {
  palette: Palette
  discoveredItems: ItemType[]
  onBack: () => void
  onClose: () => void
}) {
  const ids = Object.keys(ITEMS) as ItemType[]
  const discoveredSet = new Set(discoveredItems)
  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to menu">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
            Collection
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">Items</h2>
        </div>
        <Badge variant="outline">
          <Package className="h-3 w-3" />
          {discoveredItems.length}/{ids.length}
        </Badge>
        <Button variant="outline" size="icon" onClick={onClose} aria-label="Close menu">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Items are hidden on the board each round. Reveal a cell to uncover one, then tap it to
        collect. Newly collected items unlock at the start of the next round.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {ids.map((id) => {
          const def = ITEMS[id]
          const isKnown = discoveredSet.has(id)
          const Icon = ITEM_ICONS[id]
          return (
            <div
              key={id}
              role="group"
              aria-label={isKnown ? def.name : "Undiscovered item"}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                isKnown
                  ? "border-[var(--color-border)] bg-[var(--color-surface)]/70"
                  : "border-dashed border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/40",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isKnown ? "text-black" : "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
                )}
                style={
                  isKnown
                    ? { background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }
                    : undefined
                }
              >
                {isKnown ? (
                  <Icon className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isKnown ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]",
                  )}
                >
                  {isKnown ? def.name : "???"}
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {isKnown ? def.description : "Find and collect this item to reveal it here."}
                </div>
              </div>
            </div>
          )
        })}
      </div>
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
