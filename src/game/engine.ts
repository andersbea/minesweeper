import type { Board, Cell, LevelConfig, ModifierId } from "./types"
import { MODIFIERS, MODIFIER_POOL } from "./modifiers"
import { PALETTES } from "./palette"
import { rollItem } from "./items"

export function makeEmptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from(
      { length: cols },
      (): Cell => ({
        mine: false,
        adjacent: 0,
        state: "hidden",
        bonus: false,
        twin: false,
        item: null,
      }),
    ),
  )
}

const NEIGHBORS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
]

export function inBounds(board: Board, r: number, c: number) {
  return r >= 0 && r < board.length && c >= 0 && c < board[0].length
}

function neighbors(board: Board, r: number, c: number) {
  const out: [number, number][] = []
  for (const [dr, dc] of NEIGHBORS) {
    const nr = r + dr
    const nc = c + dc
    if (inBounds(board, nr, nc)) out.push([nr, nc])
  }
  return out
}

export function placeMines(
  board: Board,
  totalMines: number,
  safeR: number,
  safeC: number,
  modifier: ModifierId,
): Board {
  const rows = board.length
  const cols = board[0].length
  const safe = new Set<number>()
  for (const [nr, nc] of neighbors(board, safeR, safeC)) safe.add(nr * cols + nc)
  safe.add(safeR * cols + safeC)
  const safeCells = rows * cols - totalMines

  // Try up to N layouts. Reject any whose cascade from (safeR, safeC) would
  // auto-clear the board — that's the "flag/unflag/reveal → instant win" UX
  // surprise the player ran into. After enough retries, fall back to the
  // last attempt (better any board than an infinite loop).
  let lastCandidate: Board | null = null
  for (let attempt = 0; attempt < 12; attempt++) {
    const next = board.map((row) => row.map((c) => ({ ...c })))
    let placed = 0
    let attempts = 0
    const maxAttempts = rows * cols * 10

    while (placed < totalMines && attempts < maxAttempts) {
      attempts++
      const r = Math.floor(Math.random() * rows)
      const c = Math.floor(Math.random() * cols)
      if (safe.has(r * cols + c)) continue
      if (next[r][c].mine) continue

      if (modifier === "twin" && placed + 1 < totalMines) {
        // Try to place a paired mine on a neighbor.
        const pool = neighbors(next, r, c).filter(
          ([nr, nc]) => !next[nr][nc].mine && !safe.has(nr * cols + nc),
        )
        if (pool.length === 0) continue
        const [nr, nc] = pool[Math.floor(Math.random() * pool.length)]
        next[r][c].mine = true
        next[r][c].twin = true
        next[nr][nc].mine = true
        next[nr][nc].twin = true
        placed += 2
      } else {
        next[r][c].mine = true
        placed++
      }
    }

    // Compute adjacency counts so revealCascade has the data it needs.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (next[r][c].mine) continue
        let count = 0
        for (const [nr, nc] of neighbors(next, r, c)) if (next[nr][nc].mine) count++
        next[r][c].adjacent = count
      }
    }

    lastCandidate = next
    // Simulate the cascade that the first click will trigger. If it covers
    // every safe cell, this layout would auto-win — reroll.
    const { revealed } = revealCascade(next, safeR, safeC)
    if (revealed.length < safeCells) return next
  }
  // Couldn't find a non-auto-win layout in 12 tries (very rare). Return the
  // last one so we at least produce a playable round.
  return lastCandidate!
}

/**
 * Drop a single random item onto the board (excluding mines, bonus tiles,
 * and the safe-zone around the first click). The player must reveal AND
 * tap the cell to collect — no auto-grants. Returns the modified board.
 */
export function placeItems(
  board: Board,
  level: number,
  safeR: number,
  safeC: number,
): Board {
  const rows = board.length
  const cols = board[0].length
  const safe = new Set<number>()
  for (const [nr, nc] of NEIGHBORS) {
    const r = safeR + nr
    const c = safeC + nc
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue
    safe.add(r * cols + c)
  }
  safe.add(safeR * cols + safeC)

  const next = board.map((row) => row.map((c) => ({ ...c })))
  const item: Cell["item"] = rollItem(level)
  for (let attempts = 0; attempts < rows * cols * 5; attempts++) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    const cell = next[r][c]
    if (cell.mine || cell.bonus || cell.item) continue
    if (safe.has(r * cols + c)) continue
    cell.item = item
    return next
  }
  return next
}

export function placeBonusTiles(board: Board, count: number): Board {
  if (count <= 0) return board
  const rows = board.length
  const cols = board[0].length
  const next = board.map((row) => row.map((c) => ({ ...c })))
  let placed = 0
  let attempts = 0
  while (placed < count && attempts < rows * cols * 5) {
    attempts++
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    const cell = next[r][c]
    if (cell.mine || cell.bonus) continue
    cell.bonus = true
    placed++
  }
  return next
}

// Reveal just one cell, no cascade. Used by Sniper mode and as a building
// block for the regular cascade.
export function revealSingle(board: Board, r: number, c: number): { board: Board; revealed: [number, number][] } {
  const next = board.map((row) => row.map((c) => ({ ...c })))
  if (next[r][c].state !== "hidden") return { board: next, revealed: [] }
  next[r][c].state = "revealed"
  return { board: next, revealed: [[r, c]] }
}

export function revealCascade(board: Board, r: number, c: number): { board: Board; revealed: [number, number][] } {
  const next = board.map((row) => row.map((c) => ({ ...c })))
  const revealed: [number, number][] = []
  const stack: [number, number][] = [[r, c]]
  while (stack.length) {
    const [cr, cc] = stack.pop()!
    const cell = next[cr][cc]
    if (cell.state !== "hidden") continue
    cell.state = "revealed"
    revealed.push([cr, cc])
    if (cell.adjacent === 0 && !cell.mine) {
      for (const [nr, nc] of neighbors(next, cr, cc)) {
        const n = next[nr][nc]
        if (n.state === "hidden" && !n.mine) stack.push([nr, nc])
      }
    }
  }
  return { board: next, revealed }
}

export function toggleFlag(board: Board, r: number, c: number): Board {
  const cell = board[r][c]
  if (cell.state === "revealed") return board
  const next = board.map((row) => row.map((c) => ({ ...c })))
  next[r][c].state = next[r][c].state === "flagged" ? "hidden" : "flagged"
  return next
}

export function revealAllMines(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => (cell.mine ? { ...cell, state: "revealed" as const } : cell)),
  )
}

export function checkWin(board: Board) {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.mine && cell.state !== "revealed") return false
    }
  }
  return true
}

export function countFlags(board: Board) {
  let n = 0
  for (const row of board) for (const cell of row) if (cell.state === "flagged") n++
  return n
}

// ----- Level configuration -----

export function configForLevel(level: number, opts?: { force?: ModifierId }): LevelConfig {
  // Smooth growth: 9x9 with 10 mines at L1, capping near 18x18 with ~55 mines.
  const baseRows = Math.min(9 + Math.floor((level - 1) / 2), 18)
  const baseCols = Math.min(9 + Math.floor((level - 1) / 2), 18)
  const minePct = 0.13 + Math.min(0.07, (level - 1) * 0.008)
  let rows = baseRows
  let cols = baseCols
  let mines = Math.round(rows * cols * minePct)
  let bonusTiles = 0
  let countdown: number | null = null
  let bonusValue = 5

  const modifierId =
    opts?.force ?? MODIFIER_POOL[Math.floor(Math.random() * MODIFIER_POOL.length)]
  const modifier = MODIFIERS[modifierId]

  switch (modifier.id) {
    case "quick": {
      // Smaller board, denser mines, AND a countdown.
      rows = Math.max(7, baseRows - 2)
      cols = Math.max(7, baseCols - 2)
      mines = Math.round(rows * cols * (minePct + 0.03))
      // Time scales with safe-cell count so larger boards still feel beatable.
      // Floor ensures very early levels start gentle (~40s on level 1).
      const safe = rows * cols - mines
      countdown = Math.max(30, Math.round(safe * 0.9 + level * 3))
      break
    }
    case "dense":
      mines = Math.round(rows * cols * (minePct + 0.04))
      break
    case "bonus": {
      // Countdown mode where revealed bonus tiles extend the clock.
      bonusTiles = 2 + Math.floor(level / 3)
      bonusValue = 6
      const safe = rows * cols - mines
      // Start tight, but each bonus tile is worth `bonusValue` extra seconds,
      // so the total budget if you find them all = countdown + bonusTiles*bonusValue.
      countdown = Math.max(25, Math.round(safe * 0.7 + level * 2))
      break
    }
    case "twin":
      // Round mines down to even count so all can pair.
      if (mines % 2 === 1) mines += 1
      break
    case "big": {
      // Larger board with slightly relaxed density. Designed for panning.
      rows = Math.min(20, baseRows + 5)
      cols = Math.min(20, baseCols + 5)
      mines = Math.round(rows * cols * Math.max(0.1, minePct - 0.02))
      break
    }
    case "sniper": {
      // Slightly smaller board, normal density. No cascades — the player has
      // to manually reveal every cell. The engine still places mines; the
      // "no-cascade" rule is enforced at the reveal call site.
      rows = Math.max(7, baseRows - 1)
      cols = Math.max(7, baseCols - 1)
      mines = Math.round(rows * cols * minePct)
      break
    }
    default:
      break
  }

  // Clamp to leave at least a 9-cell safe region around first click.
  mines = Math.min(mines, rows * cols - 9)

  return {
    rows,
    cols,
    mines,
    bonusTiles,
    modifier,
    paletteSeed: Math.floor(Math.random() * PALETTES.length),
    level,
    countdown,
    bonusValue,
  }
}
