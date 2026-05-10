import { useEffect, useMemo, useRef, useState } from "react"
import type { Board as BoardT } from "@/game/types"
import { Cell } from "./Cell"
import { cn } from "@/lib/utils"

// Fit a grid of `rows × cols` cells inside `width × height`, returning a tile
// size that maintains square cells. Returns sensible defaults when the
// container hasn't been measured yet.
function fitCells(rows: number, cols: number, width: number, height: number) {
  const compact = width < 480
  const padding = compact ? 6 : 12
  const gap = compact ? 2 : 4
  const availW = Math.max(0, width - padding * 2)
  const availH = Math.max(0, height - padding * 2)
  const byWidth = Math.floor((availW - (cols - 1) * gap) / cols)
  const byHeight = Math.floor((availH - (rows - 1) * gap) / rows)
  const cellSize = Math.max(18, Math.min(48, Math.min(byWidth, byHeight)))
  return { cellSize, gap, padding }
}

interface Props {
  board: BoardT
  modifierId: string
  exploded: [number, number] | null
  shake: boolean
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

  // Fog modifier: hide a revealed cell's number unless it has a revealed neighbor.
  const fogVisible = useMemo(() => {
    if (modifierId !== "fog") return null
    const visible = Array.from({ length: rows }, () => Array.from({ length: cols }, () => true))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].state !== "revealed") continue
        let hasRevealedNeighbor = false
        for (let dr = -1; dr <= 1 && !hasRevealedNeighbor; dr++) {
          for (let dc = -1; dc <= 1 && !hasRevealedNeighbor; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr
            const nc = c + dc
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
            if (board[nr][nc].state === "revealed") hasRevealedNeighbor = true
          }
        }
        visible[r][c] = hasRevealedNeighbor
      }
    }
    return visible
  }, [board, modifierId, rows, cols])

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      <div
        className={cn(
          "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-xl",
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
  )
}
