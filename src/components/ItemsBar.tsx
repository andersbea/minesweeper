import { useRef, useState } from "react"
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
  /** Parallel to `items`: true means this item was collected this round and
   *  can't be used until the next round starts. */
  itemLocks: boolean[]
  canUse: boolean
  onUse: (slot: number) => void
}

export function ItemsBar({ items, itemLocks, canUse, onUse }: Props) {
  const slots = Array.from({ length: ITEM_MAX }, (_, i) => items[i] ?? null)
  const hasItems = items.length > 0
  const [tooltip, setTooltip] = useState<number | null>(null)
  const pressTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>(
    Array(ITEM_MAX).fill(null),
  )

  const openTip = (i: number) => setTooltip(i)
  const closeTip = () => setTooltip(null)

  const onPressStart = (i: number) => {
    if (!slots[i]) return
    pressTimers.current[i] = setTimeout(() => openTip(i), 450)
  }
  const onPressEnd = (i: number) => {
    const t = pressTimers.current[i]
    if (t != null) {
      clearTimeout(t)
      pressTimers.current[i] = null
    }
  }

  return (
    <div
      role={hasItems ? "list" : undefined}
      aria-label={hasItems ? "Items" : undefined}
      aria-hidden={!hasItems}
      className={cn(
        "flex justify-center gap-2",
        // Keep the row in the layout at all times so gaining the first item
        // never shifts the board. Use visibility rather than display so the
        // height is preserved.
        !hasItems && "invisible pointer-events-none",
      )}
    >
      {slots.map((slot, i) => {
        const def = slot ? ITEMS[slot] : null
        const Icon = slot ? ICONS[slot] : null
        const isLocked = slot ? (itemLocks[i] ?? false) : false
        const disabled = !slot || !canUse || slot === "life" || isLocked
        const tipVisible = tooltip === i && !!slot

        return (
          <div key={i} className="relative">
            <button
              type="button"
              role="listitem"
              disabled={disabled}
              onClick={() => {
                closeTip()
                if (slot && !isLocked) onUse(i)
              }}
              onMouseEnter={() => slot && openTip(i)}
              onMouseLeave={closeTip}
              onPointerDown={() => onPressStart(i)}
              onPointerUp={() => onPressEnd(i)}
              onPointerCancel={() => {
                onPressEnd(i)
                closeTip()
              }}
              aria-label={
                slot
                  ? `${def!.name}${isLocked ? " — usable next round" : ""}`
                  : "Empty item slot"
              }
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg border transition-all",
                slot
                  ? isLocked
                    ? "border-[var(--color-border)] bg-[var(--color-surface-2)]/50 text-[var(--color-muted)] opacity-70"
                    : slot === "life"
                      ? "border-[var(--color-flag)]/60 bg-[color-mix(in_oklch,var(--color-flag)_18%,transparent)] text-[var(--color-flag)]"
                      : "border-[var(--color-accent)]/50 bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] text-[var(--color-fg)] active:scale-90 hover:border-[var(--color-accent)]"
                  : "border-dashed border-[var(--color-border)] bg-transparent text-[var(--color-muted)]",
              )}
            >
              {slot && Icon ? (
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Lock className="h-3.5 w-3.5 opacity-30" />
              )}
              {/* Small lock badge for newly collected (locked) items */}
              {isLocked && slot && (
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <Lock className="h-2 w-2 text-[var(--color-muted)]" />
                </span>
              )}
            </button>

            {/* Tooltip — shown on hover (desktop) or long-press (mobile) */}
            {tipVisible && def && (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-xl backdrop-blur-xl"
              >
                <div className="text-xs font-semibold text-[var(--color-fg)]">{def.name}</div>
                <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">
                  {def.description}
                </div>
                {isLocked && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-[var(--color-muted)]">
                    <Lock className="h-2.5 w-2.5" />
                    Usable from next round
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
