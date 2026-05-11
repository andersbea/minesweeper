import { Component, type ReactNode } from "react"
import { ACTIVE_ROUND_KEY } from "@/game/round-storage"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level error boundary. If any child component throws during render or in
 * a lifecycle method, we catch it here rather than white-screening the app.
 *
 * The "Clear saved data and reload" button nukes the active round snapshot —
 * the most common source of a crash is a stale/corrupt save from an older
 * schema version that slipped past `readActiveRound`'s validation.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console so developers can inspect the full stack trace in devtools.
    console.error("[ErrorBoundary] Uncaught error:", error)
    console.error("[ErrorBoundary] Component stack:", info.componentStack)
  }

  private handleReset = () => {
    try {
      window.localStorage.removeItem(ACTIVE_ROUND_KEY)
    } catch {
      // Ignore — localStorage may be unavailable.
    }
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="safe-area flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-[var(--color-fg)]">Something went wrong</p>
          <p className="max-w-sm text-sm text-[var(--color-muted)]">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-border)]"
          >
            Clear saved data and reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
