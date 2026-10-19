/** The signed-in person's own account (M05): profile, password, email, sessions, 2FA, deletion. */
import type { AuthUser, UserSession } from '../types'
import { api, clearSession, updateSessionUser } from './http'

export interface ProfileUpdate {
  fullName?: string
  jobRole?: string | null
  phone?: string | null
  avatarFileId?: string | null
  timezone?: string | null
}

export async function updateProfile(values: ProfileUpdate) {
  const { user } = await api<{ user: AuthUser }>('/users/me', { method: 'PATCH', body: values })
  updateSessionUser(user)
  return user
}

export function changePassword(values: { currentPassword: string; newPassword: string }) {
  return api<{ passwordChanged: true }>('/users/me/password', { method: 'POST', body: values })
}

export function requestEmailChange(values: { newEmail: string; password: string }) {
  return api<{ pendingEmail: string }>('/users/me/email', { method: 'POST', body: values })
}

export function discardEmailChange() {
  return api<{ pendingEmail: null }>('/users/me/email', { method: 'DELETE' })
}

export function listSessions() {
  return api<{ sessions: UserSession[] }>('/users/me/sessions').then((d) => d.sessions)
}

export function revokeSession(id: string) {
  return api<{ revoked: true }>(`/users/me/sessions/${id}`, { method: 'DELETE' })
}

export function revokeOtherSessions() {
  return api<{ revoked: true }>('/users/me/sessions', { method: 'DELETE' })
}

// ---------- Two-factor authentication ----------

export interface TwoFactorStatus {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesRemaining: number
}

export type Reauth = { password: string } & ({ code: string } | { recoveryCode: string })

export function getTwoFactorStatus() {
  return api<TwoFactorStatus>('/users/me/2fa')
}

export function startTwoFactorSetup() {
  return api<{ secret: string; otpauthUrl: string }>('/users/me/2fa/setup', { method: 'POST' })
}

export function enableTwoFactor(code: string) {
  return api<{ recoveryCodes: string[] }>('/users/me/2fa/enable', { method: 'POST', body: { code } })
}

export function disableTwoFactor(values: Reauth) {
  return api<{ enabled: false }>('/users/me/2fa/disable', { method: 'POST', body: values })
}

export function regenerateRecoveryCodes(values: Reauth) {
  return api<{ recoveryCodes: string[] }>('/users/me/2fa/recovery-codes', { method: 'POST', body: values })
}

/** Deletes the account and signs out. */
export async function deleteAccount(password: string) {
  await api<{ deleted: true }>('/users/me', { method: 'DELETE', body: { password } })
  clearSession()
}
