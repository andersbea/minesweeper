import path from "node:path"
import { execSync } from "node:child_process"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// GitHub Pages serves the app from `https://<user>.github.io/<repo>/`, so
// we need a base path matching the repo when deploying. Locally and on any
// path-root deploy, the default `/` works.
const base = process.env.BASE_PATH ?? "/"

// Short git hash baked into the bundle so the menu can show which build is
// running. Falls back to "dev" when there's no git context.
function gitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim()
  } catch {
    return "dev"
  }
}

export default defineConfig({
  base,
  define: {
    __APP_HASH__: JSON.stringify(gitHash()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon-180x180.png", "logo.svg"],
      manifest: {
        name: "Minesweeper",
        short_name: "Minesweeper",
        description:
          "A minimalist Minesweeper with progression, randomized modifiers, and gradient color palettes.",
        theme_color: "#0d0d12",
        background_color: "#0d0d12",
        display: "standalone",
        orientation: "any",
        start_url: base,
        scope: base,
        categories: ["games", "puzzle"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
