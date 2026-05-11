import { Flag, Timer, Trophy, Bomb } from "lucide-react"
import { Card } from "./ui/card"
import { cn } from "@/lib/utils"

interface StatProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  accent?: boolean
  danger?: boolean
}

function Stat({ icon, label, value, accent, danger }: StatProps) {
  return (
    <Card
      className={cn(
        "flex-1 px-3 py-2 sm:px-4 sm:py-3",
        accent && "border-[var(--color-accent)]/40",
        danger && "border-[var(--color-danger)]/60",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9",
            accent
              ? "text-black bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))]"
              : danger
                ? "bg-[color-mix(in_oklch,var(--color-danger)_18%,transparent)] text-[var(--color-danger)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-fg-soft)]",
          )}
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-col items-start">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">{label}</span>
          <span
            className={cn(
              "font-mono text-base font-semibold tabular-nums sm:text-lg",
              danger ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
            )}
          >
            {value}
          </span>
        </div>
      </div>
    </Card>
  )
}

interface Props {
  level: number
  best: number
  minesLeft: number
  seconds: number
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function HUD({ level, best, minesLeft, seconds }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat icon={<Trophy className="h-4 w-4" />} label="Level" value={level} accent />
      <Stat
        icon={<Bomb className="h-4 w-4" />}
        label="Mines"
        value={minesLeft}
        danger={minesLeft < 0}
      />
      <Stat icon={<Timer className="h-4 w-4" />} label="Time" value={fmt(seconds)} />
      <Stat icon={<Flag className="h-4 w-4" />} label="Best Lv." value={best || "—"} />
    </div>
  )
}
