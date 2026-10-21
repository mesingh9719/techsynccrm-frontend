import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { Button } from '../ui/Button'

/** Scrolls to top on page change, or to the #hash target once it has rendered. */
export function ScrollManager() {
  const { pathname, hash, key } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    if (!hash) {
      if (!first.current) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      first.current = false
      return
    }
    first.current = false
    let attempts = 0
    let frame = 0
    const tryScroll = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (attempts++ < 30) {
        frame = requestAnimationFrame(tryScroll)
      }
    }
    tryScroll()
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash, key])

  return null
}

/** Thin top bar while a lazy route chunk is loading. */
export function RouteProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return (
    <div className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-brand-100" role="progressbar" aria-label="Loading page">
      <div className="h-full w-2/5 animate-progress bg-brand-600" />
    </div>
  )
}

const CONSENT_KEY = 'ts-cookie-consent'

function CookieNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(CONSENT_KEY)
    } catch {
      return false
    }
  })

  if (!visible) return null

  const decide = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem(CONSENT_KEY, choice)
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed bottom-4 left-4 z-[55] max-w-sm animate-fade-up rounded-dialog bg-white p-5 shadow-float ring-1 ring-zinc-200 [animation-delay:1.2s] max-sm:right-4"
    >
      <p className="text-sm font-medium text-zinc-900">We use a few cookies</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Essential cookies keep the site working. With your OK, we also use analytics to improve it. See our{' '}
        <Link to="/privacy#cookies" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="dark" onClick={() => decide('all')}>
          Accept all
        </Button>
        <Button size="sm" variant="secondary" onClick={() => decide('essential')}>
          Essential only
        </Button>
      </div>
    </div>
  )
}

export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-[80] -translate-y-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <RouteProgress />
      <ScrollManager />
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Footer />
      <CookieNotice />
    </>
  )
}
