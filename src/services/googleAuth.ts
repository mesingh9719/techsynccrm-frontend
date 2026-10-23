import { api, setSession, type SessionPayload } from './http'

export interface GoogleStart { intent: 'signin' | 'signup'; plan?: 'starter' | 'growth' | 'business'; acceptTerms?: boolean; remember?: boolean; returnTo?: string }
export type GoogleResult = { twoFactorRequired: true; challengeToken: string; returnTo: string | null } | (SessionPayload & { twoFactorRequired?: false; returnTo: string | null })
export async function startGoogleSignIn(input: GoogleStart) {
  const { url } = await api<{ url: string }>('/auth/google/start', { method: 'POST', body: input, retryOnExpiry: false })
  const target = new URL(url)
  if (target.protocol !== 'https:' || target.hostname !== 'accounts.google.com' || target.username || target.password) throw new Error('The Google sign-in address is invalid.')
  window.location.assign(target.toString())
}
export async function completeGoogleSignIn() {
  const data = await api<GoogleResult>('/auth/google/complete', { method: 'POST', retryOnExpiry: false })
  if (!data.twoFactorRequired) setSession(data)
  return data
}
export function googleSignInError(code: string) {
  const messages: Record<string, string> = {
    GOOGLE_CANCELLED: 'Google sign-in was cancelled. You can try again.',
    GOOGLE_FLOW_EXPIRED: 'Your Google sign-in expired. Start again in the same browser.',
    GOOGLE_SIGNUP_REQUIRED: 'Create an account with Google first and accept the Terms and Privacy Policy.',
    GOOGLE_LINK_REQUIRED: 'Use your existing email sign-in. Verify your email or reset your password first. Existing external Google email addresses require email sign-in.',
    GOOGLE_ACCOUNT_UNAVAILABLE: 'This Google identity cannot sign in to this account. Use email sign-in or contact support.',
    GOOGLE_NOT_CONFIGURED: 'Google sign-in needs server configuration. You can still use email sign-in.',
    TERMS_OUTDATED: 'The terms changed. Start sign-up again and review the latest version.',
    ACCOUNT_LOCKED: 'Your account is temporarily locked. Try later or reset your password.',
  }
  return messages[code] ?? 'Google sign-in could not be completed. Please try again or sign in with email.'
}
