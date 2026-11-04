/** Workspace roles (RBAC): read by everyone, managed by owners and admins. */
import type { PermissionCatalogue, Role, RoleList, RolePreview } from '../types'
import { api } from './http'

export function listRoles() {
  return api<RoleList>('/roles')
}

export function getCatalogue() {
  return api<PermissionCatalogue>('/roles/catalogue')
}

export type NewRole = { name: string; description?: string | null; color?: string | null; copyFrom?: string | null }

export function createRole(values: NewRole) {
  return api<{ role: Role }>('/roles', { method: 'POST', body: values }).then((d) => d.role)
}

/** `expectedVersion` is the role's `version` when the editor loaded it. Built-in roles ignore name and description. */
export function updateRole(id: string, values: { name?: string; description?: string | null; permissions?: string[]; color?: string | null; expectedVersion: number }) {
  return api<{ role: Role }>(`/roles/${id}`, { method: 'PATCH', body: values }).then((d) => d.role)
}

export function resetRole(id: string, expectedVersion: number) {
  return api<{ role: Role }>(`/roles/${id}/reset`, { method: 'POST', body: { expectedVersion } }).then((d) => d.role)
}

/** Deletes a custom role; its members and invitations move to `reassignTo` (a role id or built-in key). */
export function deleteRole(id: string, reassignTo: string) {
  return api<{ deleted: true }>(`/roles/${id}`, { method: 'DELETE', body: { reassignTo } })
}

export function previewRole(roleId: string, permissions: string[]) {
  return api<RolePreview>('/roles/preview', { method: 'POST', body: { roleId, permissions } })
}
