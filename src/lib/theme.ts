import { useLayoutEffect, useSyncExternalStore } from 'react'

/** Workspace colour theme, shared by every theme control and persisted per browser. */
export type Theme = 'light' | 'dark' | 'system'

const key = 'techsync:theme:v1'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const saved = localStorage.getItem(key)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

let current: Theme = read()

export function setTheme(next: Theme) {
  current = next
  try {
    localStorage.setItem(key, next)
  } catch {
    /* Preference still applies for this session. */
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the preference.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return
    current = read()
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => current)
  return { theme, setTheme }
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Browser chrome colour per theme — matches the top bar so mobile status bars blend in. */
const chromeColor = { light: '#ffffff', dark: '#131c2e' }

/**
 * Applies the saved theme to the app shell while it is mounted: the `data-crm-theme` attribute,
 * the mobile browser `theme-color`, and live updates when the OS switches light/dark.
 */
export function useApplyTheme() {
  const { theme } = useTheme()
  useLayoutEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previousColor = meta?.content
    const previousTheme = root.dataset.crmTheme
    const createdMeta = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.append(meta)
    }
    const tag = meta
    const apply = () => {
      const resolved = resolveTheme(theme)
      root.dataset.crmTheme = resolved
      tag.content = chromeColor[resolved]
    }
    apply()
    media.addEventListener('change', apply)
    return () => {
      media.removeEventListener('change', apply)
      if (previousTheme) root.dataset.crmTheme = previousTheme
      else delete root.dataset.crmTheme
      if (createdMeta) tag.remove()
      else if (previousColor !== undefined) tag.content = previousColor
    }
  }, [theme])
}
