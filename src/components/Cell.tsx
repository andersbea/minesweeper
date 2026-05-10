import { memo, useRef } from "react"
import { Bomb, Flag, Sparkles } from "lucide-react"
import type { Cell as CellT } from "@/game/types"
import { cn } from "@/lib/utils"

const NUMBER_CLASSES: Record<number, string> = {
  1: "text-[oklch(0.85_0.14_220)] [[data-theme=light]_&]:text-[oklch(0.5_0.18_240)]",
  2: "text-[oklch(0.82_0.16_150)] [[data-theme=light]_&]:text-[oklch(0.45_0.18_150)]",
  3: "text-[oklch(0.78_0.18_30)] [[data-theme=light]_&]:text-[oklch(0.55_0.22_25)]",
  4: "text-[oklch(0.78_0.16_280)] [[data-theme=light]_&]:text-[oklch(0.45_0.2_290)]",
  5: "text-[oklch(0.78_0.18_60)] [[data-theme=light]_&]:text-[oklch(0.55_0.18_50)]",
  6: "text-[oklch(0.78_0.16_180)] [[data-theme=light]_&]:text-[oklch(0.5_0.16_200)]",
  7: "text-[oklch(0.78_0.16_320)] [[data-theme=light]_&]:text-[oklch(0.5_0.2_320)]",
  8: "text-[oklch(0.85_0.04_280)] [[data-theme=light]_&]:text-[oklch(0.4_0.04_280)]",
}

interface Props {
  cell: CellT
  row: number
  col: number
  size: number
  fogged: boolean
  exploded: boolean
  flagMode: boolean
  onReveal: (r: number, c: number) => void
  onFlag: (r: number, c: number) => void
  onChord: (r: number, c: number) => void
}

const LONG_PRESS_MS = 280
const MOVE_TOLERANCE_PX = 14

function CellInner({
  cell,
  row,
  col,
  size,
  fogged,
  exploded,
  flagMode,
  onReveal,
  onFlag,
  onChord,
}: Props) {
  const isRevealed = cell.state === "revealed"
  const isFlagged = cell.state === "flagged"

  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const startPos = useRef<{ x: number; y: number } | null>(null)

  const clearTimer = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Primary action when the user taps a hidden cell. In normal mode this is
  // reveal; in flag mode it's flag — and long-press swaps them.
  const primaryHidden = (alternate: boolean) => {
    const flag = flagMode !== alternate
    if (flag) onFlag(row, col)
    else onReveal(row, col)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (longPressFired.current) {
      // Long-press already triggered the secondary action — suppress the click.
      longPressFired.current = false
      return
    }
    if (e.shiftKey || e.altKey) {
      onFlag(row, col)
      return
    }
    if (isRevealed) {
      if (cell.adjacent > 0) onChord(row, col)
      return
    }
    primaryHidden(false)
  }

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isRevealed) onFlag(row, col)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return
    longPressFired.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    clearTimer()
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      // Long-press = the alternate of whatever the primary action is.
      // On a revealed cell, long-press isn't useful, so do nothing.
      if (!isRevealed) {
        primaryHidden(true)
        if ("vibrate" in navigator) navigator.vibrate(15)
      }
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || !startPos.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) clearTimer()
  }

  const showNumber = isRevealed && !cell.mine && cell.adjacent > 0 && !fogged

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={handleContext}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.45)),
        WebkitTouchCallout: "none",
      }}
      className={cn(
        "relative flex select-none items-center justify-center rounded-md font-mono font-semibold transition-all duration-150 touch-manipulation",
        !isRevealed &&
          "bg-[var(--color-surface-2)]/80 border border-[var(--color-border)]/80 hover:bg-[var(--color-border)]/70 hover:border-[var(--color-accent)]/40",
        isRevealed &&
          !cell.mine &&
          "bg-[var(--color-surface)]/40 border border-[var(--color-border)]/30 cell-reveal",
        isRevealed &&
          cell.mine &&
          (exploded
            ? "bg-[var(--color-danger)]/30 border border-[var(--color-danger)]/60"
            : "bg-[var(--color-surface)]/30 border border-[var(--color-border)]/30"),
        isFlagged && "bg-[var(--color-surface-2)]/80 border border-[var(--color-flag)]/40",
      )}
      aria-label={`Cell ${row + 1},${col + 1}`}
    >
      {!isRevealed && cell.bonus && !isFlagged && (
        <span className="absolute inset-0 rounded-md opacity-30 [background:radial-gradient(circle_at_center,var(--color-flag),transparent_70%)] pointer-events-none" />
      )}

      {isFlagged && (
        <Flag className="cell-pop h-4 w-4 text-[var(--color-flag)]" strokeWidth={2.5} />
      )}

      {isRevealed && cell.mine && (
        <Bomb
          className={cn(
            "cell-pop h-4 w-4",
            exploded ? "text-[var(--color-danger)]" : "text-[var(--color-fg-soft)]",
          )}
          strokeWidth={2.5}
        />
      )}

      {isRevealed && cell.bonus && !cell.mine && (
        <Sparkles className="cell-pop h-4 w-4 text-[var(--color-flag)]" strokeWidth={2.5} />
      )}

      {showNumber && (
        <span className={cn("cell-pop", NUMBER_CLASSES[cell.adjacent])}>{cell.adjacent}</span>
      )}
    </button>
  )
}

export const Cell = memo(CellInner)
