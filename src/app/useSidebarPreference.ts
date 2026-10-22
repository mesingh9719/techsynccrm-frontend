import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { hasPermission } from '../lib/permissions'
import type { NavItem } from './navigation'

const storageKey = 'techsync:sidebar:v1'

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))
}

/**
 * Desktop rail collapsed/expanded, remembered in localStorage (expanded by default), synced
 * across tabs, and toggled with the `[` key.
 */
export function useSidebarPreference() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'collapsed'
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        localStorage.setItem(storageKey, next ? 'collapsed' : 'expanded')
      } catch {
        /* Session preference still works. */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      toggle()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setCollapsed(e.newValue === 'collapsed')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('storage', onStorage)
    }
  }, [toggle])

  return { collapsed, toggle }
}

/** Whether the signed-in member may see a nav item. */
export function useNavItemVisible() {
  const { user } = useAuth()
  return (item: NavItem) => !item.permission || hasPermission(user?.organization?.permissions, item.permission)
}
