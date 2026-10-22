import { useNewLeads } from '../features/leads/useNewLeads'
import { useNotificationStream } from '../features/notifications/useNotificationStream'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Clock, Ellipsis, FileText, UsersRound } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { acceptTerms } from '../services/auth'
import { pricing } from '../services/content'
import { legal } from '../services/legal'
import { emitAppEvent } from '../lib/appEvents'
import { cn } from '../lib/cn'
import { useAuth } from '../lib/useAuth'
import { useApplyTheme } from '../lib/theme'
import { useOrg } from '../lib/useOrg'
import { lockBodyScroll } from '../components/app/bodyScrollLock'
import { Button } from '../components/ui/Button'
import { RequireStage } from '../components/auth/Guards'
import { RouteProgress, ScrollManager } from '../components/layout/Layout'
import { OverdueBadge, Sidebar } from './Sidebar'
import { useNavItemVisible, useSidebarPreference } from './useSidebarPreference'
import { mainNav, mobileTabKeys } from './navigation'
import { Topbar } from './Topbar'
import { useAppShortcuts } from './useAppShortcuts'

/**
 * Navigation drawer for phones and tablets: slides in from the left on a native modal <dialog>
 * (focus trap, Escape, inert page), closes on backdrop tap, swipe left, or navigation.
 */
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number; dx: number; tracking: boolean } | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlockScroll = lockBodyScroll()
    if (!el.open) el.showModal()
    window.dispatchEvent(new Event('techsync:overlay-open'))
    // Widening to desktop puts the rail back; drop the drawer.
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onDesktop = () => desktop.matches && onClose()
    desktop.addEventListener('change', onDesktop)
    return () => {
      desktop.removeEventListener('change', onDesktop)
      if (el.open) el.close()
      unlockScroll()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [open, onClose])

  const requestClose = useCallback(() => setClosing(true), [])
  // Closed from outside (route change) mid-animation: start fresh next time.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) setClosing(false)
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.pointerType === 'mouse') return
    swipe.current = { x: e.clientX, y: e.clientY, dx: 0, tracking: false }
  }
  function onPointerMove(e: ReactPointerEvent) {
    const s = swipe.current
    const panel = panelRef.current
    if (!s || !panel) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    // Decide once: a leftward horizontal drag closes; anything else scrolls as normal.
    if (!s.tracking) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (dx > 0 || Math.abs(dy) > Math.abs(dx)) {
        swipe.current = null
        return
      }
      s.tracking = true
    }
    s.dx = Math.min(0, dx)
    panel.style.transition = 'none'
    panel.style.transform = `translateX(${s.dx}px)`
  }
  function onPointerUp() {
    const s = swipe.current
    const panel = panelRef.current
    swipe.current = null
    if (!s?.tracking || !panel) return
    panel.style.transition = ''
    panel.style.transform = ''
    if (s.dx < -Math.min(96, panel.offsetWidth / 3)) requestClose()
  }

  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      className="mobile-nav"
      data-closing={closing || undefined}
      onCancel={(e) => {
        e.preventDefault()
        requestClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      onAnimationEnd={(e) => {
        if (e.target !== panelRef.current || !closing) return
        setClosing(false)
        onClose()
      }}
    >
      {open && (
        <div
          ref={panelRef}
          className="mobile-nav-panel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Sidebar onNavigate={requestClose} onClose={requestClose} />
        </div>
      )}
    </dialog>
  )
}

/** Phone tab bar: the four daily destinations plus “More” for the full navigation. */
function BottomTabs({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const visible = useNavItemVisible()
  const tabs = mainNav.filter((item) => mobileTabKeys.includes(item.key) && visible(item))
  return (
    <nav aria-label="Primary" className="bottom-tabs md:hidden">
      {tabs.map((item) => (
        <NavLink key={item.key} to={item.to} end={item.end} className="bottom-tab">
          {({ isActive }) => (
            <>
              <span className="bottom-tab-icon relative">
                <item.icon className="size-[22px]" aria-hidden="true" />
                {item.key === 'tasks' && <OverdueBadge active={isActive} dot />}
              </span>
              <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-haspopup="dialog"
        className="bottom-tab compact-control"
      >
        <span className="bottom-tab-icon">
          <Ellipsis className="size-[22px]" aria-hidden="true" />
        </span>
        <span>More</span>
      </button>
    </nav>
  )
}

/** Lets the app shell draw under iOS notches and home indicators (the chrome pads with safe-area insets). */
function useEdgeToEdge() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta || meta.content.includes('viewport-fit')) return
    const previous = meta.content
    meta.content = `${previous}, viewport-fit=cover`
    return () => {
      meta.content = previous
    }
  }, [])
}

/** Non-blocking banner when the Terms or Privacy Policy changed since the user last accepted. */
function TermsBanner() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!user || user.termsUpToDate) return null
  return (
    <div
      className="flex flex-col gap-2 border-b border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      role="status"
    >
      <p className="flex items-center gap-2">
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        <span>
          We’ve updated our{' '}
          <Link to="/terms" className="font-medium underline underline-offset-2">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="font-medium underline underline-offset-2">
            Privacy Policy
          </Link>
          . Please review and accept them.
        </span>
      </p>
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          await acceptTerms({ termsVersion: legal.terms.updated, privacyVersion: legal.privacy.updated }).catch(
            () => {},
          )
          setBusy(false)
        }}
      >
        Accept
      </Button>
    </div>
  )
}

/**
 * "X days left in your Growth trial · Upgrade" while a trial runs (red on the last 3 days), and —
 * for the owner — a prompt to choose who keeps access after a downgrade left too few seats.
 */
function PlanBanner() {
  const { organization, role } = useOrg()
  if (!organization) return null
  const planName = pricing.plans.find((p) => p.id === organization.plan)?.name ?? organization.plan

  if (organization.seatSelectionRequired && role === 'owner') {
    return (
      <div
        className="flex flex-col gap-2 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        role="alert"
      >
        <p className="flex items-center gap-2">
          <UsersRound className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Your workspace has more members than the {planName} plan includes. Until you choose who keeps access, only
            you and one admin can sign in.
          </span>
        </p>
        <Button size="sm" to="/app/settings/plan#seats">
          Choose who stays
        </Button>
      </div>
    )
  }

  if (!organization.trialActive || organization.trialDaysLeft === null) return null
  const days = organization.trialDaysLeft
  const urgent = days <= 3
  const label =
    days === 0
      ? `Your ${planName} trial ends today`
      : `${days} day${days === 1 ? '' : 's'} left in your ${planName} trial`
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6',
        urgent ? 'border-red-100 bg-red-50 text-red-900' : 'border-brand-100 bg-brand-50 text-brand-900',
      )}
      role="status"
    >
      <p className="flex items-center gap-2">
        <Clock className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">{label}</span>
          <span className="hidden sm:inline"> · then Starter (free) unless you upgrade. Your data stays safe.</span>
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" to="/app/settings/plan">
          See usage
        </Button>
        <Button
          size="sm"
          onClick={() =>
            emitAppEvent({
              type: 'upgrade',
              reason: 'feature',
              requiredPlan: organization.plan,
              message: `Keep everything in ${planName} after your trial ends.`,
            })
          }
        >
          Upgrade
        </Button>
      </div>
    </div>
  )
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { collapsed, toggle } = useSidebarPreference()
  const closeNav = useCallback(() => setMobileOpen(false), [])
  const { pathname } = useLocation()
  useAppShortcuts()
  useNotificationStream()
  useNewLeads()
  useApplyTheme()
  useEdgeToEdge()

  // Back/forward while the drawer is open shouldn't leave it covering the new page.
  const [navPath, setNavPath] = useState(pathname)
  if (navPath !== pathname) {
    setNavPath(pathname)
    setMobileOpen(false)
  }

  return (
    <div className="crm-shell min-h-dvh bg-canvas text-ink" data-sidebar={collapsed ? 'collapsed' : 'expanded'}>
      <a
        href="#main"
        className="fixed top-3 left-3 z-[80] -translate-y-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <RouteProgress />
      <ScrollManager />
      <aside className="app-sidebar hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>
      <MobileNav open={mobileOpen} onClose={closeNav} />
      <div className="app-content flex min-h-dvh min-w-0 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <PlanBanner />
        <TermsBanner />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
      </div>
      <BottomTabs onMore={() => setMobileOpen(true)} moreOpen={mobileOpen} />
    </div>
  )
}

/** Signed-in app chrome for /app/*. Only verified users with a workspace get here. Lazy-loaded by the router. */
export default function AppLayout() {
  return (
    <RequireStage path="/app">
      <Shell />
    </RequireStage>
  )
}
