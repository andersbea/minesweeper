import { ErrorBoundary } from "./components/ErrorBoundary"
import { Game } from "./components/Game"
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt"

export default function App() {
  return (
    <ErrorBoundary>
      {/* Fixed gradient blobs that animate in the background. Colours are
          driven by --gradient-a/b CSS vars set by Game.tsx per modifier. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="bg-blob-a" />
        <div className="bg-blob-b" />
      </div>
      <Game />
      <PWAUpdatePrompt />
    </ErrorBoundary>
  )
}
