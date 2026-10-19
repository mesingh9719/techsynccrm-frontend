import { ApiError, refreshSession, authStore } from '../services/http'
import { fetchMe } from '../services/auth'
import { emitAppEvent } from './appEvents'
import { nextPathFor } from './useAuth'

/**
 * Global reactions to API error codes that mean the same thing on every screen. Called by the query
 * client for failed queries and mutations; screens still handle their own form/validation errors.
 * Returns true when the error was handled here (callers can then skip their own message).
 */
export function handleGlobalApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  switch (error.code) {
    case 'EMAIL_NOT_VERIFIED':
      void navigate('/verify-email')
      return true
    case 'TWO_FACTOR_REQUIRED':
      // The workspace started requiring 2FA: refresh the user (so the flag is known) and go set it up.
      void (async () => {
        await fetchMe().catch(() => {})
        await navigate('/setup-2fa')
      })()
      return true
    case 'ORG_REQUIRED':
      // Removed from the workspace, or it was deleted: refresh the session (the server picks
      // another workspace, if any) and send the user wherever they now belong.
      void recoverWorkspace(error.message)
      return true
    case 'SEAT_SUSPENDED':
      // Workspace downgraded with more members than seats; the owner hasn't chosen who stays yet.
      void navigate('/workspace-suspended')
      return true
    case 'PLAN_LIMIT_REACHED':
      emitAppEvent({
        type: 'upgrade',
        reason: 'limit',
        message: error.message,
        resource: error.details?.resource as string | undefined,
        requiredPlan: (error.details?.requiredPlan as string | null | undefined) ?? undefined,
      })
      return true
    case 'FEATURE_NOT_IN_PLAN':
      emitAppEvent({
        type: 'upgrade',
        reason: 'feature',
        message: error.message,
        feature: error.details?.feature as string | undefined,
        requiredPlan: error.details?.requiredPlan as string | undefined,
      })
      return true
    case 'FORBIDDEN':
      emitAppEvent({ type: 'toast', tone: 'error', title: 'Not allowed', description: error.message })
      return true
    case 'STALE_UPDATE':
      emitAppEvent({ type: 'toast', tone: 'error', title: 'Someone else changed this', description: 'We’ve reloaded the latest version — please make your change again.' })
      return true
    default:
      return false
  }
}

// The router is imported lazily to avoid a circular import (router → layouts → hooks → this file).
async function navigate(to: string) {
  const { router } = await import('../router')
  if (router.state.location.pathname !== to) await router.navigate(to, { replace: true })
}

let recovering = false
async function recoverWorkspace(message: string) {
  if (recovering) return
  recovering = true
  try {
    emitAppEvent({ type: 'toast', tone: 'error', title: 'Workspace unavailable', description: message })
    const ok = await refreshSession()
    const user = authStore.getState().user
    const { queryClient } = await import('./queryClient')
    queryClient.clear()
    await navigate(ok && user ? nextPathFor(user) : '/login')
  } finally {
    recovering = false
  }
}
