import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'
const key = 'techsync:theme:v1'
const icons = { light: Sun, dark: Moon, system: Monitor }
function useAppTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === 'light' || saved === 'dark' ? saved : 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.crmTheme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    media.addEventListener('change', apply)
    try {
      localStorage.setItem(key, theme)
    } catch {
      /* Preferences remain available in memory. */
    }
    return () => {
      media.removeEventListener('change', apply)
      delete document.documentElement.dataset.crmTheme
    }
  }, [theme])
  return { theme, setTheme }
}
export function ThemeControl() {
  const { theme, setTheme } = useAppTheme()
  const Icon = icons[theme]
  return (
    <label className="relative flex size-10 items-center justify-center rounded-lg text-muted hover:bg-zinc-100">
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </label>
  )
}
