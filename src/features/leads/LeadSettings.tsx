import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Lock, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { ApiError } from '../../services/http'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { SettingsSection } from '../../components/app/SettingsSection'
import { ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { useOrgId } from '../crm/hooks'
import type { LeadSource, LostReason } from '../crm/types'
import { createLeadSource, createLostReason, deleteLeadSource, updateLeadSource, updateLostReason, useLeadSources, useLostReasons } from './api'

const errorText = (err: unknown) => (err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Something went wrong')

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function add() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(name.trim())
      setName('')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void add()
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={60}
        />
        <Button variant="secondary" onClick={add} loading={busy} disabled={!name.trim()}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

function SourceRow({ source, canManage, onChanged }: { source: LeadSource; canManage: boolean; onChanged: () => Promise<unknown> }) {
  const notify = useToast()
  const [name, setName] = useState(source.name)
  const [weight, setWeight] = useState(String(source.scoreWeight))

  async function save(values: { name?: string; scoreWeight?: number; archived?: boolean }) {
    try {
      await updateLeadSource(source.id, values)
      await onChanged()
    } catch (err) {
      notify({ tone: 'error', title: 'Couldn’t save', description: errorText(err) })
      setName(source.name)
      setWeight(String(source.scoreWeight))
    }
  }

  return (
    <li className={cn('flex flex-wrap items-center gap-3 px-3 py-2', source.archived && 'bg-surface-subtle')}>
      <div className="min-w-0 flex-1">
        {canManage ? (
          <input
            value={name}
            aria-label={`Name of ${source.name}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== source.name && save({ name: name.trim() })}
            className={cn('w-full rounded-md bg-transparent px-2 py-1 text-sm hover:bg-surface-subtle focus:bg-surface focus:ring-2 focus:ring-brand-100 focus:outline-none', source.archived ? 'text-muted' : 'text-ink')}
          />
        ) : (
          <span className="text-sm text-ink">{source.name}</span>
        )}
      </div>
      {source.isSystem && (
        <span title="Used by integrations — can be renamed or archived, not deleted">
          <Lock className="size-4 text-muted" aria-label="Built-in source" />
        </span>
      )}
      {source.archived && <Badge>Archived</Badge>}
      <span className="text-xs text-muted tabular-nums">{source.leadCount ?? 0} leads</span>
      <label className="flex items-center gap-2 text-xs text-muted">
        Score +
        <input
          type="number"
          min={0}
          max={20}
          value={weight}
          disabled={!canManage}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => Number(weight) !== source.scoreWeight && save({ scoreWeight: Math.max(0, Math.min(20, Number(weight) || 0)) })}
          className="h-8 w-14 rounded-md border border-line px-2 text-sm tabular-nums"
          aria-label={`Score points for ${source.name}`}
        />
      </label>
      {canManage && (
        <div className="flex">
          <button type="button" onClick={() => save({ archived: !source.archived })} className="rounded p-2 text-muted hover:bg-zinc-100 hover:text-ink" aria-label={source.archived ? `Restore ${source.name}` : `Archive ${source.name}`}>
            {source.archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
          </button>
          {!source.isSystem && !source.leadCount && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteLeadSource(source.id)
                  await onChanged()
                } catch (err) {
                  notify({ tone: 'error', title: 'Couldn’t delete', description: errorText(err) })
                }
              }}
              className="rounded p-2 text-muted hover:bg-red-50 hover:text-danger"
              aria-label={`Delete ${source.name}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function ReasonRow({ reason, canManage, onChanged }: { reason: LostReason; canManage: boolean; onChanged: () => Promise<unknown> }) {
  const notify = useToast()
  const [name, setName] = useState(reason.name)
  async function save(values: { name?: string; archived?: boolean }) {
    try {
      await updateLostReason(reason.id, values)
      await onChanged()
    } catch (err) {
      notify({ tone: 'error', title: 'Couldn’t save', description: errorText(err) })
      setName(reason.name)
    }
  }
  return (
    <li className={cn('flex items-center gap-3 px-3 py-2', reason.archived && 'bg-surface-subtle')}>
      {canManage ? (
        <input
          value={name}
          aria-label={`Reason ${reason.name}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== reason.name && save({ name: name.trim() })}
          className={cn('min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm hover:bg-surface-subtle focus:bg-surface focus:ring-2 focus:ring-brand-100 focus:outline-none', reason.archived ? 'text-muted' : 'text-ink')}
        />
      ) : (
        <span className="flex-1 text-sm">{reason.name}</span>
      )}
      {reason.archived && <Badge>Archived</Badge>}
      {canManage && (
        <button type="button" onClick={() => save({ archived: !reason.archived })} className="rounded p-2 text-muted hover:bg-zinc-100 hover:text-ink" aria-label={reason.archived ? `Restore ${reason.name}` : `Archive ${reason.name}`}>
          {reason.archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
        </button>
      )}
    </li>
  )
}

/** Settings → Leads (M08): lead sources (with score weights) and lost reasons. */
export default function LeadSettings() {
  useSeo({ title: 'Lead settings', noindex: true })
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const canManage = useCan('settings.workspace.manage')
  const sources = useLeadSources()
  const reasons = useLostReasons()
  const refreshSources = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).leadSources })
  const refreshReasons = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).lostReasons('lead') })

  return (
    <div className="space-y-6">
      <PageHeader title="Lead settings" description="Manage lead sources, status rules, and qualification settings." />
      <SettingsSection title="Lead sources" description="Where enquiries come from. Score points add to a lead’s fit score (0–20). Built-in sources are used by integrations.">
        {sources.isPending ? (
          <ListSkeleton rows={4} />
        ) : sources.isError ? (
          <ErrorState error={sources.error} onRetry={() => sources.refetch()} />
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-line">
            {sources.data.map((s) => (
              <SourceRow key={`${s.id}:${s.name}:${s.scoreWeight}`} source={s} canManage={canManage} onChanged={refreshSources} />
            ))}
          </ul>
        )}
        {canManage && <AddRow placeholder="New source, e.g. Trade fair" onAdd={async (name) => {
              await createLeadSource({ name })
              await refreshSources()
            }} />}
      </SettingsSection>

      <SettingsSection title="Lost reasons" description="Asked for whenever a lead is marked lost, so reports can show why deals slip away.">
        {reasons.isPending ? (
          <ListSkeleton rows={3} />
        ) : reasons.isError ? (
          <ErrorState error={reasons.error} onRetry={() => reasons.refetch()} />
        ) : reasons.data.length ? (
          <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-line">
            {reasons.data.map((r) => (
              <ReasonRow key={`${r.id}:${r.name}`} reason={r} canManage={canManage} onChanged={refreshReasons} />
            ))}
          </ul>
        ) : (
          <FormAlert>No reasons yet — add one so leads can be marked lost.</FormAlert>
        )}
        {canManage && <AddRow placeholder="New reason, e.g. Went with a local vendor" onAdd={async (name) => {
              await createLostReason({ name })
              await refreshReasons()
            }} />}
      </SettingsSection>
    </div>
  )
}
