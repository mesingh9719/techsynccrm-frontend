/** Workspace (organization) API — /api/organizations. */
import type { MemberRole, Organization, OrganizationSummary, PlanId } from '../types'
import { api, setSession, upload, type SessionPayload } from './http'

export interface WorkspaceListItem extends OrganizationSummary {
  current: boolean
}

export interface CurrentOrganization {
  organization: Organization
  membership: { role: MemberRole; title: string | null; joinedAt: string | null }
}

export interface ChecklistItem {
  key: string
  title: string
  description: string
  href: string
  done: boolean
}

export type OrganizationUpdate = Partial<
  Pick<Organization, 'name' | 'slug' | 'industry' | 'teamSize' | 'logoFileId' | 'timezone' | 'currency' | 'country' | 'stateCode' | 'gstin' | 'legalName' | 'address' | 'require2fa'>
>

export function listOrganizations() {
  return api<{ organizations: WorkspaceListItem[] }>('/organizations').then((d) => d.organizations)
}

export function getCurrentOrganization(signal?: AbortSignal) {
  return api<CurrentOrganization>('/organizations/current', { signal })
}

export function updateCurrentOrganization(values: OrganizationUpdate) {
  return api<{ organization: Organization }>('/organizations/current', { method: 'PATCH', body: values }).then((d) => d.organization)
}

/** Switches the session to another workspace (new access token). Clear cached data afterwards. */
export async function switchOrganization(organizationId: string) {
  const data = await api<SessionPayload>('/auth/switch-organization', { method: 'POST', body: { organizationId } })
  setSession(data)
  return data.user
}

/** Creates another workspace and switches to it. */
export async function createOrganization(values: { company: string; industry: string; teamSize: string }) {
  const data = await api<SessionPayload>('/organizations', { method: 'POST', body: values })
  setSession(data)
  return data.user
}

/** Deletes the current workspace; the session moves to another workspace (or none). */
export async function deleteCurrentOrganization(confirmName: string) {
  const data = await api<SessionPayload>('/organizations/current', { method: 'DELETE', body: { confirmName } })
  setSession(data)
  return data.user
}

export function getChecklist() {
  return api<{ items: ChecklistItem[]; dismissed: boolean }>('/organizations/current/checklist')
}

export function dismissChecklist() {
  return api<{ dismissed: true }>('/organizations/current/checklist/dismiss', { method: 'POST' })
}

/** Uploads an image to the files API and returns its id (use as `logoFileId`). */
export async function uploadImage(file: File, onProgress?: (fraction: number) => void) {
  const { file: stored } = await upload<{ file: { id: string } }>('/files', file, { onProgress })
  return stored.id
}

// ---------- Plans (M06) ----------

/** Until self-serve billing (M16): asks our sales team to move the workspace to `plan`. */
export function requestUpgrade(values: { plan: Exclude<PlanId, 'starter'>; message?: string }) {
  return api<{ requested: PlanId }>('/organizations/current/upgrade-request', { method: 'POST', body: values })
}

/** Owner, after a downgrade: the members who keep access (everyone else is deactivated). */
export function selectSeats(keepUserIds: string[]) {
  return api<{ kept: string[]; deactivated: string[] }>('/organizations/current/seat-selection', { method: 'POST', body: { keepUserIds } })
}
