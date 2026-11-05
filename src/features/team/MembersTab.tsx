import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Crown, MoreHorizontal, Pencil, RotateCcw, ShieldCheck, UserMinus, Users } from 'lucide-react'
import { deactivateMember, listMembers, listTeams, reactivateMember, transferOwnership, updateMember } from '../../services/team'
import { fetchMe } from '../../services/auth'
import { roleLabels } from '../../lib/permissions'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { Member } from '../../types'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, PasswordInput } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { Menu, MenuItem, MenuSeparator } from '../../components/app/Menu'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/app/States'
import { UserPicker } from '../../components/app/UserPicker'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { RoleSelect, TeamCheckboxes } from './shared'
import { errorText, roleTone, useTeamData } from './teamData'

/** Members tab: the workspace's people, their roles and teams, removal and ownership transfer. */

function EditMemberDialog({ member, onClose, orgId }: { member: Member | null; onClose: () => void; orgId: string }) {
  const { invalidate, keys } = useTeamData(orgId)
  const notify = useToast()
  const canManageAdmins = useCan('members.manage.admins')
  const teams = useQuery({ queryKey: keys.teams, queryFn: listTeams, enabled: Boolean(member) })
  const [role, setRole] = useState<string>(member?.roleId ?? member?.role ?? 'sales_rep')
  const [title, setTitle] = useState(member?.title ?? '')
  const [teamIds, setTeamIds] = useState<string[]>(member?.teams.map((t) => t.id) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!member) return
    setBusy(true)
    setError(null)
    try {
      await updateMember(member.userId, { role, title: title.trim() || null, teamIds })
      await invalidate()
      notify({ title: `${member.fullName} updated` })
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const guard = useUnsavedChanges({ role, title, teamIds }, onClose, busy, Boolean(member))
  return (
    <>
    <Dialog
      open={Boolean(member)}
      onClose={guard.requestClose}
      busy={busy}
      title={member ? `Edit ${member.fullName}` : 'Edit member'}
      footer={
        <>
          <Button variant="secondary" onClick={guard.requestClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="edit-member-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-member-form" onSubmit={submit} noValidate className="space-y-5">
        <Field label="Role">{({ id }) => <RoleSelect id={id} value={role} onChange={setRole} allowAdmin={canManageAdmins} />}</Field>
        <Field label="Job title" optional>
          {({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Area Sales Manager" maxLength={60} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Teams</legend>
          <TeamCheckboxes teams={teams.data ?? []} value={teamIds} onChange={setTeamIds} />
        </fieldset>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
    {guard.confirmation}
    </>
  )
}

function DeactivateDialog({ member, onClose, orgId }: { member: Member | null; onClose: () => void; orgId: string }) {
  const { invalidate } = useTeamData(orgId)
  const notify = useToast()
  const [heir, setHeir] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    setHeir(null)
    setError(null)
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!member) return
    if (!heir) return setError('Choose who takes over their records')
    setBusy(true)
    setError(null)
    try {
      await deactivateMember(member.userId, heir)
      await invalidate()
      notify({ title: `${member.fullName} no longer has access` })
      close()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(member)}
      onClose={close}
      title={member ? `Remove ${member.fullName}?` : 'Remove member'}
      description="They lose access right away. Nothing is deleted — their leads, deals and tasks move to the person you choose, and their name stays on past activity."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="deactivate-form" loading={busy} className="bg-red-600 hover:bg-red-700">
            Remove access
          </Button>
        </>
      }
    >
      <form id="deactivate-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Hand their open records to">
          {({ id }) => <UserPicker id={id} value={heir} onChange={(v) => setHeir(v)} excludeIds={member ? [member.userId] : []} />}
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
  )
}

function TransferDialog({ member, onClose, orgId }: { member: Member | null; onClose: () => void; orgId: string }) {
  const { invalidate } = useTeamData(orgId)
  const notify = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    setPassword('')
    setError(null)
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!member) return
    if (!password) return setError('Enter your password')
    setBusy(true)
    setError(null)
    try {
      await transferOwnership(member.userId, password)
      await fetchMe().catch(() => {})
      await invalidate()
      notify({ title: `${member.fullName} now owns this workspace`, description: 'You’re an admin.' })
      close()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(member)}
      onClose={close}
      title={member ? `Make ${member.fullName} the owner?` : 'Transfer ownership'}
      description="The owner controls billing and can delete the workspace. You’ll become an admin. Only the new owner can undo this."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-form" loading={busy}>
            Transfer ownership
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Your password">{({ id }) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
  )
}

export function MembersTab({ orgId, onViewRole }: { orgId: string; onViewRole?: (roleId: string) => void }) {
  const { user } = useAuth()
  const { keys, invalidate } = useTeamData(orgId)
  const notify = useToast()
  const canManage = useCan('members.manage')
  const canManageAdmins = useCan('members.manage.admins')
  const canTransfer = useCan('ownership.transfer')
  const [status, setStatus] = useState<'active' | 'deactivated'>('active')
  const [editing, setEditing] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [transferTo, setTransferTo] = useState<Member | null>(null)
  const members = useQuery({ queryKey: keys.members(status), queryFn: () => listMembers({ status }) })
  const reactivate = useMutation({
    mutationFn: (m: Member) => reactivateMember(m.userId),
    onSuccess: async (_d, m) => {
      await invalidate()
      notify({ title: `${m.fullName} has access again` })
    },
    onError: (err) => notify({ tone: 'error', title: 'Couldn’t restore access', description: errorText(err) }),
  })

  const canActOn = (m: Member) => canManage && m.userId !== user?.id && m.role !== 'owner' && (m.role !== 'admin' || canManageAdmins)

  return (
    <>
      <div className="mb-4 flex gap-1" role="group" aria-label="Show members">
        {(['active', 'deactivated'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn('rounded-control px-3 py-2 text-sm font-medium', status === s ? 'bg-zinc-900 text-white' : 'text-muted hover:bg-zinc-100')}
          >
            {s === 'active' ? 'Active' : 'Removed'}
          </button>
        ))}
      </div>

      {members.isPending ? (
        <ListSkeleton rows={4} />
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : members.data.length === 0 ? (
        <EmptyState icon={Users} title={status === 'active' ? 'No members yet' : 'No removed members'} />
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-card bg-surface ring-1 ring-line">
          {members.data.map((m) => (
            <li key={m.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={m.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {m.fullName}
                    {m.userId === user?.id && <span className="font-normal text-muted">(you)</span>}
                    {m.twoFactorEnabled && <ShieldCheck className="size-4 text-success" aria-label="Two-factor authentication on" />}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {m.email}
                    {m.title && ` · ${m.title}`}
                  </p>
                  {m.teams.length > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      {m.teams.map((t) => `${t.name}${t.isManager ? ' (manager)' : ''}`).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className="hidden text-xs text-muted md:block">
                  {status === 'active' ? (m.lastActiveAt ? `Active ${formatDate(m.lastActiveAt)}` : 'Not signed in yet') : m.deactivatedAt ? `Removed ${formatDate(m.deactivatedAt)}` : ''}
                </span>
                {onViewRole ? (
                  <button type="button" onClick={() => onViewRole(m.roleId ?? m.role)} className="rounded-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" aria-label={`${m.roleName ?? roleLabels[m.role]}: see what this role can do`} title="See what this role can do">
                    <Badge tone={m.roleId ? 'neutral' : roleTone[m.role]} className="cursor-pointer hover:ring-brand-200">{m.roleName ?? roleLabels[m.role]}</Badge>
                  </button>
                ) : (
                  <Badge tone={m.roleId ? 'neutral' : roleTone[m.role]}>{m.roleName ?? roleLabels[m.role]}</Badge>
                )}
                {status === 'deactivated' && canActOn(m) && (
                  <Button variant="secondary" size="sm" loading={reactivate.isPending && reactivate.variables?.userId === m.userId} onClick={() => reactivate.mutate(m)}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Restore
                  </Button>
                )}
                {status === 'active' && (canActOn(m) || (canTransfer && m.userId !== user?.id)) && (
                  <Menu
                    align="end"
                    trigger={(props) => (
                      <button type="button" {...props} className="rounded-control p-2 text-muted hover:bg-zinc-100 hover:text-ink" aria-label={`Actions for ${m.fullName}`}>
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        {canActOn(m) && (
                          <MenuItem icon={<Pencil className="size-4" />} onSelect={() => (close(), setEditing(m))}>
                            Edit role & teams
                          </MenuItem>
                        )}
                        {canTransfer && m.userId !== user?.id && (
                          <MenuItem icon={<Crown className="size-4" />} onSelect={() => (close(), setTransferTo(m))}>
                            Make owner
                          </MenuItem>
                        )}
                        {canActOn(m) && (
                          <>
                            <MenuSeparator />
                            <MenuItem tone="danger" icon={<UserMinus className="size-4" />} onSelect={() => (close(), setRemoving(m))}>
                              Remove from workspace
                            </MenuItem>
                          </>
                        )}
                      </>
                    )}
                  </Menu>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <EditMemberDialog key={editing?.userId ?? 'none'} member={editing} onClose={() => setEditing(null)} orgId={orgId} />
      <DeactivateDialog member={removing} onClose={() => setRemoving(null)} orgId={orgId} />
      <TransferDialog member={transferTo} onClose={() => setTransferTo(null)} orgId={orgId} />
    </>
  )
}
