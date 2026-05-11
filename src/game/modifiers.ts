import type { Modifier, ModifierId } from "./types"

export const MODIFIERS: Record<ModifierId, Modifier> = {
  calm: {
    id: "calm",
    name: "Calm",
    description: "A standard board. Timer counts up.",
    icon: "Waves",
  },
  fog: {
    id: "fog",
    name: "Fog",
    description: "Numbers only appear on cells touching the unexplored area.",
    icon: "Cloud",
  },
  bonus: {
    id: "bonus",
    name: "Bonus Tiles",
    description:
      "Countdown. Sparkling tiles add seconds to the clock when revealed — find them to survive.",
    icon: "Sparkles",
  },
  twin: {
    id: "twin",
    name: "Twin Mines",
    description: "Mines come in adjacent pairs. Read the board carefully.",
    icon: "Link2",
  },
  quick: {
    id: "quick",
    name: "Quick Round",
    description: "Countdown. Smaller board, but the clock is ticking — beat it before time runs out.",
    icon: "Zap",
  },
  dense: {
    id: "dense",
    name: "Dense Field",
    description: "More mines than usual at this level.",
    icon: "Target",
  },
}

export const MODIFIER_POOL: ModifierId[] = ["calm", "calm", "fog", "bonus", "twin", "quick", "dense"]
