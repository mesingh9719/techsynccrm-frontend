import { useState, type FormEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, MoreHorizontal, Pencil, RotateCcw, Send, ShieldCheck, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react'
import {
  createInvitations,
  createTeam,
  deactivateMember,
  deleteTeam,
  listInvitations,
  listMembers,
  listTeams,
  reactivateMember,
  resendInvitation,
  revokeInvitation,
  transferOwnership,
  updateMember,
  updateTeam,
  type InviteResult,
} from '../../services/team'
import { fetchMe } from '../../services/auth'
import { ApiError } from '../../services/http'
import { inviteSchema, parseEmails, type InviteValues } from '../../lib/schemas'
import { assignableRoles, roleDescriptions, roleLabels } from '../../lib/permissions'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { useSeo } from '../../lib/useSeo'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { Member, MemberRole, Team } from '../../types'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, PasswordInput, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog, Dialog, Drawer } from '../../components/app/Dialog'
import { Menu, MenuItem, MenuSeparator } from '../../components/app/Menu'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/app/States'
import { UserPicker } from '../../components/app/UserPicker'

const errorText = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : fallback

const roleTone: Record<MemberRole, 'brand' | 'neutral' | 'success' | 'warning'> = {
  owner: 'warning',
  admin: 'brand',
  manager: 'success',
  sales_rep: 'neutral',
  viewer: 'neutral',
}

function useTeamData(orgId: string) {
  const queryClient = useQueryClient()
  const keys = qk.org(orgId)
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.membersAll }),
      queryClient.invalidateQueries({ queryKey: keys.invitations }),
      queryClient.invalidateQueries({ queryKey: keys.teams }),
      queryClient.invalidateQueries({ queryKey: keys.checklist }),
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'memberOptions'] }),
    ])
  return { keys, invalidate }
}

/** Role picker with a short explanation of each role. */
function RoleSelect({ value, onChange, allowAdmin, id, describedBy }: { value: string; onChange: (role: MemberRole) => void; allowAdmin: boolean; id?: string; describedBy?: string }) {
  const roles = assignableRoles.filter((r) => allowAdmin || r !== 'admin')
  return (
    <>
      <Select id={id} aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value as MemberRole)}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabels[r]}
          </option>
        ))}
      </Select>
      {value && <p className="mt-1.5 text-sm text-zinc-500">{roleDescriptions[value as MemberRole]}</p>}
    </>
  )
}

function TeamCheckboxes({ teams, value, onChange }: { teams: Team[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (!teams.length) return <p className="text-sm text-zinc-500">No teams yet — create them in the Teams tab.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((t) => {
        const checked = value.includes(t.id)
        return (
          <label
            key={t.id}
            className={cn(
              'inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-sm ring-1 select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
              checked ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-zinc-700 ring-zinc-300 hover:ring-zinc-400',
            )}
          >
            <input type="checkbox" className="sr-only" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== t.id) : [...value, t.id])} />
            {t.name}
          </label>
        )
      })}
    </div>
  )
}

// ---------- Invite ----------

function InviteDrawer({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const { invalidate, keys } = useTeamData(orgId)
  const canInviteAdmins = useCan('members.manage.admins')
  const seats = useEntitlement('users')
  const teams = useQuery({ queryKey: keys.teams, queryFn: listTeams, enabled: open })
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [results, setResults] = useState<InviteResult[] | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { emails: '', role: 'sales_rep' } })
  const emailsText = useWatch({ control, name: 'emails' })
  const role = useWatch({ control, name: 'role' })
  const parsed = parseEmails(emailsText ?? '')

  function close() {
    reset()
    setTeamIds([])
    setResults(null)
    setServerError(null)
    onClose()
  }

  const onSubmit = async (values: InviteValues) => {
    setServerError(null)
    const { valid, invalid } = parseEmails(values.emails)
    if (invalid.length) return setServerError(`Check these addresses: ${invalid.join(', ')}`)
    if (valid.length > 20) return setServerError('Invite up to 20 people at a time.')
    try {
      setResults(await createInvitations({ emails: valid, role: values.role, teamIds }))
      await invalidate()
    } catch (err) {
      // Out of seats: earlier addresses in the batch may already have been invited.
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') {
        await invalidate()
        handleGlobalApiError(err)
      }
      setServerError(errorText(err))
    }
  }

  const statusLabel = { invited: 'Invitation sent', already_member: 'Already a member', email_failed: 'Saved, but the email failed — resend it' }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Invite people"
      description="They’ll get an email with a link to join this workspace. Links expire after 7 days."
      footer={
        results ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={isSubmitting}>
              <Send className="size-4" aria-hidden="true" />
              Send {parsed.valid.length > 1 ? `${parsed.valid.length} invitations` : 'invitation'}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <ul className="divide-y divide-zinc-100" aria-label="Invitation results">
          {results.map((r) => (
            <li key={r.email} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="truncate text-zinc-900">{r.email}</span>
              <Badge tone={r.status === 'invited' ? 'success' : r.status === 'already_member' ? 'neutral' : 'warning'}>{statusLabel[r.status]}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <form id="invite-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field label="Email addresses" error={errors.emails?.message} hint="Separate several with commas or new lines (up to 20).">
            {({ id, describedBy, invalid }) => <Textarea id={id} rows={4} placeholder="ritika@saffron.in, imran@saffron.in" aria-describedby={describedBy} invalid={invalid} {...register('emails')} />}
          </Field>
          {parsed.invalid.length > 0 && <p className="-mt-3 text-sm text-amber-700">Not valid: {parsed.invalid.join(', ')}</p>}
          <Field label="Role" error={errors.role?.message}>
            {({ id, describedBy }) => <RoleSelect id={id} describedBy={describedBy} value={role} onChange={(r) => setValue('role', r as InviteValues['role'])} allowAdmin={canInviteAdmins} />}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-800">Teams (optional)</legend>
            <TeamCheckboxes teams={teams.data ?? []} value={teamIds} onChange={setTeamIds} />
          </fieldset>
          {seats.limit !== null && seats.used !== null && (
            <p className={cn('text-sm', seats.used + parsed.valid.length > seats.limit ? 'text-amber-700' : 'text-zinc-500')}>
              {seats.used} of {seats.limit} seats used on your plan (pending invitations hold a seat).
            </p>
          )}
          {serverError && <FormAlert>{serverError}</FormAlert>}
        </form>
      )}
    </Drawer>
  )
}

// ---------- Members ----------

function EditMemberDialog({ member, onClose, orgId }: { member: Member | null; onClose: () => void; orgId: string }) {
  const { invalidate, keys } = useTeamData(orgId)
  const notify = useToast()
  const canManageAdmins = useCan('members.manage.admins')
  const teams = useQuery({ queryKey: keys.teams, queryFn: listTeams, enabled: Boolean(member) })
  const [role, setRole] = useState<MemberRole>(member?.role ?? 'sales_rep')
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

  return (
    <Dialog
      open={Boolean(member)}
      onClose={onClose}
      title={member ? `Edit ${member.fullName}` : 'Edit member'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
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
          <legend className="mb-2 text-sm font-medium text-zinc-800">Teams</legend>
          <TeamCheckboxes teams={teams.data ?? []} value={teamIds} onChange={setTeamIds} />
        </fieldset>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
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

function MembersTab({ orgId }: { orgId: string }) {
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
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', status === s ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100')}
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
        <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200">
          {members.data.map((m) => (
            <li key={m.userId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={m.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
                    {m.fullName}
                    {m.userId === user?.id && <span className="font-normal text-zinc-500">(you)</span>}
                    {m.twoFactorEnabled && <ShieldCheck className="size-3.5 text-emerald-600" aria-label="Two-factor authentication on" />}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {m.email}
                    {m.title && ` · ${m.title}`}
                  </p>
                  {m.teams.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {m.teams.map((t) => `${t.name}${t.isManager ? ' (manager)' : ''}`).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className="hidden text-xs text-zinc-500 md:block">
                  {status === 'active' ? (m.lastActiveAt ? `Active ${formatDate(m.lastActiveAt)}` : 'Not signed in yet') : m.deactivatedAt ? `Removed ${formatDate(m.deactivatedAt)}` : ''}
                </span>
                <Badge tone={roleTone[m.role]}>{roleLabels[m.role]}</Badge>
                {status === 'deactivated' && canActOn(m) && (
                  <Button variant="secondary" size="sm" loading={reactivate.isPending && reactivate.variables?.userId === m.userId} onClick={() => reactivate.mutate(m)}>
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Restore
                  </Button>
                )}
                {status === 'active' && (canActOn(m) || (canTransfer && m.userId !== user?.id)) && (
                  <Menu
                    align="end"
                    trigger={(props) => (
                      <button type="button" {...props} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label={`Actions for ${m.fullName}`}>
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

// ---------- Invitations ----------

function InvitationsTab({ orgId }: { orgId: string }) {
  const { keys, invalidate } = useTeamData(orgId)
  const notify = useToast()
  const invitations = useQuery({ queryKey: keys.invitations, queryFn: listInvitations })
  const resend = useMutation({
    mutationFn: resendInvitation,
    onSuccess: async () => {
      await invalidate()
      notify({ title: 'Invitation sent again' })
    },
    onError: (err) => notify({ tone: 'error', title: 'Couldn’t resend', description: errorText(err) }),
  })
  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: async () => {
      await invalidate()
      notify({ title: 'Invitation cancelled' })
    },
  })

  if (invitations.isPending) return <ListSkeleton rows={3} />
  if (invitations.isError) return <ErrorState error={invitations.error} onRetry={() => invitations.refetch()} />
  if (!invitations.data.length) return <EmptyState icon={Send} title="No pending invitations" description="People you invite appear here until they join." />

  return (
    <ul className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200">
      {invitations.data.map((inv) => (
        <li key={inv.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900">{inv.email}</p>
            <p className="text-xs text-zinc-500">
              {roleLabels[inv.role]} · invited by {inv.invitedByName ?? 'someone'} · {inv.status === 'expired' ? 'expired' : `expires ${formatDate(inv.expiresAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {inv.status === 'expired' && <Badge tone="warning">Expired</Badge>}
            <Button variant="secondary" size="sm" loading={resend.isPending && resend.variables === inv.id} onClick={() => resend.mutate(inv.id)}>
              Resend
            </Button>
            <Button variant="ghost" size="sm" loading={revoke.isPending && revoke.variables === inv.id} onClick={() => revoke.mutate(inv.id)} aria-label={`Cancel invitation for ${inv.email}`}>
              <X className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------- Teams ----------

function TeamDialog({ team, open, onClose, orgId }: { team: Team | null; open: boolean; onClose: () => void; orgId: string }) {
  const { invalidate } = useTeamData(orgId)
  const notify = useToast()
  const [name, setName] = useState(team?.name ?? '')
  const [members, setMembers] = useState<{ userId: string; isManager: boolean; fullName: string }[]>(team?.members.map(({ userId, isManager, fullName }) => ({ userId, isManager, fullName })) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Enter a team name')
    setBusy(true)
    setError(null)
    const payload = { name: name.trim(), members: members.map(({ userId, isManager }) => ({ userId, isManager })) }
    try {
      if (team) await updateTeam(team.id, payload)
      else await createTeam(payload)
      await invalidate()
      notify({ title: team ? 'Team updated' : 'Team created' })
      onClose()
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
      title={team ? `Edit ${team.name}` : 'New team'}
      description="Managers see and update records owned by everyone in their team."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="team-form" loading={busy}>
            {team ? 'Save team' : 'Create team'}
          </Button>
        </>
      }
    >
      <form id="team-form" onSubmit={submit} noValidate className="space-y-5">
        <Field label="Team name">{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karnataka sales" maxLength={60} />}</Field>
        <Field label="Add a member">
          {({ id }) => (
            <UserPicker
              id={id}
              value={null}
              excludeIds={members.map((m) => m.userId)}
              placeholder="Search members…"
              onChange={(userId, member) => userId && member && setMembers((all) => [...all, { userId, isManager: false, fullName: member.fullName }])}
            />
          )}
        </Field>
        {members.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={m.fullName} size="xs" className="size-6" />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">{m.fullName}</span>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={m.isManager}
                    onChange={() => setMembers((all) => all.map((x) => (x.userId === m.userId ? { ...x, isManager: !x.isManager } : x)))}
                    className="size-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                  />
                  Manager
                </label>
                <button
                  type="button"
                  onClick={() => setMembers((all) => all.filter((x) => x.userId !== m.userId))}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label={`Remove ${m.fullName} from the team`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
  )
}

function TeamsTab({ orgId }: { orgId: string }) {
  const { keys, invalidate } = useTeamData(orgId)
  const notify = useToast()
  const canManage = useCan('members.manage')
  const teams = useQuery({ queryKey: keys.teams, queryFn: listTeams })
  const [editing, setEditing] = useState<Team | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Team | null>(null)

  if (teams.isPending) return <ListSkeleton rows={3} />
  if (teams.isError) return <ErrorState error={teams.error} onRetry={() => teams.refetch()} />

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            New team
          </Button>
        </div>
      )}
      {teams.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Group people by region, product or branch. Managers of a team see their team’s records."
          action={canManage ? <Button onClick={() => setEditing('new')}>Create a team</Button> : undefined}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {teams.data.map((t) => (
            <li key={t.id} className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-zinc-950">{t.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {t.members.length} member{t.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditing(t)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={`Edit ${t.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDeleting(t)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${t.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {t.members.map((m) => (
                  <li key={m.userId}>
                    <Badge tone={m.isManager ? 'brand' : 'neutral'}>
                      {m.fullName}
                      {m.isManager && ' · manager'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <TeamDialog
        key={editing === 'new' ? 'new' : (editing?.id ?? 'none')}
        team={editing === 'new' ? null : editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        orgId={orgId}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        tone="danger"
        title={`Delete ${deleting?.name ?? 'team'}?`}
        description="Members stay in the workspace; only the grouping (and managers’ view of it) is removed."
        confirmLabel="Delete team"
        onConfirm={async () => {
          if (!deleting) return
          await deleteTeam(deleting.id)
          await invalidate()
          notify({ title: 'Team deleted' })
          setDeleting(null)
        }}
      />
    </>
  )
}

// ---------- Page ----------

const tabs = [
  { key: 'members', label: 'Members' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'teams', label: 'Teams' },
] as const

export default function TeamSettings() {
  useSeo({ title: 'Team', noindex: true })
  const { user } = useAuth()
  const canInvite = useCan('members.invite')
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('members')
  const [inviting, setInviting] = useState(false)
  const orgId = user?.organization?.id
  if (!orgId) return null
  const visibleTabs = tabs.filter((t) => t.key !== 'invitations' || canInvite)

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Team" className="flex gap-1 rounded-xl bg-zinc-100 p-1">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`team-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="team-tabpanel"
              onClick={() => setTab(t.key)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === t.key ? 'bg-white text-zinc-950 shadow-card' : 'text-zinc-600 hover:text-zinc-900')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canInvite && (
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Invite people
          </Button>
        )}
      </div>
      <div id="team-tabpanel" role="tabpanel" aria-labelledby={`team-tab-${tab}`} className="mt-6">
        {tab === 'members' && <MembersTab orgId={orgId} />}
        {tab === 'invitations' && <InvitationsTab orgId={orgId} />}
        {tab === 'teams' && <TeamsTab orgId={orgId} />}
      </div>
      <InviteDrawer open={inviting} onClose={() => setInviting(false)} orgId={orgId} />
    </div>
  )
}
