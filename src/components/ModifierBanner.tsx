import type { LevelConfig } from "@/game/types"
import type { Palette } from "@/game/palette"
import { getModifierIcon } from "@/lib/item-icons"
import { Card } from "./ui/card"

interface Props {
  config: LevelConfig
  palette: Palette
}

export function ModifierBanner({ config, palette }: Props) {
  const Icon = getModifierIcon(config.modifier.icon)
  return (
    <Card className="overflow-hidden border-[var(--color-accent)]/30">
      <div
        className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
        style={{
          background: `linear-gradient(120deg, color-mix(in oklch, ${palette.a} 18%, transparent), color-mix(in oklch, ${palette.b} 12%, transparent) 60%, transparent)`,
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black sm:h-12 sm:w-12"
          style={{ background: `linear-gradient(135deg, ${palette.a}, ${palette.b})` }}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
        </div>
        <div className="flex min-w-0 flex-col items-start">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Round modifier
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-soft)]">
              · {palette.name}
            </span>
          </div>
          <div className="text-sm font-semibold text-[var(--color-fg)] sm:text-base">
            {config.modifier.name}
          </div>
          <div className="text-xs text-[var(--color-muted)] sm:text-sm">
            {config.modifier.description}
          </div>
        </div>
      </div>
    </Card>
  )
}
