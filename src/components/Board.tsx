import { useEffect, useMemo, useRef, useState } from "react"
import type { Board as BoardT } from "@/game/types"
import { Cell } from "./Cell"
import { cn } from "@/lib/utils"

// Fit a grid of `rows × cols` cells inside `width × height`. Cells are kept
// at a comfortable tap-friendly minimum even if that means the board no
// longer fits — the outer container is scrollable, so the player can pan to
// reach the rest. This is the right tradeoff on phones: bigger touch
// targets, even on dense boards.
function fitCells(rows: number, cols: number, width: number, height: number) {
  const compact = width < 480
  const padding = compact ? 6 : 12
  const gap = compact ? 2 : 4
  // Minimum tap target ~36px is roughly the WCAG "easy to tap" threshold.
  const MIN_CELL = compact ? 36 : 40
  const MAX_CELL = 56
  const availW = Math.max(0, width - padding * 2)
  const availH = Math.max(0, height - padding * 2)
  const byWidth = Math.floor((availW - (cols - 1) * gap) / cols)
  const byHeight = Math.floor((availH - (rows - 1) * gap) / rows)
  // If the board fits, scale cells up; if not, hold at MIN_CELL and overflow.
  const cellSize = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.min(byWidth, byHeight)))
  return { cellSize, gap, padding }
}

interface Props {
  board: BoardT
  modifierId: string
  exploded: [number, number] | null
  shake: boolean
  scanning: boolean
  flagMode: boolean
  onReveal: (r: number, c: number) => void
  onFlag: (r: number, c: number) => void
  onChord: (r: number, c: number) => void
}

export function Board({
  board,
  modifierId,
  exploded,
  shake,
  scanning,
  flagMode,
  onReveal,
  onFlag,
  onChord,
}: Props) {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setContainerSize({ width: rect.width, height: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { cellSize, gap, padding } = useMemo(
    () => fitCells(rows, cols, containerSize.width, containerSize.height),
    [rows, cols, containerSize],
  )

  // Fog modifier: a revealed cell shows its number only if it borders the
  // unexplored area (i.e. has at least one hidden, non-flagged neighbour).
  // This means interior cascade cells appear blank, and only the *frontier*
  // numbers — the ones you actually need to read — are visible.
  const fogVisible = useMemo(() => {
    if (modifierId !== "fog") return null
    const visible = Array.from({ length: rows }, () => Array.from({ length: cols }, () => true))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].state !== "revealed") continue
        let bordersUnexplored = false
        for (let dr = -1; dr <= 1 && !bordersUnexplored; dr++) {
          for (let dc = -1; dc <= 1 && !bordersUnexplored; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr
            const nc = c + dc
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
            if (board[nr][nc].state === "hidden") bordersUnexplored = true
          }
        }
        visible[r][c] = bordersUnexplored
      }
    }
    return visible
  }, [board, modifierId, rows, cols])

  return (
    // Scroll container — pans the board when it overflows the viewport. The
    // browser handles touch scrolling natively (touch-action: pan-x pan-y).
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto overscroll-contain [touch-action:pan-x_pan-y]"
    >
      {/* Inner flex centers the board when it fits, otherwise grows to its
          natural size so the outer scroll container has something to scroll. */}
      <div className="flex min-h-full min-w-full items-center justify-center p-2">
        <div
          className={cn(
            "shrink-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-xl",
            "shadow-[0_30px_80px_-30px_color-mix(in_oklch,var(--color-accent)_30%,transparent)]",
            shake && "shake",
          )}
          style={{ padding }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gap: `${gap}px`,
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => (
                <Cell
                  key={`${r}-${c}`}
                  cell={cell}
                  row={r}
                  col={c}
                  size={cellSize}
                  fogged={fogVisible ? !fogVisible[r][c] : false}
                  exploded={exploded ? exploded[0] === r && exploded[1] === c : false}
                  scanning={scanning}
                  flagMode={flagMode}
                  onReveal={onReveal}
                  onFlag={onFlag}
                  onChord={onChord}
                />
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
