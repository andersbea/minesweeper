import { Dice5, Heart, Lock, Radar, type LucideIcon } from "lucide-react"
import { ITEM_MAX, ITEMS, type ItemType } from "@/game/items"
import { cn } from "@/lib/utils"

const ICONS: Record<ItemType, LucideIcon> = {
  life: Heart,
  pick: Dice5,
  scan: Radar,
}

interface Props {
  items: ItemType[]
  canUse: boolean
  onUse: (slot: number) => void
}

export function ItemsBar({ items, canUse, onUse }: Props) {
  const slots = Array.from({ length: ITEM_MAX }, (_, i) => items[i] ?? null)
  return (
    <div
      role="list"
      aria-label="Items"
      className="flex justify-center gap-2"
    >
      {slots.map((slot, i) => {
        const def = slot ? ITEMS[slot] : null
        const Icon = slot ? ICONS[slot] : Lock
        // Lives auto-trigger — render them as static badges, not buttons.
        const disabled = !slot || !canUse || slot === "life"
        return (
          <button
            key={i}
            type="button"
            role="listitem"
            disabled={disabled}
            onClick={() => slot && onUse(i)}
            aria-label={
              slot ? `${def!.name} — ${def!.description}` : "Empty item slot"
            }
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg border transition-all",
              slot
                ? slot === "life"
                  ? "border-[var(--color-flag)]/60 bg-[color-mix(in_oklch,var(--color-flag)_18%,transparent)] text-[var(--color-flag)]"
                  : "border-[var(--color-accent)]/50 bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] text-[var(--color-fg)] active:scale-90 hover:border-[var(--color-accent)]"
                : "border-dashed border-[var(--color-border)] bg-transparent text-[var(--color-muted)]",
              disabled && slot && slot !== "life" && "opacity-60",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )
      })}
    </div>
  )
}
