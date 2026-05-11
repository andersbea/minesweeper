import { Dice5, Heart, Lock, Radar, Sparkles, type LucideIcon } from "lucide-react"
import type { LevelConfig } from "@/game/types"
import { ITEM_MAX, ITEMS, type ItemType } from "@/game/items"
import { formatMMSS } from "@/lib/format"
import { Button } from "./ui/button"
import { Card, CardContent, CardTitle } from "./ui/card"
import { cn } from "@/lib/utils"

const ITEM_ICONS: Record<ItemType, LucideIcon> = {
  life: Heart,
  pick: Dice5,
  scan: Radar,
}

interface Props {
  visible: boolean
  config: LevelConfig
  palette: { a: string; b: string; name: string }
  items: ItemType[]
  itemLocks: boolean[]
  onStart: () => void
}

export function ReadyOverlay({ visible, config, palette, items, itemLocks, onStart }: Props) {
  if (!visible) return null

  const isCountdown = config.countdown != null
  const timeLabel = isCountdown
    ? `Countdown · ${formatMMSS(config.countdown!)}`
    : "Timer counts up"
  const hasLockedItems = items.some((_, i) => itemLocks[i] ?? false)

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

          {items.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Your items{hasLockedItems ? " · new items unlock on start" : ""}
              </div>
              <div className="flex gap-2">
                {Array.from({ length: ITEM_MAX }, (_, i) => {
                  const type = items[i] ?? null
                  const def = type ? ITEMS[type] : null
                  const Icon = type ? ITEM_ICONS[type] : null
                  const locked = type ? (itemLocks[i] ?? false) : false
                  return (
                    <div
                      key={i}
                      className={cn(
                        "relative flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5",
                        type
                          ? locked
                            ? "border-[var(--color-border)] bg-[var(--color-surface-2)]/40"
                            : "border-[var(--color-accent)]/30 bg-[color-mix(in_oklch,var(--color-accent)_8%,transparent)]"
                          : "border-dashed border-[var(--color-border)]/40 bg-transparent",
                      )}
                    >
                      {type && Icon && def ? (
                        <>
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              locked ? "text-[var(--color-muted)]" : "text-[var(--color-accent)]",
                            )}
                            strokeWidth={2.5}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "truncate text-[10px] font-semibold leading-tight",
                                locked ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]",
                              )}
                            >
                              {def.name}
                            </div>
                            {locked && (
                              <div className="flex items-center gap-0.5 text-[9px] text-[var(--color-muted)]">
                                <Lock className="h-2 w-2" />
                                New
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-[var(--color-muted)]">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Button className="w-full" onClick={onStart}>
            Start
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
