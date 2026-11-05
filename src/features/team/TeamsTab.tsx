import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2, Users, X } from 'lucide-react'
import { createTeam, deleteTeam, listTeams, updateTeam } from '../../services/team'
import { useCan } from '../../lib/useOrg'
import type { Team } from '../../types'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/app/States'
import { UserPicker } from '../../components/app/UserPicker'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { errorText, useTeamData } from './teamData'

/** Teams tab: groups of members; a team's managers see its members' records. */

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

  const guard = useUnsavedChanges({ name, members }, onClose, busy, open)
  return (
    <>
    <Dialog
      open={open}
      onClose={guard.requestClose}
      busy={busy}
      title={team ? `Edit ${team.name}` : 'New team'}
      description="Managers see and update records owned by everyone in their team."
      footer={
        <>
          <Button variant="secondary" onClick={guard.requestClose} disabled={busy}>
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
          <ul className="divide-y divide-zinc-100 rounded-card ring-1 ring-line">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={m.fullName} size="xs" className="size-6" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.fullName}</span>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={m.isManager}
                    onChange={() => setMembers((all) => all.map((x) => (x.userId === m.userId ? { ...x, isManager: !x.isManager } : x)))}
                    className="size-4 rounded-control border-zinc-300 text-brand-700 focus:ring-brand-500"
                  />
                  Manager
                </label>
                <button
                  type="button"
                  onClick={() => setMembers((all) => all.filter((x) => x.userId !== m.userId))}
                  className="rounded-control p-1 text-muted hover:bg-zinc-100 hover:text-ink"
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
    {guard.confirmation}
    </>
  )
}

export function TeamsTab({ orgId }: { orgId: string }) {
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
            <li key={t.id} className="rounded-card bg-surface p-5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink">{t.name}</h3>
                  <p className="text-xs text-muted">
                    {t.members.length} member{t.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditing(t)} className="rounded-control p-2 text-muted hover:bg-zinc-100" aria-label={`Edit ${t.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDeleting(t)} className="rounded-control p-2 text-muted hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${t.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
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
