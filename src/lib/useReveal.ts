import { useEffect, useRef } from 'react'

/**
 * Fades an element in the first time it scrolls into view.
 * Elements are only hidden once JS has attached, so content never stays invisible.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Already on screen at mount: show without animating to avoid a flash.
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.9) return

    el.classList.add('reveal')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.visible = 'true'
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
