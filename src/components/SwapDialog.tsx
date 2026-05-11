import { Dice5, Heart, Radar, Sparkles, X, type LucideIcon } from "lucide-react"
import { ITEMS, type ItemType } from "@/game/items"
import { Button } from "./ui/button"
import { Card, CardContent, CardTitle } from "./ui/card"
import { cn } from "@/lib/utils"

const ICONS: Record<ItemType, LucideIcon> = {
  life: Heart,
  pick: Dice5,
  scan: Radar,
}

interface Props {
  pending: ItemType | null
  inventory: ItemType[]
  onReplace: (slot: number) => void
  onSkip: () => void
}

export function SwapDialog({ pending, inventory, onReplace, onSkip }: Props) {
  if (!pending) return null
  const def = ITEMS[pending]
  const PendingIcon = ICONS[pending]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md">
      <Card
        role="dialog"
        aria-label="Replace an item"
        className="w-full max-w-md overflow-hidden border-2 border-[var(--color-accent)]/40"
      >
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--color-accent) 22%, transparent), color-mix(in oklch, var(--color-accent-2) 16%, transparent))",
          }}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            <Sparkles className="h-3 w-3" />
            Item found
          </div>
          <CardTitle className="mt-2 flex items-center gap-3 text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-accent)]">
              <PendingIcon className="h-5 w-5" strokeWidth={2.5} />
            </span>
            {def.name}
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{def.description}</p>
        </div>
        <CardContent className="flex flex-col gap-4 p-6 pt-3">
          <div className="text-xs text-[var(--color-muted)]">
            Your inventory is full. Tap one of your items to swap it for {def.name}, or skip.
          </div>
          <div className="flex justify-center gap-3">
            {inventory.map((id, idx) => {
              const itemDef = ITEMS[id]
              const Icon = ICONS[id]
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onReplace(idx)}
                  aria-label={`Replace ${itemDef.name}`}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 border-[var(--color-border)] p-3 transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)] active:scale-95",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      id === "life"
                        ? "bg-[color-mix(in_oklch,var(--color-flag)_18%,transparent)] text-[var(--color-flag)]"
                        : "bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] text-[var(--color-fg)]",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {itemDef.name}
                  </span>
                </button>
              )
            })}
          </div>
          <Button variant="ghost" onClick={onSkip} className="self-stretch">
            <X className="h-4 w-4" /> Skip — discard {def.name}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
