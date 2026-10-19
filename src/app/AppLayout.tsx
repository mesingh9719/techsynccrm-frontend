import { useNotificationStream } from '../features/notifications/useNotificationStream'
import { useEffect, useState } from 'react'
import { Clock, FileText, UsersRound, X } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { acceptTerms } from '../services/auth'
import { pricing } from '../services/content'
import { legal } from '../services/legal'
import { emitAppEvent } from '../lib/appEvents'
import { cn } from '../lib/cn'
import { useAuth } from '../lib/useAuth'
import { useOrg } from '../lib/useOrg'
import { Button } from '../components/ui/Button'
import { RequireStage } from '../components/auth/Guards'
import { RouteProgress, ScrollManager } from '../components/layout/Layout'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAppShortcuts } from './useAppShortcuts'

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 animate-fade-in bg-zinc-950/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in bg-white shadow-frame">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label="Close navigation">
          <X className="size-5" aria-hidden="true" />
        </button>
        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  )
}

/** Non-blocking banner when the Terms or Privacy Policy changed since the user last accepted. */
function TermsBanner() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!user || user.termsUpToDate) return null
  return (
    <div className="flex flex-col gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-900 sm:flex-row sm:items-center sm:justify-between sm:px-6" role="status">
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
          await acceptTerms({ termsVersion: legal.terms.updated, privacyVersion: legal.privacy.updated }).catch(() => {})
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
      <div className="flex flex-col gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between sm:px-6" role="alert">
        <p className="flex items-center gap-2">
          <UsersRound className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Your workspace has more members than the {planName} plan includes. Until you choose who keeps access, only you and one admin can sign in.
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
  const label = days === 0 ? `Your ${planName} trial ends today` : `${days} day${days === 1 ? '' : 's'} left in your ${planName} trial`
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6',
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
        <Button size="sm" onClick={() => emitAppEvent({ type: 'upgrade', reason: 'feature', requiredPlan: organization.plan, message: `Keep everything in ${planName} after your trial ends.` })}>
          Upgrade
        </Button>
      </div>
    </div>
  )
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  useAppShortcuts()
  useNotificationStream()

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="fixed top-3 left-3 z-[80] -translate-y-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <RouteProgress />
      <ScrollManager />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-zinc-200/80 bg-white lg:block">
        <Sidebar />
      </aside>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-64">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <PlanBanner />
        <TermsBanner />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
      </div>
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
