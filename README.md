# Minesweeper

A minimalist Minesweeper with progression, randomized round modifiers, and gradient palettes.

## Features

- Levels grow from 9×9 to 18×18 with rising mine density
- 6 round modifiers (Calm, Fog, Bonus Tiles, Twin Mines, Quick Round, Dense Field) revealed as achievements as you clear them
- Per-round gradient palette (8 distinct moods)
- First-click safety, chord on satisfied numbers, long-press / right-click to flag, dedicated flag-mode toggle
- Progression, theme, flag mode and current level all persisted to localStorage
- Light & dark mode
- Installable PWA with offline support

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · shadcn-style UI primitives · `vite-plugin-pwa` · Playwright

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/
npm run build    # production bundle
npm run preview  # serve the build
npm test         # Playwright suite (desktop + mobile projects)
```

## Deployment

Pushes to `main` are built and published to GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
The build sets `BASE_PATH=/minesweeper/` so all asset URLs and the PWA manifest scope match the repo's Pages path.
