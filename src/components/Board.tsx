import { useEffect, useMemo, useRef, useState } from "react"
import { Minimize2 } from "lucide-react"
import type { Board as BoardT } from "@/game/types"
import { Cell } from "./Cell"
import { cn } from "@/lib/utils"

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5

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
  // Zoom level (1 = neutral; clamped by MIN_SCALE / MAX_SCALE).
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(1)
  scaleRef.current = scale

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

  // Pinch-zoom + two-finger pan on the scroll container. The browser
  // already handles one-finger scrolling via `touch-action: pan-x pan-y`,
  // so this hook only kicks in for two-finger gestures.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const distance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const centroid = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    })

    type PinchStart = {
      dist: number
      scale: number
      pointer: { x: number; y: number }
      scrollLeft: number
      scrollTop: number
    }
    let pinch: PinchStart | null = null

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      // Two-finger gesture — claim it from the browser so we drive both
      // zoom and pan ourselves.
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const c = centroid(e.touches)
      pinch = {
        dist: distance(e.touches[0], e.touches[1]),
        scale: scaleRef.current,
        pointer: { x: c.x - rect.left, y: c.y - rect.top },
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2 || !pinch) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const d = distance(e.touches[0], e.touches[1])
      const c = centroid(e.touches)
      const pointer = { x: c.x - rect.left, y: c.y - rect.top }
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, pinch.scale * (d / pinch.dist)),
      )

      // Anchor the gesture: the document point under the original centroid
      // should stay under the current centroid as we scale.
      const docX = (pinch.pointer.x + pinch.scrollLeft) / pinch.scale
      const docY = (pinch.pointer.y + pinch.scrollTop) / pinch.scale
      setScale(next)
      // Scroll to keep that doc point under the live centroid, accounting
      // for the centroid having moved (two-finger pan).
      el.scrollLeft = docX * next - pointer.x
      el.scrollTop = docY * next - pointer.y
    }

    const onTouchEnd = () => {
      pinch = null
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [])

  // Reset scale to neutral when the board itself changes (new level, new run).
  // Using rows/cols as a proxy avoids resetting after every reveal.
  useEffect(() => {
    setScale(1)
  }, [rows, cols])

  const { cellSize, gap, padding } = useMemo(
    () => fitCells(rows, cols, containerSize.width, containerSize.height),
    [rows, cols, containerSize],
  )

  const naturalWidth = padding * 2 + cols * cellSize + Math.max(0, cols - 1) * gap
  const naturalHeight = padding * 2 + rows * cellSize + Math.max(0, rows - 1) * gap
  const scaledWidth = naturalWidth * scale
  const scaledHeight = naturalHeight * scale

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

  const zoomed = Math.abs(scale - 1) > 0.05

  return (
    // Outer scroll viewport. One-finger drag scrolls natively (touch-action),
    // two-finger drag scales+pans via the effect above.
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto overscroll-contain [touch-action:pan-x_pan-y]"
    >
      {/* Wrapper sized to the *scaled* dimensions so the outer container
          has something to scroll. Centers the board when it fits. */}
      <div className="flex min-h-full min-w-full items-center justify-center p-2">
        <div
          className="relative shrink-0"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          {/* Board card itself, sized to natural dimensions and CSS-scaled
              to the current zoom level. */}
          <div
            className={cn(
              "absolute left-0 top-0 origin-top-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 backdrop-blur-xl",
              "shadow-[0_30px_80px_-30px_color-mix(in_oklch,var(--color-accent)_30%,transparent)]",
              shake && "shake",
            )}
            style={{
              padding,
              width: naturalWidth,
              height: naturalHeight,
              transform: `scale(${scale})`,
            }}
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
      {zoomed && (
        <button
          type="button"
          onClick={() => setScale(1)}
          aria-label="Reset zoom"
          className="sticky bottom-3 left-[calc(100%-3.5rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 text-[var(--color-fg)] shadow-lg backdrop-blur transition-all hover:bg-[var(--color-surface-2)] active:scale-95"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
