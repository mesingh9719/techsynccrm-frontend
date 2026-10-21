import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Skeleton } from '../app/States'
import { nextPathFor, useAuth, type StagePath } from '../../lib/useAuth'

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-app space-y-6 p-6" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <Skeleton className="h-64" />
    </div>
  )
}

/**
 * Only renders `children` for a signed-in user whose next step is `path`
 * ('/verify-email', '/onboarding' or '/app'); everyone else is redirected to where they belong.
 */
export function RequireStage({ path, children }: { path: StagePath; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  const next = nextPathFor(user)
  if (next !== path) return <Navigate to={next} replace />
  return <>{children}</>
}

/**
 * For login/sign-up: a signed-in user is sent on to their next step instead — or back to the
 * protected page they originally asked for, once they've finished verification and onboarding.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (user) {
    const next = nextPathFor(user)
    const from = (location.state as { from?: string } | null)?.from
    // Back to the page they asked for: an app page once set up, or an invitation link at any stage.
    const target = from?.startsWith('/invite') ? from : next === '/app' && from?.startsWith('/app') ? from : next
    return <Navigate to={target} replace />
  }
  return <>{children}</>
}
