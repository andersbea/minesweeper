// Curated gradient palettes — each pair gives a distinct mood.
// Stored as oklch components so we can plug them into CSS vars.

export interface Palette {
  name: string
  a: string // gradient anchor 1
  b: string // gradient anchor 2
}

export const PALETTES: Palette[] = [
  { name: "Aurora", a: "oklch(0.78 0.18 320)", b: "oklch(0.78 0.18 220)" },
  { name: "Ember", a: "oklch(0.78 0.2 30)", b: "oklch(0.8 0.18 80)" },
  { name: "Lagoon", a: "oklch(0.78 0.16 180)", b: "oklch(0.78 0.18 260)" },
  { name: "Bloom", a: "oklch(0.82 0.18 350)", b: "oklch(0.82 0.16 50)" },
  { name: "Citrus", a: "oklch(0.85 0.18 100)", b: "oklch(0.78 0.18 160)" },
  { name: "Dusk", a: "oklch(0.7 0.2 290)", b: "oklch(0.78 0.18 350)" },
  { name: "Mint", a: "oklch(0.85 0.16 150)", b: "oklch(0.8 0.16 200)" },
  { name: "Sunset", a: "oklch(0.78 0.2 20)", b: "oklch(0.78 0.18 320)" },
]

export function paletteFor(seed: number): Palette {
  return PALETTES[seed % PALETTES.length]
}
