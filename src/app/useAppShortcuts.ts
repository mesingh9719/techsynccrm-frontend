import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { mainNav, settingsNavItem } from './navigation'

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))
}

/**
 * Keyboard shortcuts inside the app:
 *   /      focus search          c   open the Create menu
 *   g h    home   g l leads   g c contacts   g d deals   g t tasks   g r reports   g s settings
 * Ignored while typing in a field or when a modifier key is held.
 */
export function useAppShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    let pendingG = false
    let timer: number | undefined
    const targets = [...mainNav, settingsNavItem].filter((i) => i.shortcut)

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('dialog[open]')) return

      if (pendingG) {
        pendingG = false
        window.clearTimeout(timer)
        const item = targets.find((i) => i.shortcut === e.key.toLowerCase())
        if (item) {
          e.preventDefault()
          navigate(item.to)
        }
        return
      }

      if (e.key === 'g') {
        pendingG = true
        timer = window.setTimeout(() => (pendingG = false), 1000)
      } else if (e.key === '/') {
        // Prefer the page's own search box (lists), else the global one in the top bar.
        const command = document.querySelector<HTMLButtonElement>('[data-search-trigger]')
        if (command) {
          e.preventDefault()
          command.click()
          return
        }
        const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('[data-global-search-target]'))
        const target = boxes.find((b) => !b.closest('[data-topbar]')) ?? boxes[0]
        if (target) {
          e.preventDefault()
          target.focus()
        }
      } else if (e.key === 'c') {
        const trigger = document.querySelector<HTMLButtonElement>('[data-create-trigger]')
        if (trigger) {
          e.preventDefault()
          trigger.click()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [navigate])
}
