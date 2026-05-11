/**
 * Persistence layer for the active round.
 *
 * A schema version is embedded in every saved snapshot. If the version in
 * localStorage doesn't match the current one, the saved data is treated as
 * stale and discarded — the player starts a fresh round instead of crashing
 * on an unrecognised field shape.
 */

import { MODIFIERS } from "./modifiers"
import type { Board } from "./types"
import type { GameStatus, LevelConfig, ModifierId } from "./types"

export const ACTIVE_ROUND_KEY = "ms.activeRound"

/** Increment this whenever the saved shape changes in a breaking way. */
const SCHEMA_VERSION = 1

export interface ActiveRound {
  schemaVersion: number
  level: number
  rows: number
  cols: number
  mines: number
  bonusTiles: number
  modifierId: ModifierId
  paletteSeed: number
  board: Board
  status: GameStatus
  seconds: number
  exploded: [number, number] | null
  countdown: number | null
  bonusValue: number
  lossReason: "mine" | "time" | null
}

/**
 * Read and validate the persisted round from localStorage.
 * Returns `null` if nothing is saved, the data is corrupt, or the schema is
 * out of date — the caller should treat this as "no saved round".
 */
export function readActiveRound(): ActiveRound | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_ROUND_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (
      !p ||
      typeof p !== "object" ||
      // Schema guard: stale saves (missing version or wrong number) are discarded.
      p.schemaVersion !== SCHEMA_VERSION ||
      typeof p.level !== "number" ||
      typeof p.rows !== "number" ||
      typeof p.cols !== "number" ||
      typeof p.mines !== "number" ||
      !Array.isArray(p.board) ||
      p.board.length !== p.rows ||
      !MODIFIERS[p.modifierId as ModifierId] ||
      !["ready", "playing", "won", "lost"].includes(p.status)
    )
      return null
    return p as ActiveRound
  } catch {
    return null
  }
}

export function readPersistedLevel(): number {
  if (typeof window === "undefined") return 1
  try {
    const raw = window.localStorage.getItem("ms.currentLevel")
    if (!raw) return 1
    const n = JSON.parse(raw)
    return typeof n === "number" && n >= 1 ? n : 1
  } catch {
    return 1
  }
}

export function configFromSaved(saved: ActiveRound): LevelConfig {
  return {
    level: saved.level,
    rows: saved.rows,
    cols: saved.cols,
    mines: saved.mines,
    bonusTiles: saved.bonusTiles,
    modifier: MODIFIERS[saved.modifierId],
    paletteSeed: saved.paletteSeed,
    countdown: saved.countdown,
    bonusValue: saved.bonusValue,
  }
}

/** Construct a complete ActiveRound snapshot ready to persist. */
export function buildSnapshot(
  config: LevelConfig,
  board: Board,
  status: GameStatus,
  seconds: number,
  exploded: [number, number] | null,
  lossReason: "mine" | "time" | null,
): ActiveRound {
  return {
    schemaVersion: SCHEMA_VERSION,
    level: config.level,
    rows: config.rows,
    cols: config.cols,
    mines: config.mines,
    bonusTiles: config.bonusTiles,
    modifierId: config.modifier.id,
    paletteSeed: config.paletteSeed,
    countdown: config.countdown,
    bonusValue: config.bonusValue,
    board,
    status,
    seconds,
    exploded,
    lossReason,
  }
}
