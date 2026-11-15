/** Team management for the current workspace (M04): members, invitations, teams. */
import type { Invitation, Member, MemberOption, Team } from '../types'
import { api } from './http'

export function listMembers(params: { status?: 'active' | 'deactivated' | 'all'; q?: string; cursor?:string } = {}) {
  return api<{ members: Member[] }>('/members', { query: params }).then((d) => d.members)
}

/** Light list of active members for pickers. */
export function memberOptions(q?: string, ids?:string[]) {
  return api<{ members: MemberOption[] }>('/members/options', { query: { q, ids:ids?.join(',') } }).then((d) => d.members)
}

export function updateMember(userId: string, values: { role?: string; title?: string | null; teamIds?: string[] }) {
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

export function createInvitations(values: { emails: string[]; role: string; teamIds?: string[] }) {
  return api<{ results: InviteResult[] }>('/invitations', { method: 'POST', body: values }).then((d) => d.results)
}

export function resendInvitation(id: string) {
  return api<{ resent: true }>(`/invitations/${id}/resend`, { method: 'POST' })
}

export function revokeInvitation(id: string) {
  return api<void>(`/invitations/${id}`, { method: 'DELETE' })
}

export type TeamInput = { name?: string; members?: { userId: string; isManager: boolean }[] }

export function listTeams(params: {q?:string;cursor?:string} = {}) {
  return api<{ teams: Team[] }>('/teams',{query:params}).then((d) => d.teams)
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

export async function listMembersPage(params: {status?:'active'|'deactivated'|'all';q?:string;cursor?:string} = {}) {
  const page = await api<{members:Member[];nextCursor:string|null}>('/members',{query:params})
  return {items:page.members,nextCursor:page.nextCursor}
}
export async function listTeamsPage(params: {q?:string;cursor?:string} = {}) {
  const page = await api<{teams:Team[];nextCursor:string|null}>('/teams',{query:params})
  return {items:page.teams,nextCursor:page.nextCursor}
}
