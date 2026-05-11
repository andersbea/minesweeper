export type CellState = "hidden" | "revealed" | "flagged"

export interface Cell {
  mine: boolean
  adjacent: number
  state: CellState
  bonus: boolean // bonus tile - grants extra time
  twin: boolean // marks one half of a twin-mine pair (cosmetic indicator only)
}

export type Board = Cell[][]

export type ModifierId =
  | "fog"
  | "bonus"
  | "twin"
  | "quick"
  | "dense"
  | "calm"
  | "big"
  | "sniper"

export interface Modifier {
  id: ModifierId
  name: string
  description: string
  icon: string // lucide name
}

export interface LevelConfig {
  rows: number
  cols: number
  mines: number
  bonusTiles: number
  modifier: Modifier
  paletteSeed: number
  level: number
  // For countdown modes: starting time in seconds. null/undefined = count up.
  countdown: number | null
  // Seconds gained per bonus tile revealed (positive in countdown mode = add
  // time remaining; in count-up mode = subtract from elapsed).
  bonusValue: number
}

export type GameStatus = "ready" | "playing" | "won" | "lost"
