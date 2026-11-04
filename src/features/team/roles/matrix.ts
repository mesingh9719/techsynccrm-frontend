import type { MemberRole, ModuleAction, PermissionModule, PermissionScope, Role } from '../../../types'

/**
 * Pure helpers for the role editor: turning a module's switch, "which records" choice and action
 * checkboxes into permission strings. They keep a role consistent as you click (ticking an action
 * ticks what it needs; unticking one unticks what depends on it), mirroring the server's
 * `rolePermissionProblems` in backend config/permissions.js. The server always re-checks.
 */

export const SCOPES: PermissionScope[] = ['all', 'team', 'own']

/** Modules where records nobody owns yet are visible to everyone who can see the module (backend lib/visibility.js). */
const UNOWNED_VISIBLE = ['leads', 'contacts', 'companies']

/** "Which records" option label per scope. */
export function scopeChoice(module: PermissionModule, scope: PermissionScope) {
  if (!module.records) return { own: 'Only their own numbers', team: 'Their own and their team’s numbers', all: 'Numbers for the whole workspace' }[scope]
  const noun = module.label.toLowerCase().replace(/ and follow-ups$/, '')
  if (scope === 'own') return `Only ${noun} assigned to them`
  if (scope === 'team') return `${module.label.replace(/ and follow-ups$/, '')} of the teams they manage`
  return `All ${noun} in the workspace`
}

/** One sentence under the "which records" choice explaining exactly what it covers. */
export function scopeExplanation(module: PermissionModule, scope: PermissionScope) {
  const noun = module.label.toLowerCase().replace(/ and follow-ups$/, '')
  const unowned = UNOWNED_VISIBLE.includes(module.key) ? ', plus unassigned ones' : ''
  if (!module.records) {
    if (scope === 'own') return 'Counts only their own records.'
    if (scope === 'team') return 'Counts their own and their team’s records.'
    return 'Counts every record.'
  }
  if (scope === 'own') return `Their own ${noun}${unowned}.`
  if (scope === 'team') return `Their own and their team members’ ${noun}${unowned}. Team managers are set in the Teams tab.`
  return `Every ${noun.replace(/s$/, '').replace(/ie$/, 'y')}, whoever it’s assigned to.`
}

const sorted = (perms: Iterable<string>) => [...new Set(perms)].sort()

const accessOf = (m: PermissionModule) => (m.records ? `${m.key}.read` : (m.access ?? null))
export const permissionOf = (m: PermissionModule, a: ModuleAction) => (m.records ? `${m.key}.${a.key}` : a.key)
const restricted = (a: ModuleAction) => Boolean(a.ownerOnly || a.adminOnly)

function scopeOfBase(perms: readonly string[], base: string): PermissionScope | null {
  return SCOPES.find((s) => perms.includes(`${base}.${s}`)) ?? null
}

/** The module's "which records" scope, or null when it has none / is off. */
export function moduleScope(perms: readonly string[], m: PermissionModule) {
  const access = accessOf(m)
  return access ? scopeOfBase(perms, access) : null
}

export function hasAction(perms: readonly string[], m: PermissionModule, a: ModuleAction) {
  const base = permissionOf(m, a)
  return a.scoped ? Boolean(scopeOfBase(perms, base)) : perms.includes(base)
}

export function isModuleOn(perms: readonly string[], m: PermissionModule) {
  return accessOf(m) ? Boolean(moduleScope(perms, m)) : m.actions.some((a) => !restricted(a) && hasAction(perms, m, a))
}

/** Whether an action can be ticked with the module's current scope (sales targets need team or all). */
export function actionAvailable(perms: readonly string[], m: PermissionModule, a: ModuleAction) {
  if (restricted(a)) return false
  if (!a.scoped || !a.scopes) return true
  const scope = moduleScope(perms, m)
  return !scope || a.scopes.includes(scope)
}

function withoutAction(perms: string[], m: PermissionModule, a: ModuleAction) {
  const base = permissionOf(m, a)
  return perms.filter((p) => p !== base && !SCOPES.some((s) => p === `${base}.${s}`))
}

function withAction(perms: string[], m: PermissionModule, a: ModuleAction) {
  const scope = moduleScope(perms, m) ?? 'all'
  const next = withoutAction(perms, m, a)
  next.push(a.scoped ? `${permissionOf(m, a)}.${scope}` : permissionOf(m, a))
  return next
}

/** Actions that (directly or not) need `key`. */
function dependents(m: PermissionModule, key: string): ModuleAction[] {
  const out = new Map<string, ModuleAction>()
  const visit = (k: string) => {
    for (const a of m.actions) if (a.requires?.includes(k) && !out.has(a.key)) { out.set(a.key, a); visit(a.key) }
  }
  visit(key)
  return [...out.values()]
}

/** Turns an action on (with everything it needs) or off (with everything that needs it). */
export function toggleAction(perms: readonly string[], m: PermissionModule, a: ModuleAction, on: boolean) {
  let next = [...perms]
  if (on) {
    const add = (action: ModuleAction) => {
      next = withAction(next, m, action)
      for (const req of action.requires ?? []) {
        const needed = m.actions.find((x) => x.key === req)
        if (needed && !hasAction(next, m, needed)) add(needed)
      }
    }
    if (accessOf(m) && !moduleScope(next, m)) next.push(`${accessOf(m)}.${defaultScope(m)}`)
    add(a)
  } else {
    next = withoutAction(next, m, a)
    for (const d of dependents(m, a.key)) next = withoutAction(next, m, d)
  }
  return sorted(next)
}

// New access starts narrow: records assigned to them, their own reports.
const defaultScope = (_m: PermissionModule): PermissionScope => 'own'

/** Switches a module on (seeing the list and details, records assigned to them) or off (nothing). */
export function setModule(perms: readonly string[], m: PermissionModule, on: boolean) {
  const access = accessOf(m)
  let next = perms.filter((p) => !(access && SCOPES.some((s) => p === `${access}.${s}`)))
  for (const a of m.actions) if (!restricted(a)) next = withoutAction(next, m, a)
  if (!on) return sorted(next)
  if (access) next.push(`${access}.${defaultScope(m)}`)
  const starters = m.records ? m.actions.filter((a) => ['list', 'view'].includes(a.key)) : m.actions.filter((a) => !restricted(a)).slice(0, 1)
  for (const a of starters) next = toggleAction(next, m, a, true)
  return sorted(next)
}

/** Changes "which records": every scoped action follows; ones that can't (sales targets on "own") are removed. */
export function setScope(perms: readonly string[], m: PermissionModule, scope: PermissionScope) {
  const access = accessOf(m)
  if (!access) return [...perms]
  let next = perms.filter((p) => !SCOPES.some((s) => p === `${access}.${s}`))
  next.push(`${access}.${scope}`)
  for (const a of m.actions) {
    if (!a.scoped || !hasAction(next, m, a)) continue
    next = withoutAction(next, m, a)
    if (!a.scopes || a.scopes.includes(scope)) next.push(`${permissionOf(m, a)}.${scope}`)
  }
  return sorted(next)
}

/** "Only assigned to them · 4 of 13" for a module's collapsed summary. */
export function moduleSummary(perms: readonly string[], m: PermissionModule) {
  if (!isModuleOn(perms, m)) return 'No access'
  const actions = m.actions.filter((a) => !restricted(a))
  const held = actions.filter((a) => hasAction(perms, m, a)).length
  const scope = moduleScope(perms, m)
  return `${scope ? `${scopeChoice(m, scope)} · ` : ''}${held} of ${actions.length}`
}

// ---------- Role chips ----------

/** Chip accent per built-in role (custom colour first). */
export const DEFAULT_ROLE_COLOR: Record<MemberRole, string> = { owner: 'amber', admin: 'brand', manager: 'emerald', sales_rep: 'sky', viewer: 'slate' }
export const roleColor = (role: Pick<Role, 'color' | 'key'>) => role.color ?? (role.key ? DEFAULT_ROLE_COLOR[role.key] : 'violet')

/** Static class names per colour, so Tailwind keeps them. */
export const COLOR_DOT: Record<string, string> = {
  slate: 'bg-slate-500',
  brand: 'bg-brand-600',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
}
