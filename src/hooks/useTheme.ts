import { useEffect } from "react"
import { useLocalStorage } from "./useLocalStorage"

export type Theme = "dark" | "light"

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>("ms.theme", "dark")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark")

  return { theme, toggle }
}
