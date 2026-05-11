/**
 * Canonical icon maps for items and modifiers.
 * Single source of truth — import from here instead of re-declaring locally.
 */
import {
  Cloud,
  Crosshair,
  Dice5,
  Heart,
  Link2,
  Maximize,
  Radar,
  Sparkles,
  Target,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { ItemType } from "@/game/items"

export const ITEM_ICONS: Record<ItemType, LucideIcon> = {
  life: Heart,
  pick: Dice5,
  scan: Radar,
}

export const MODIFIER_ICONS: Record<string, LucideIcon> = {
  Cloud,
  Crosshair,
  Link2,
  Maximize,
  Sparkles,
  Target,
  Waves,
  Zap,
}

/** Look up a modifier icon by its string name, falling back to Sparkles. */
export function getModifierIcon(iconName: string): LucideIcon {
  return MODIFIER_ICONS[iconName] ?? Sparkles
}
