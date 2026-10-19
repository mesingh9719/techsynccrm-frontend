/** Auth API calls. Each successful sign-in-type call updates the in-memory session (see http.ts). */
import type { AuthUser } from '../types'
import type { LoginValues, OnboardingValues, SignupValues } from '../lib/schemas'
import { api, clearSession, refreshSession, setSession, updateSessionUser, type SessionPayload } from './http'

let initPromise: Promise<boolean> | null = null

/** Restores the session from the refresh cookie on page load. Safe to call more than once. */
export function initAuth() {
  initPromise ??= refreshSession().catch(() => false)
  return initPromise
}

export async function signup(values: SignupValues) {
  const { terms, ...rest } = values
  const data = await api<SessionPayload & { verificationEmailSent: boolean }>('/auth/signup', {
    method: 'POST',
    body: { ...rest, acceptTerms: terms },
    retryOnExpiry: false,
  })
  setSession(data)
  return data
}

export type LoginResult = { twoFactorRequired: true; challengeToken: string } | { twoFactorRequired?: false; user: AuthUser }

/** Step 1. Accounts with 2FA get a challenge token instead of a session. */
export async function login(values: LoginValues): Promise<LoginResult> {
  const data = await api<SessionPayload | { twoFactorRequired: true; challengeToken: string }>('/auth/login', {
    method: 'POST',
    body: values,
    retryOnExpiry: false,
  })
  if ('twoFactorRequired' in data) return data
  setSession(data)
  return { user: data.user }
}

/** Step 2 for 2FA accounts: the authenticator code, or one recovery code. */
export async function loginSecondFactor(challengeToken: string, factor: { code: string } | { recoveryCode: string }) {
  const data = await api<SessionPayload>('/auth/login/2fa', { method: 'POST', body: { challengeToken, ...factor }, retryOnExpiry: false })
  setSession(data)
  return data.user
}

/** Accept the current Terms and Privacy Policy (shown when they've changed). */
export async function acceptTerms(versions: { termsVersion: string; privacyVersion: string }) {
  const { user } = await api<{ user: AuthUser }>('/auth/accept-terms', { method: 'POST', body: versions })
  updateSessionUser(user)
  return user
}

export function confirmEmailChange(token: string) {
  return api<{ email: string }>('/auth/confirm-email-change', { method: 'POST', body: { token }, retryOnExpiry: false })
}

export function cancelEmailChange(token: string) {
  return api<{ email: string; reverted: boolean }>('/auth/cancel-email-change', { method: 'POST', body: { token }, retryOnExpiry: false })
}

// ---------- Invitations (M04) ----------

export interface InvitationPreview {
  organizationName: string
  inviterName: string | null
  email: string
  role: string
  status: 'pending' | 'expired' | 'accepted' | 'revoked'
  accountExists: boolean
}

export function lookupInvitation(token: string) {
  return api<{ invitation: InvitationPreview }>(`/public/invitations/${encodeURIComponent(token)}`, { retryOnExpiry: false }).then((d) => d.invitation)
}

/** New person: create the account through the invitation (signed in afterwards). */
export async function signupWithInvite(values: { token: string; fullName: string; password: string; jobRole?: string; acceptTerms: true }) {
  const data = await api<SessionPayload>('/auth/signup-with-invite', { method: 'POST', body: values, retryOnExpiry: false })
  setSession(data)
  return data.user
}

/** Signed-in person accepts; the session switches to the workspace. */
export async function acceptInvitation(token: string) {
  const data = await api<SessionPayload>('/auth/accept-invitation', { method: 'POST', body: { token } })
  setSession(data)
  return data.user
}

export async function logout({ everywhere = false } = {}) {
  try {
    if (everywhere) await api('/auth/logout-all', { method: 'POST' })
    else await api('/auth/logout', { method: 'POST', retryOnExpiry: false })
  } finally {
    clearSession()
  }
}

export async function fetchMe() {
  const { user } = await api<{ user: AuthUser }>('/auth/me')
  updateSessionUser(user)
  return user
}

// Verification links can be opened twice in React StrictMode; reuse the in-flight request per token.
const verifyRequests = new Map<string, Promise<AuthUser>>()

export function verifyEmail(token: string) {
  let request = verifyRequests.get(token)
  if (!request) {
    request = api<SessionPayload>('/auth/verify-email', { method: 'POST', body: { token }, retryOnExpiry: false }).then((data) => {
      setSession(data)
      return data.user
    })
    verifyRequests.set(token, request)
  }
  return request
}

export function resendVerification() {
  return api<{ sentTo: string; retryAfter: number }>('/auth/resend-verification', { method: 'POST' })
}

export function forgotPassword(email: string) {
  return api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, retryOnExpiry: false })
}

export function resetPassword(token: string, password: string) {
  return api<{ passwordReset: true }>('/auth/reset-password', { method: 'POST', body: { token, password }, retryOnExpiry: false })
}

/** Saves the profile and creates the workspace; the response carries a token for that workspace. */
export async function completeOnboarding(values: OnboardingValues) {
  const data = await api<SessionPayload>('/users/me/onboarding', { method: 'PUT', body: values })
  setSession(data)
  return data.user
}
