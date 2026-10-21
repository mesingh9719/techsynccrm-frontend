import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { logout } from '../../services/auth'
import { Logo } from '../ui/Brand'
import { Avatar } from '../ui/Badge'
import { Container } from '../ui/Section'
import { RouteProgress, ScrollManager } from './Layout'

const YEAR = new Date().getFullYear()

/** Minimal chrome for verification, onboarding and the signed-in app — no marketing nav. */
export function FocusedLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function onSignOut() {
    setSigningOut(true)
    await logout().catch(() => {})
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#main"
        className="fixed top-3 left-3 z-[80] -translate-y-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <RouteProgress />
      <ScrollManager />
      <header className="border-b border-zinc-200/80 bg-white">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Logo />
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden text-right text-sm sm:block">
                <span className="block font-medium text-zinc-900">{user.fullName}</span>
                <span className="block text-xs text-zinc-500">{user.email}</span>
              </span>
              <Avatar name={user.fullName} size="sm" />
              <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
                <span className="sr-only sm:hidden">Log out</span>
              </button>
            </div>
          )}
        </Container>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="py-6 text-center text-xs text-zinc-400">© {YEAR} TechSync Technologies Pvt. Ltd.</footer>
    </div>
  )
}
