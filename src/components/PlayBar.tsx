import { Bomb, Flag, Menu, MousePointer2 } from "lucide-react"
import type { LevelConfig } from "@/game/types"
import type { Palette } from "@/game/palette"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

interface Props {
  config: LevelConfig
  palette: Palette
  minesLeft: number
  seconds: number
  flagMode: boolean
  onToggleFlagMode: () => void
  onOpenMenu: () => void
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function PlayBar({
  config,
  palette,
  minesLeft,
  seconds,
  flagMode,
  onToggleFlagMode,
  onOpenMenu,
}: Props) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3 py-2 backdrop-blur-xl sm:gap-3 sm:px-4">
      {/* flex-1 + min-w-0 makes the modifier label expand into whatever space
          the right cluster doesn't claim, instead of shrinking to its
          content's intrinsic size. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="h-7 w-7 shrink-0 rounded-md text-black flex items-center justify-center text-[11px] font-mono font-semibold"
          style={{ background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }}
          aria-label={`Level ${config.level}`}
        >
          {String(config.level).padStart(2, "0")}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-muted)] leading-tight">
            {palette.name}
          </span>
          <span className="truncate text-xs font-semibold leading-tight text-[var(--color-fg)]">
            {config.modifier.name}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "flex items-center gap-1.5 font-mono tabular-nums text-sm",
            minesLeft < 0
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-fg)]",
          )}
          aria-label={minesLeft < 0 ? "Too many flags placed" : `${minesLeft} mines remaining`}
        >
          <Bomb
            className={cn(
              "h-3.5 w-3.5",
              minesLeft < 0
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-fg-soft)]",
            )}
          />
          {minesLeft}
        </div>
        <div className="font-mono tabular-nums text-sm text-[var(--color-fg)]">{fmt(seconds)}</div>

        <button
          type="button"
          onClick={onToggleFlagMode}
          aria-pressed={flagMode}
          aria-label={flagMode ? "Switch to reveal mode" : "Switch to flag mode"}
          title={flagMode ? "Tap = flag · long-press = reveal" : "Tap = reveal · long-press = flag"}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95",
            flagMode
              ? "border-[var(--color-flag)]/60 bg-[color-mix(in_oklch,var(--color-flag)_22%,transparent)] text-[var(--color-flag)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)]/60 text-[var(--color-fg-soft)]",
          )}
        >
          {flagMode ? (
            <Flag className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <MousePointer2 className="h-4 w-4" />
          )}
        </button>

        <Button variant="outline" size="icon" onClick={onOpenMenu} aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
