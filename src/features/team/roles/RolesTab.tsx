import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Building2,
  Contact,
  Copy,
  Handshake,
  ListChecks,
  Lock,
  MoreHorizontal,
  Mail,
  Megaphone,
  Paperclip,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { createRole, deleteRole, getCatalogue, listRoles, resetRole, updateRole } from '../../../services/roles'
import { ApiError } from '../../../services/http'
import { useAuth } from '../../../lib/useAuth'
import { qk } from '../../../lib/queryKeys'
import { cn } from '../../../lib/cn'
import type { ModuleAction, PermissionCatalogue, PermissionModule, PermissionScope, Role, RoleList } from '../../../types'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../../components/ui/Form'
import { Switch } from '../../../components/ui/Switch'
import { useToast } from '../../../components/ui/Toast'
import { ConfirmDialog, Dialog } from '../../../components/app/Dialog'
import { Menu, MenuItem, MenuSeparator } from '../../../components/app/Menu'
import { ErrorState, ListSkeleton } from '../../../components/app/States'
import { useUnsavedChanges } from '../../../components/app/useUnsavedChanges'
import { errorText } from '../teamData'
import { COLOR_DOT, actionAvailable, hasAction, isModuleOn, moduleScope, moduleSummary, roleColor, scopeChoice, scopeExplanation, setModule, setScope, toggleAction } from './matrix'

/**
 * Roles tab (Settings → Team & roles). A list of roles on the left; the selected role on the right
 * as one card per module: an on/off switch, "which records", and plain action checkboxes.
 * Owners and admins create roles ("Calling agent"), edit them and the built-in Manager, Sales rep
 * and Viewer; Owner and Admin are locked. Everyone else sees the same screen read-only.
 */

type Draft = { roleId: string; permissions: string[]; color: string | null; name: string; description: string }

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((p) => b.includes(p))
const isDirty = (d: Draft | null, r: Role) =>
  Boolean(d && (!sameSet(d.permissions, r.permissions) || d.color !== r.color || d.name.trim() !== r.name || (d.description.trim() || null) !== (r.description ?? null)))

export function RolesTab({ orgId, roleId, onRoleChange }: { orgId: string; roleId: string | null; onRoleChange: (id: string) => void }) {
  const { user } = useAuth()
  const keys = qk.org(orgId)
  const roles = useQuery({ queryKey: keys.roles, queryFn: listRoles })
  const catalogue = useQuery({ queryKey: keys.roleCatalogue, queryFn: getCatalogue, staleTime: Infinity })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [creating, setCreating] = useState<string | null | false>(false)
  const pending = useRef<string | null>(null)

  const list = roles.data?.roles ?? []
  const myRoleId = user?.organization?.roleId ?? user?.organization?.role ?? null
  const fallback = roles.data?.canManage ? list.find((r) => !r.locked) : list.find((r) => r.id === myRoleId)
  const selected = list.find((r) => r.id === roleId) ?? fallback ?? list[0]
  const live = draft && selected && draft.roleId === selected.id ? draft : null
  const dirty = Boolean(selected && isDirty(live, selected))

  const guard = useUnsavedChanges(dirty ? live : null, () => {
    setDraft(null)
    if (pending.current) onRoleChange(pending.current)
    pending.current = null
  })

  function select(id: string) {
    if (id === selected?.id) return
    pending.current = id
    guard.requestClose()
  }

  if (roles.isPending || catalogue.isPending) return <ListSkeleton rows={6} />
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
  if (catalogue.isError) return <ErrorState error={catalogue.error} onRetry={() => catalogue.refetch()} />
  if (!selected) return null

  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 items-start gap-4 @2xl:grid-cols-[13rem_minmax(0,1fr)]">
        <RoleRail
          roles={list}
          selectedId={selected.id}
          myRoleId={myRoleId}
          dirtyId={dirty ? selected.id : null}
          canManage={roles.data.canManage}
          onSelect={select}
          onCreate={() => setCreating(null)}
        />
        <RoleEditor
          key={`${selected.id}:${selected.version}`}
          orgId={orgId}
          role={selected}
          list={roles.data}
          catalogue={catalogue.data}
          isMine={selected.id === myRoleId}
          draft={live}
          dirty={dirty}
          onDraft={(next) => setDraft(next && { ...next, roleId: selected.id })}
          onSaved={() => {
            guard.markSaved(null)
            setDraft(null)
          }}
          onDuplicate={() => setCreating(selected.id)}
          onDeleted={(fallbackId) => {
            guard.markSaved(null)
            setDraft(null)
            onRoleChange(fallbackId)
          }}
        />
      </div>
      <NewRoleDialog
        open={creating !== false}
        copyFrom={creating || null}
        orgId={orgId}
        roles={list}
        onClose={() => setCreating(false)}
        onCreated={(role) => {
          setCreating(false)
          onRoleChange(role.id)
        }}
      />
      {guard.confirmation}
    </div>
  )
}

// ---------- Role list ----------

const membersLabel = (n: number) => (n === 0 ? 'No members yet' : `${n} ${n === 1 ? 'member' : 'members'}`)

/** Coloured tile with the role's initial; readable in light and dark themes. */
function RoleAvatar({ role, size = 'sm' }: { role: Pick<Role, 'name' | 'color' | 'key'>; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center font-semibold text-white',
        size === 'lg' ? 'size-9 rounded-control text-sm' : 'size-6 rounded-md text-[11px]',
        COLOR_DOT[roleColor(role)],
      )}
      aria-hidden="true"
    >
      {role.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

function RoleRail({
  roles,
  selectedId,
  myRoleId,
  dirtyId,
  canManage,
  onSelect,
  onCreate,
}: {
  roles: Role[]
  selectedId: string
  myRoleId: string | null
  dirtyId: string | null
  canManage: boolean
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const builtIn = roles.filter((r) => r.system)
  const custom = roles.filter((r) => !r.system)
  const item = (role: Role) => {
    const active = role.id === selectedId
    return (
      <li key={role.id}>
        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          onClick={() => onSelect(role.id)}
          className={cn(
            'group relative flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
            active ? 'bg-brand-50' : 'hover:bg-surface-subtle',
          )}
        >
          <RoleAvatar role={role} />
          <span className="min-w-0 flex-1">
            <span className={cn('flex items-center gap-1.5 truncate text-[13px] leading-5', active ? 'font-semibold text-brand-800' : 'text-ink')}>
              <span className="truncate">{role.name}</span>
              {role.id === myRoleId && <span className="shrink-0 rounded bg-brand-100 px-1 py-px text-[10px] font-semibold tracking-wide text-brand-700 uppercase">You</span>}
            </span>
            <span className="block truncate text-[11px] leading-4 text-muted">{membersLabel(role.memberCount)}</span>
          </span>
          {dirtyId === role.id && <span className="size-2 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" aria-label="Unsaved changes" />}
          {role.locked && <Lock className="size-3.5 shrink-0 text-muted" aria-label="Can’t be edited" />}
          {role.system && role.customised && !role.locked && <span className="shrink-0 text-[11px] font-medium text-warning">Edited</span>}
        </button>
      </li>
    )
  }
  return (
    <nav aria-label="Roles" className="min-w-0 self-start rounded-card bg-surface p-1.5 ring-1 ring-line @2xl:sticky @2xl:top-4">
      <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-muted uppercase">Built-in</p>
      <ul className="grid gap-0.5 @md:grid-cols-2 @2xl:grid-cols-1">{builtIn.map(item)}</ul>
      <p className="mt-1.5 border-t border-line px-2 pt-2.5 pb-1 text-[10px] font-semibold tracking-wider text-muted uppercase">Your roles</p>
      {custom.length ? (
        <ul className="grid gap-0.5 @md:grid-cols-2 @2xl:grid-cols-1">{custom.map(item)}</ul>
      ) : (
        <p className="px-2 pb-1.5 text-[11px] leading-4 text-muted">Make roles that fit how your team works, like “Calling agent”.</p>
      )}
      {canManage && (
        <Button variant="secondary" size="sm" className="mt-1.5 h-8 w-full text-[13px]" onClick={onCreate}>
          <Plus className="size-4" aria-hidden="true" />
          New role
        </Button>
      )}
    </nav>
  )
}

// ---------- Editor ----------

const MODULE_ICON: Record<string, LucideIcon> = {
  leads: Target,
  contacts: Contact,
  companies: Building2,
  deals: Handshake,
  tasks: ListChecks,
  campaigns: Megaphone,
  reports: BarChart3,
  email: Mail,
  files: Paperclip,
  settings: Settings2,
  team: Users,
}

function RoleEditor({
  orgId,
  role,
  list,
  catalogue,
  isMine,
  draft,
  dirty,
  onDraft,
  onSaved,
  onDuplicate,
  onDeleted,
}: {
  orgId: string
  role: Role
  list: RoleList
  catalogue: PermissionCatalogue
  isMine: boolean
  draft: Draft | null
  dirty: boolean
  onDraft: (next: Omit<Draft, 'roleId'> | null) => void
  onSaved: () => void
  onDuplicate: () => void
  onDeleted: (fallbackId: string) => void
}) {
  const queryClient = useQueryClient()
  const notify = useToast()
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const current: Omit<Draft, 'roleId'> = draft ?? { permissions: role.permissions, color: role.color, name: role.name, description: role.description ?? '' }
  const perms = current.permissions
  const readOnly = !role.editable
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).roles, exact: true })
  const change = (patch: Partial<Omit<Draft, 'roleId'>>) => onDraft({ ...current, ...patch })

  const save = useMutation({
    mutationFn: () =>
      updateRole(role.id, {
        ...(!sameSet(perms, role.permissions) && { permissions: perms }),
        ...(current.color !== role.color && { color: current.color }),
        ...(!role.system && current.name.trim() !== role.name && { name: current.name.trim() }),
        ...(!role.system && (current.description.trim() || null) !== (role.description ?? null) && { description: current.description.trim() || null }),
        expectedVersion: role.version,
      }),
    meta: { skipGlobalErrorHandler: true },
    onSuccess: async (saved) => {
      onSaved()
      await refresh()
      notify({ title: `${saved?.name ?? role.name} saved`, description: role.memberCount ? `${role.memberCount} ${role.memberCount === 1 ? 'member has' : 'members have'} the new access now.` : undefined })
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') {
        onSaved()
        await refresh()
        notify({ tone: 'error', title: 'Someone else changed this role', description: 'We’ve loaded the latest version. Make your changes again.' })
        return
      }
      notify({ tone: 'error', title: 'Couldn’t save the role', description: errorText(err) })
    },
  })

  const reset = useMutation({
    mutationFn: () => resetRole(role.id, role.version),
    onSuccess: async () => {
      onSaved()
      await refresh()
      notify({ title: `${role.name} is back to its defaults` })
    },
  })

  return (
    <div className="min-w-0 space-y-3">
      <section className="overflow-hidden rounded-card bg-surface ring-1 ring-line" aria-label={`${role.name} role`}>
        <div className="flex flex-col gap-3 px-4 py-3 @lg:flex-row @lg:items-center">
          <RoleAvatar role={{ ...role, name: current.name || role.name, color: current.color }} size="lg" />
          <div className="min-w-0 flex-1">
            {!role.system && !readOnly ? (
              <div className="space-y-0.5">
                <label className="sr-only" htmlFor="role-name">
                  Role name
                </label>
                <input
                  id="role-name"
                  value={current.name}
                  onChange={(e) => change({ name: e.target.value })}
                  maxLength={40}
                  className="w-full rounded-control border-0 bg-transparent px-2 py-1 -ml-2 text-base font-semibold text-ink ring-0 hover:bg-surface-subtle focus:bg-surface-subtle focus:ring-2 focus:ring-brand-500"
                />
                <label className="sr-only" htmlFor="role-description">
                  Description
                </label>
                <input
                  id="role-description"
                  value={current.description}
                  onChange={(e) => change({ description: e.target.value })}
                  maxLength={160}
                  placeholder="What is this role for? (optional)"
                  className="w-full rounded-control border-0 bg-transparent px-2 py-0.5 -ml-2 text-[13px] text-muted ring-0 placeholder:text-zinc-400 hover:bg-surface-subtle focus:bg-surface-subtle focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">{role.name}</h2>
                  {role.locked && (
                    <Badge>
                      <Lock className="size-3" aria-hidden="true" />
                      Can’t be edited
                    </Badge>
                  )}
                  {role.system && role.customised && <Badge tone="warning">Edited</Badge>}
                  {isMine && <Badge tone="brand">Your role</Badge>}
                </div>
                {role.description && <p className="text-[13px] text-muted">{role.description}</p>}
              </>
            )}
          </div>
          {list.canManage && (
            <div className="flex shrink-0 items-center gap-2">
              {!readOnly && (
                <Menu
                  align="end"
                  trigger={(props) => (
                    <button type="button" {...props} className="grid size-8 place-items-center rounded-control ring-1 ring-line hover:bg-surface-subtle" aria-label="Role colour" title="Colour">
                      <span className={cn('size-3.5 rounded-full', COLOR_DOT[current.color ?? roleColor(role)])} aria-hidden="true" />
                    </button>
                  )}
                >
                  {(close) => (
                    <div role="radiogroup" aria-label="Role colour" className="grid grid-cols-4 gap-1.5 p-2">
                      {catalogue.colors.map((c) => {
                        const active = (current.color ?? roleColor(role)) === c
                        return (
                          <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={c}
                            onClick={() => {
                              change({ color: role.key && c === roleColor({ color: null, key: role.key }) ? null : c })
                              close()
                            }}
                            className={cn('grid size-8 place-items-center rounded-control hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none', active && 'ring-2 ring-ink')}
                          >
                            <span className={cn('size-4 rounded-full', COLOR_DOT[c])} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </Menu>
              )}
              <Menu
                align="end"
                trigger={(props) => (
                  <button type="button" {...props} disabled={dirty} className="grid size-8 place-items-center rounded-control text-muted ring-1 ring-line hover:bg-surface-subtle hover:text-ink disabled:opacity-50" aria-label={`More actions for ${role.name}`} title={dirty ? 'Save or discard your changes first' : undefined}>
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem icon={<Copy className="size-4" />} onSelect={() => (close(), onDuplicate())}>
                      Duplicate as a new role
                    </MenuItem>
                    {role.system && role.customised && !role.locked && (
                      <MenuItem icon={<RotateCcw className="size-4" />} onSelect={() => (close(), setResetting(true))}>
                        Reset to built-in permissions
                      </MenuItem>
                    )}
                    {!role.system && (
                      <>
                        <MenuSeparator />
                        <MenuItem tone="danger" icon={<Trash2 className="size-4" />} onSelect={() => (close(), setDeleting(true))}>
                          Delete role
                        </MenuItem>
                      </>
                    )}
                  </>
                )}
              </Menu>
            </div>
          )}
        </div>
        <RoleStats role={role} perms={perms} modules={catalogue.modules} />
        <RoleNotice role={role} canManage={list.canManage} isMine={isMine} />
      </section>

      {(['records', 'other'] as const).map((group) => (
        <div key={group} className="space-y-1.5">
          <h3 className="px-1 pt-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">{group === 'records' ? 'Records' : 'Everything else'}</h3>
          {catalogue.modules
            .filter((m) => (group === 'records') === m.records)
            .map((m) => (
              <ModuleCard key={m.key} module={m} perms={perms} saved={role.permissions} readOnly={readOnly} locked={role.locked} onChange={(next) => change({ permissions: next })} />
            ))}
        </div>
      ))}

      {!readOnly && (
        <div
          className={cn(
            'sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-float ring-1 ring-line transition',
            dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
          )}
          role="region"
          aria-label="Unsaved role changes"
          aria-hidden={!dirty}
        >
          <p className="flex min-w-0 items-center gap-2 text-sm text-ink" aria-live="polite">
            <span className="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="truncate">Unsaved changes to {current.name.trim() || role.name}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" className="h-8" tabIndex={dirty ? 0 : -1} onClick={() => onDraft(null)}>
              Discard
            </Button>
            <Button size="sm" className="h-8" tabIndex={dirty ? 0 : -1} loading={save.isPending} disabled={!role.system && current.name.trim().length < 2} onClick={() => save.mutate()}>
              Save
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={resetting}
        onClose={() => setResetting(false)}
        title={`Reset ${role.name}?`}
        description="The built-in permissions apply again and your changes to this role are removed."
        confirmLabel="Reset role"
        onConfirm={async () => {
          await reset.mutateAsync()
          setResetting(false)
        }}
      />
      <DeleteRoleDialog
        open={deleting}
        role={role}
        roles={list.roles}
        onClose={() => setDeleting(false)}
        onDeleted={async (movedTo) => {
          setDeleting(false)
          await refresh()
          notify({ title: `${role.name} deleted` })
          onDeleted(movedTo)
        }}
      />
    </div>
  )
}

/** Members, modules switched on and actions allowed, as one quiet line. */
function RoleStats({ role, perms, modules }: { role: Role; perms: string[]; modules: PermissionModule[] }) {
  const on = modules.filter((m) => isModuleOn(perms, m)).length
  const actions = modules.reduce((n, m) => n + m.actions.filter((a) => hasAction(perms, m, a)).length, 0)
  const items = [membersLabel(role.memberCount), `${on} of ${modules.length} areas on`, `${actions} ${actions === 1 ? 'action' : 'actions'} allowed`]
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line bg-surface-subtle px-4 py-1.5 text-xs text-muted">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden="true">·</span>}
          {item}
        </span>
      ))}
    </p>
  )
}

function RoleNotice({ role, canManage, isMine }: { role: Role; canManage: boolean; isMine: boolean }) {
  let text: string | null = null
  if (role.key === 'owner') text = 'The owner can do everything, including billing and deleting the workspace.'
  else if (role.key === 'admin') text = 'Admins can do everything except billing, deleting the workspace and transferring ownership.'
  else if (!canManage) text = isMine ? 'This is your role. Ask an owner or admin if you need more access.' : 'Only owners and admins can change roles.'
  if (!text) return null
  return (
    <p className="flex items-start gap-2 border-t border-line px-4 py-2 text-xs text-muted">
      <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

// ---------- One module ----------

function ModuleCard({
  module: m,
  perms,
  saved,
  readOnly,
  locked,
  onChange,
}: {
  module: PermissionModule
  perms: string[]
  saved: string[]
  readOnly: boolean
  locked: boolean
  onChange: (next: string[]) => void
}) {
  const Icon = MODULE_ICON[m.key] ?? Settings2
  const on = isModuleOn(perms, m)
  const scope = moduleScope(perms, m)
  const changed = on !== isModuleOn(saved, m) || scope !== moduleScope(saved, m) || m.actions.some((a) => hasAction(perms, m, a) !== hasAction(saved, m, a))
  const scopes = (m.records ? ['own', 'team', 'all'] : (m.scopes ?? []).slice().reverse()) as PermissionScope[]

  return (
    <section className={cn('rounded-card bg-surface ring-1 transition-colors', on ? 'ring-brand-200' : 'ring-line')} aria-labelledby={`module-${m.key}`}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', on ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-muted')} aria-hidden="true">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`module-${m.key}`} className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            {m.label}
            {changed && <span className="size-1.5 rounded-full bg-amber-400" title="Changed" aria-label="Changed" />}
          </h3>
          <p className="truncate text-[11px] text-muted">{on ? moduleSummary(perms, m) : m.description}</p>
        </div>
        {readOnly ? (
          <span className={cn('text-xs', on ? 'text-brand-700' : 'text-muted')}>{on ? 'On' : 'No access'}</span>
        ) : (
          <Switch checked={on} onChange={(next) => onChange(setModule(perms, m, next))} label={`${m.label} access`} />
        )}
      </div>

      {on && (
        <div className="border-t border-line px-3 py-2.5">
          {scope && (
            <div className="mb-2 rounded-md bg-surface-subtle px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-ink">{m.records ? `Which ${m.label.toLowerCase().replace(/ and follow-ups$/, '')} can they see?` : 'Which numbers can they see?'}</span>
                {readOnly ? (
                  <span className="text-sm text-ink">{scopeChoice(m, scope)}</span>
                ) : (
                  <Select
                    aria-label={`${m.label}: which records`}
                    aria-describedby={`scope-help-${m.key}`}
                    value={scope}
                    onChange={(e) => onChange(setScope(perms, m, e.target.value as PermissionScope))}
                    className="w-auto"
                  >
                    {scopes.map((s) => (
                      <option key={s} value={s}>
                        {scopeChoice(m, s)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <p id={`scope-help-${m.key}`} className="mt-1 text-[11px] leading-4 text-muted">
                {scopeExplanation(m, scope)}
              </p>
            </div>
          )}
          <ul className="grid gap-x-4 sm:grid-cols-2 @3xl:grid-cols-3">
            {m.actions.map((a) => (
              <ActionRow key={a.key} module={m} action={a} perms={perms} readOnly={readOnly} locked={locked} onChange={onChange} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ActionRow({ module: m, action: a, perms, readOnly, locked, onChange }: { module: PermissionModule; action: ModuleAction; perms: string[]; readOnly: boolean; locked: boolean; onChange: (next: string[]) => void }) {
  const restricted = a.ownerOnly ? 'Owner only' : a.adminOnly ? 'Owners and admins only' : null
  const checked = hasAction(perms, m, a)
  if (restricted && !locked) {
    return (
      <li className="flex items-center gap-2 py-1 text-[13px] text-muted">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          {a.label} <span className="text-xs">· {restricted}</span>
        </span>
      </li>
    )
  }
  const available = locked || actionAvailable(perms, m, a)
  return (
    <li>
      <label className={cn('flex items-start gap-2 rounded-md py-1 text-[13px]', !readOnly && available ? 'cursor-pointer text-ink' : 'text-muted')}>
        <input
          type="checkbox"
          checked={checked}
          disabled={readOnly || !available}
          onChange={(e) => onChange(toggleAction(perms, m, a, e.target.checked))}
          className="mt-0.5 size-3.5 shrink-0 cursor-pointer rounded-control border-zinc-300 accent-brand-600 focus:ring-brand-500 disabled:cursor-default disabled:opacity-60"
        />
        <span className="min-w-0">
          {a.label}
          {a.description && <span className="block text-[11px] leading-4 text-muted">{a.description}</span>}
          {!available && !readOnly && <span className="block text-[11px] leading-4 text-muted">Needs team or all records</span>}
        </span>
      </label>
    </li>
  )
}

// ---------- Create and delete ----------

function NewRoleDialog({ open, copyFrom, orgId, roles, onClose, onCreated }: { open: boolean; copyFrom: string | null; orgId: string; roles: Role[]; onClose: () => void; onCreated: (role: Role) => void }) {
  const queryClient = useQueryClient()
  const notify = useToast()
  const [name, setName] = useState('')
  const [from, setFrom] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  // Reset the form each time it opens (prefilled when duplicating).
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      const source = roles.find((r) => r.id === copyFrom)
      setName(source ? `${source.name} copy` : '')
      setFrom(copyFrom ?? '')
      setError(null)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Enter a name of at least 2 characters')
    setBusy(true)
    setError(null)
    try {
      const role = await createRole({ name: name.trim(), copyFrom: from || null })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).roles, exact: true })
      notify({ title: `${role.name} created`, description: 'Switch on what it can do, then save.' })
      onCreated(role)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="New role"
      description="Name it, then switch on the modules and actions it needs. You can start from an existing role."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="new-role-form" loading={busy}>
            Create role
          </Button>
        </>
      }
    >
      <form id="new-role-form" onSubmit={submit} noValidate className="space-y-5">
        <Field label="Role name">{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Calling agent" maxLength={40} autoFocus />}</Field>
        <Field label="Start from" hint="Copies its permissions. You can change everything after.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Nothing (no access yet)</option>
              {roles
                .filter((r) => r.key !== 'owner')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
  )
}

function DeleteRoleDialog({ open, role, roles, onClose, onDeleted }: { open: boolean; role: Role; roles: Role[]; onClose: () => void; onDeleted: (movedTo: string) => void }) {
  const choices = roles.filter((r) => r.id !== role.id && r.key !== 'owner' && r.key !== 'admin')
  const [target, setTarget] = useState('sales_rep')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await deleteRole(role.id, target)
      onDeleted(target)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Delete ${role.name}?`}
      description={role.memberCount ? `${role.memberCount} ${role.memberCount === 1 ? 'member has' : 'members have'} this role. Choose the role they move to.` : 'Nobody has this role. Any pending invitations with it move to the role you choose.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="delete-role-form" loading={busy} className="bg-red-600 hover:bg-red-700">
            Delete role
          </Button>
        </>
      }
    >
      <form id="delete-role-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Move members to">
          {({ id }) => (
            <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
              {choices.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
  )
}
