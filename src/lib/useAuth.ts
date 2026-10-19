import { useSyncExternalStore } from 'react'
import { authStore } from '../services/http'
import type { AuthUser } from '../types'

/** Current auth state: { status: 'loading' | 'authenticated' | 'anonymous', user }. */
export function useAuth() {
  return useSyncExternalStore(authStore.subscribe, authStore.getState)
}

export type StagePath = '/verify-email' | '/onboarding' | '/setup-2fa' | '/app'

/**
 * Where a signed-in user belongs next: verify email → onboarding (creates a workspace) →
 * set up 2FA (only if the workspace requires it) → app.
 */
export function nextPathFor(user: AuthUser): StagePath {
  if (!user.emailVerified) return '/verify-email'
  if (!user.organization) return '/onboarding'
  if (user.organization.require2fa && !user.twoFactorEnabled) return '/setup-2fa'
  return '/app'
}
