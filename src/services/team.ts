/** Team management for the current workspace (M04): members, invitations, teams. */
import type { Invitation, Member, MemberOption, MemberRole, Team } from '../types'
import { api } from './http'

export function listMembers(params: { status?: 'active' | 'deactivated' | 'all'; q?: string } = {}) {
  return api<{ members: Member[] }>('/members', { query: params }).then((d) => d.members)
}

/** Light list of active members for pickers. */
export function memberOptions(q?: string) {
  return api<{ members: MemberOption[] }>('/members/options', { query: { q } }).then((d) => d.members)
}

export function updateMember(userId: string, values: { role?: MemberRole; title?: string | null; teamIds?: string[] }) {
  return api<{ member: Member }>(`/members/${userId}`, { method: 'PATCH', body: values }).then((d) => d.member)
}

export function deactivateMember(userId: string, reassignToUserId: string) {
  return api<{ deactivated: true }>(`/members/${userId}/deactivate`, { method: 'POST', body: { reassignToUserId } })
}

export function reactivateMember(userId: string) {
  return api<{ reactivated: true }>(`/members/${userId}/reactivate`, { method: 'POST' })
}

export function transferOwnership(userId: string, password: string) {
  return api<{ transferred: true }>('/organizations/current/transfer-ownership', { method: 'POST', body: { userId, password } })
}

export type InviteResult = { email: string; status: 'invited' | 'already_member' | 'email_failed'; id?: string }

export function listInvitations() {
  return api<{ invitations: Invitation[] }>('/invitations').then((d) => d.invitations)
}

export function createInvitations(values: { emails: string[]; role: MemberRole; teamIds?: string[] }) {
  return api<{ results: InviteResult[] }>('/invitations', { method: 'POST', body: values }).then((d) => d.results)
}

export function resendInvitation(id: string) {
  return api<{ resent: true }>(`/invitations/${id}/resend`, { method: 'POST' })
}

export function revokeInvitation(id: string) {
  return api<void>(`/invitations/${id}`, { method: 'DELETE' })
}

export type TeamInput = { name?: string; members?: { userId: string; isManager: boolean }[] }

export function listTeams() {
  return api<{ teams: Team[] }>('/teams').then((d) => d.teams)
}

export function createTeam(values: TeamInput) {
  return api<{ team: Team }>('/teams', { method: 'POST', body: values }).then((d) => d.team)
}

export function updateTeam(id: string, values: TeamInput) {
  return api<{ team: Team }>(`/teams/${id}`, { method: 'PATCH', body: values }).then((d) => d.team)
}

export function deleteTeam(id: string) {
  return api<void>(`/teams/${id}`, { method: 'DELETE' })
}
