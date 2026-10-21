import type { MemberRole } from '../types'

/**
 * Permission checks for the UI. The member's permission list comes from the server with the
 * session (AuthUser.organization.permissions — see backend config/permissions.js); the backend
 * always enforces, this only decides what to show.
 *
 * Strings are `<resource>.<action>` or `<resource>.<action>.<scope>`; asking for `leads.read`
 * matches any scope (all / team / own).
 */
export type Permission =
  | 'reports.read'
  | 'settings.forms.manage'
  | 'settings.assignment.manage'
  | 'settings.workspace.manage'
  | 'settings.security.manage'
  | 'settings.billing.manage'
  | 'organization.delete'
  | 'ownership.transfer'
  | 'members.invite'
  | 'members.manage'
  | 'members.manage.admins'
  | 'records.import'
  | 'records.export'
  | 'records.assign'
  | 'records.claim'
  | 'settings.customFields.manage'
  | 'settings.pipelines.manage'
  | `${'leads' | 'contacts' | 'companies' | 'deals' | 'tasks' | 'campaigns'}.${'read' | 'create' | 'update' | 'delete'}`

export function hasPermission(permissions: readonly string[] | undefined, permission: Permission) {
  return Boolean(permissions?.some((p) => p === permission || p.startsWith(`${permission}.`)))
}

export const roleLabels: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  sales_rep: 'Sales rep',
  viewer: 'Viewer',
}

/** One-line summaries shown when picking a role. */
export const roleDescriptions: Record<MemberRole, string> = {
  owner: 'Full control, including billing and deleting the workspace.',
  admin: 'Manages settings and the team; sees all records.',
  manager: 'Sees and edits records owned by the teams they manage.',
  sales_rep: 'Works their own records and can claim unassigned leads.',
  viewer: 'Read-only access to all records and reports.',
}

/** Roles that can be given by invitation or role change (owner only via transfer). */
export const assignableRoles: MemberRole[] = ['admin', 'manager', 'sales_rep', 'viewer']
