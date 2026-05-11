// Consumable items the player can hold (up to 3 at a time). Earned by
// clearing levels; types are weighted so the "Extra Life" — the strongest
// one — gets rarer as the player climbs.

export type ItemType = "life" | "pick" | "scan"

export const ITEM_MAX = 3

export interface ItemDef {
  id: ItemType
  name: string
  description: string
  icon: string // lucide icon name
}

export const ITEMS: Record<ItemType, ItemDef> = {
  life: {
    id: "life",
    name: "Extra Life",
    description: "Auto-activates the next time you click a mine. Saves the run.",
    icon: "Heart",
  },
  pick: {
    id: "pick",
    name: "Lucky Pick",
    description: "Reveals one random safe hidden cell.",
    icon: "Dice5",
  },
  scan: {
    id: "scan",
    name: "Mine Scan",
    description: "Briefly highlights every mine on the board.",
    icon: "Radar",
  },
}

/**
 * Roll a random item to award the player after clearing a level.
 * Extra Life weight decays linearly with level so survivability is most
 * generous early on, and other items dominate at higher levels.
 */
export function rollItem(level: number): ItemType {
  const lifeWeight = Math.max(1, 30 - level)
  const pickWeight = 30
  const scanWeight = 30
  const total = lifeWeight + pickWeight + scanWeight
  const roll = Math.random() * total
  if (roll < lifeWeight) return "life"
  if (roll < lifeWeight + pickWeight) return "pick"
  return "scan"
}
