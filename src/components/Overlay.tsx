import { Bomb, ChevronRight, Flag, RotateCcw, Sparkles } from "lucide-react"
import type { GameStatus, LevelConfig } from "@/game/types"
import { paletteFor } from "@/game/palette"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardTitle } from "./ui/card"
import { cn } from "@/lib/utils"

interface Props {
  status: GameStatus
  /** Controls mount — false means the overlay is absent from the DOM. */
  visible: boolean
  config: LevelConfig
  /** Current on-clock value (elapsed for count-up, remaining for countdown). */
  seconds: number
  bestLevel: number
  lossReason: "mine" | "time" | null
  onNext: () => void
  onRetry: () => void
  onNewRun: () => void
}

export function Overlay({
  status,
  visible,
  config,
  seconds,
  bestLevel,
  lossReason,
  onNext,
  onRetry,
  onNewRun,
}: Props) {
  if (!visible) return null

  const palette = paletteFor(config.paletteSeed)
  const won = status === "won"
  const isNewBest = won && config.level >= bestLevel
  const timeUsed = config.countdown != null ? config.countdown - seconds : seconds
  const lostTitle = lossReason === "time" ? "Time's up" : "You hit a mine"
  const lostSubtitle =
    lossReason === "time"
      ? `Ran out of time on level ${config.level}.`
      : `Made it ${timeUsed}s into level ${config.level}.`

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
            {won ? "Level complete" : lostTitle}
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {won
              ? `Level ${config.level} · ${config.modifier.name} · ${timeUsed}s`
              : lostSubtitle}
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
