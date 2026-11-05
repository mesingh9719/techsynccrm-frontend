import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Lock, Plus, Trash2 } from 'lucide-react'
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
import {
  createLeadSource,
  createLostReason,
  deleteLeadSource,
  orderLeadSources,
  updateLeadSource,
  updateLostReason,
  useLeadSourceSuggestions,
  useLeadSources,
  useLostReasons,
} from './api'

const errorText = (err: unknown) => (err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Something went wrong')
const clampWeight = (value: string) => Math.max(0, Math.min(20, Math.round(Number(value)) || 0))

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

function Switch({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <span className="relative inline-flex">
      <input type="checkbox" role="switch" aria-checked={checked} aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 peer-disabled:opacity-50" />
      <span className="pointer-events-none absolute top-1 left-1 size-4 rounded-full bg-surface  transition-transform peer-checked:translate-x-5" />
    </span>
  )
}

type SourceRowProps = { source: LeadSource; canManage: boolean; busy: boolean; first: boolean; last: boolean; onMove: (by: -1 | 1) => void; onChanged: () => Promise<unknown> }

function SourceRow({ source, canManage, busy, first, last, onMove, onChanged }: SourceRowProps) {
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
      {canManage && (
        <div className="flex flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={busy || first} className="rounded p-0.5 text-muted hover:bg-zinc-100 hover:text-ink disabled:opacity-30" aria-label={`Move ${source.name} up`}>
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={busy || last} className="rounded p-0.5 text-muted hover:bg-zinc-100 hover:text-ink disabled:opacity-30" aria-label={`Move ${source.name} down`}>
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        {canManage ? (
          <input
            value={name}
            aria-label={`Name of ${source.name}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== source.name && save({ name: name.trim() })}
            maxLength={60}
            className={cn('w-full rounded-md bg-transparent px-2 py-1 text-sm hover:bg-surface-subtle focus:bg-surface focus:ring-2 focus:ring-brand-100 focus:outline-none', source.archived ? 'text-muted' : 'text-ink')}
          />
        ) : (
          <span className={cn('text-sm', source.archived ? 'text-muted' : 'text-ink')}>{source.name}</span>
        )}
      </div>
      {source.isSystem && (
        <span title="Used by integrations. You can rename it or turn it off, but not delete it.">
          <Lock className="size-4 text-muted" aria-label="Built-in source" />
        </span>
      )}
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
          onBlur={() => clampWeight(weight) !== source.scoreWeight && save({ scoreWeight: clampWeight(weight) })}
          className="h-8 w-14 rounded-md border border-line px-2 text-sm tabular-nums"
          aria-label={`Score points for ${source.name}`}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted" title={source.archived ? 'Off: kept on existing leads and in reports, hidden when adding new ones' : 'On: shown when adding leads, web forms and assignment rules'}>
        <Switch checked={!source.archived} disabled={!canManage} label={`Use ${source.name} for new leads`} onChange={(on) => void save({ archived: !on })} />
        <span className="w-6">{source.archived ? 'Off' : 'On'}</span>
      </label>
      {canManage && (
        <div className="flex w-8 justify-center">
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
              className="rounded-control p-2 text-muted hover:bg-red-50 hover:text-danger"
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

function SourceList({ sources, canManage, onChanged }: { sources: LeadSource[]; canManage: boolean; onChanged: () => Promise<unknown> }) {
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  async function move(index: number, by: -1 | 1) {
    const ids = sources.map((s) => s.id)
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    setBusy(true)
    try {
      await orderLeadSources(ids)
    } catch (err) {
      notify({ tone: 'error', title: 'Couldn’t reorder', description: errorText(err) })
    } finally {
      await onChanged()
      setBusy(false)
    }
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-card ring-1 ring-line">
      {sources.map((s, i) => (
        <SourceRow
          key={`${s.id}:${s.name}:${s.scoreWeight}`}
          source={s}
          canManage={canManage}
          busy={busy}
          first={i === 0}
          last={i === sources.length - 1}
          onMove={(by) => void move(i, by)}
          onChanged={onChanged}
        />
      ))}
    </ul>
  )
}

function AddSource({ onAdded }: { onAdded: () => Promise<unknown> }) {
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('5')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function add() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createLeadSource({ name: name.trim(), scoreWeight: clampWeight(weight) })
      await onAdded()
      setName('')
      setWeight('5')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New source, e.g. Trade fair" aria-label="New source name" maxLength={60} className="min-w-48 flex-1" />
        <label className="flex items-center gap-2 text-xs text-muted">
          Score +
          <input type="number" min={0} max={20} value={weight} onChange={(e) => setWeight(e.target.value)} className="h-8 w-16 rounded-md border border-line px-2 text-sm tabular-nums" aria-label="Score points for the new source" />
        </label>
        <Button type="submit" variant="secondary" loading={busy} disabled={!name.trim()}>
          <Plus className="size-4" aria-hidden="true" />
          Add source
        </Button>
      </form>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

/** One-click adds from the common-sources catalog; hidden when there is nothing left to suggest. */
function SourceSuggestions({ onAdded }: { onAdded: () => Promise<unknown> }) {
  const notify = useToast()
  const suggestions = useLeadSourceSuggestions()
  const [adding, setAdding] = useState<string | null>(null)
  if (!suggestions.data?.length) return null
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-muted">Add a common source</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.data.map((s) => (
          <button
            key={s.key}
            type="button"
            title={s.description || undefined}
            disabled={adding !== null}
            onClick={async () => {
              setAdding(s.key)
              try {
                await createLeadSource({ catalogKey: s.key })
                await onAdded()
              } catch (err) {
                notify({ tone: 'error', title: 'Couldn’t add', description: errorText(err) })
              } finally {
                setAdding(null)
              }
            }}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs text-ink ring-1 ring-line hover:bg-surface-subtle disabled:opacity-50"
          >
            <Plus className="size-3" aria-hidden="true" />
            {s.name}
          </button>
        ))}
      </div>
    </div>
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
        <button type="button" onClick={() => save({ archived: !reason.archived })} className="rounded-control p-2 text-muted hover:bg-zinc-100 hover:text-ink" aria-label={reason.archived ? `Restore ${reason.name}` : `Archive ${reason.name}`}>
          {reason.archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
        </button>
      )}
    </li>
  )
}

/** Settings → Leads (M08): lead sources (on/off, order, score weights) and lost reasons. */
export default function LeadSettings() {
  useSeo({ title: 'Lead settings', noindex: true })
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const canManage = useCan('settings.workspace.manage')
  const sources = useLeadSources()
  const reasons = useLostReasons()
  // Also refreshes the common-source suggestions, which live under the same key.
  const refreshSources = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).leadSources })
  const refreshReasons = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).lostReasons('lead') })

  return (
    <div className="space-y-6">
      <PageHeader title="Lead settings" description="Manage lead sources, status rules, and qualification settings." />
      <SettingsSection
        title="Lead sources"
        description="Where enquiries come from. Turn a source off to hide it when adding leads, web forms and assignment rules — leads that already have it keep it, and integrations still tag new leads with it. Score points add to a lead’s fit score (0–20)."
      >
        {sources.isPending ? (
          <ListSkeleton rows={4} />
        ) : sources.isError ? (
          <ErrorState error={sources.error} onRetry={() => sources.refetch()} />
        ) : (
          <SourceList sources={sources.data} canManage={canManage} onChanged={refreshSources} />
        )}
        {canManage && (
          <>
            <AddSource onAdded={refreshSources} />
            <SourceSuggestions onAdded={refreshSources} />
          </>
        )}
      </SettingsSection>

      <SettingsSection title="Lost reasons" description="Asked for whenever a lead is marked lost, so reports can show why deals slip away.">
        {reasons.isPending ? (
          <ListSkeleton rows={3} />
        ) : reasons.isError ? (
          <ErrorState error={reasons.error} onRetry={() => reasons.refetch()} />
        ) : reasons.data.length ? (
          <ul className="divide-y divide-zinc-100 rounded-card ring-1 ring-line">
            {reasons.data.map((r) => (
              <ReasonRow key={`${r.id}:${r.name}`} reason={r} canManage={canManage} onChanged={refreshReasons} />
            ))}
          </ul>
        ) : (
          <FormAlert>No reasons yet — add one so leads can be marked lost.</FormAlert>
        )}
        {canManage && (
          <AddRow
            placeholder="New reason, e.g. Went with a local vendor"
            onAdd={async (name) => {
              await createLostReason({ name })
              await refreshReasons()
            }}
          />
        )}
      </SettingsSection>
    </div>
  )
}
