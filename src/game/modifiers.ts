import type { Modifier, ModifierId } from "./types"

export const MODIFIERS: Record<ModifierId, Modifier> = {
  calm: {
    id: "calm",
    name: "Calm",
    description: "A standard board. No surprises.",
    icon: "Waves",
  },
  fog: {
    id: "fog",
    name: "Fog",
    description: "Numbers only show on cells next to revealed ones.",
    icon: "Cloud",
  },
  bonus: {
    id: "bonus",
    name: "Bonus Tiles",
    description: "Sparkling tiles grant +5 seconds when revealed.",
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
    description: "Smaller board, denser mines. Move fast.",
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
