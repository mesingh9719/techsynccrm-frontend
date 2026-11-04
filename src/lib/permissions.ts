import type { MemberRole } from '../types'

/**
 * Permission checks for the UI. The member's permission list comes from the server with the
 * session (AuthUser.organization.permissions — see backend config/permissions.js); the backend
 * always enforces, this only decides what to show.
 *
 * Strings are `<resource>.<action>` or `<resource>.<action>.<scope>`; asking for `leads.read`
 * matches any scope (all / team / own). Only scope suffixes match: `members.manage` does not
 * match `members.manage.admins`. Keep in step with MODULES in backend config/permissions.js.
 *
 * Record modules: `read` = the module is on (and which records); `list` = see the list page;
 * `view` = open details; `contactInfo` = see phone numbers and emails (otherwise the server
 * removes them and sets `contactInfoHidden`); plus actions such as `call`, `status`, `assign`.
 */
export type RecordModule = 'leads' | 'contacts' | 'companies' | 'deals' | 'tasks' | 'campaigns'
export type RecordAction = 'read' | 'list' | 'view' | 'contactInfo' | 'call' | 'create' | 'update' | 'status' | 'assign' | 'claim' | 'convert' | 'delete' | 'import' | 'export'

export type Permission =
  | 'reports.export'
  | 'google.connect.own'
  | 'google.connections.manage'
  | 'google.settings.manage'
  | 'email.connect'
  | 'email.send'
  | 'email.connections.manage'
  | 'email.templates.write.own'
  | 'email.templates.manage'
  | 'reports.read'
  | 'targets.manage'
  | 'settings.forms.manage'
  | 'settings.automation.manage'
  | 'settings.workspace.manage'
  | 'settings.security.manage'
  | 'settings.billing.manage'
  | 'organization.delete'
  | 'ownership.transfer'
  | 'members.invite'
  | 'members.manage'
  | 'members.manage.admins'
  | 'roles.manage'
  | 'files.upload'
  | 'files.manage'
  | 'settings.customFields.manage'
  | 'settings.pipelines.manage'
  | `${RecordModule}.${RecordAction}`

const SCOPES = ['all', 'team', 'own']
const RECORD_MODULES: RecordModule[] = ['leads', 'contacts', 'companies', 'deals', 'tasks', 'campaigns']

export function hasPermission(permissions: readonly string[] | undefined, permission: Permission) {
  return Boolean(permissions?.some((p) => p === permission || (p.startsWith(`${permission}.`) && SCOPES.includes(p.slice(permission.length + 1)))))
}

/** Whether the member may do `action` (import, export…) on at least one record module. */
export function hasAnyRecordAction(permissions: readonly string[] | undefined, action: RecordAction) {
  return RECORD_MODULES.some((m) => hasPermission(permissions, `${m}.${action}`))
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
