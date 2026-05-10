import { useRegisterSW } from "virtual:pwa-register/react"
import { Button } from "./ui/button"
import { Card } from "./ui/card"
import { Sparkles } from "lucide-react"

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn("SW registration failed", err)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <Card className="pointer-events-auto flex items-center gap-3 px-4 py-3">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="text-sm text-[var(--color-fg)]">A new version is available.</span>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Reload
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
      </Card>
    </div>
  )
}
