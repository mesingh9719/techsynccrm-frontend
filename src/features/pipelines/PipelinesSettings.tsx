import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Lock, Plus, Star, Trash2, Trophy, X } from 'lucide-react'
import { emitAppEvent } from '../../lib/appEvents'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { ApiError } from '../../services/http'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { SettingsSection } from '../../components/app/SettingsSection'
import { ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import type { Pipeline, PipelineStage } from '../crm/types'
import { createPipeline, createStage, deletePipeline, deleteStage, listPipelineTemplates, reorderStages, requirableFieldLabels, updatePipeline, updateStage, usePipelines } from '../deals/api'

const errorText = (err: unknown) => (err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Something went wrong')

/** New pipeline from a template (industry presets). */
function NewPipelineDialog({ onClose }: { onClose: () => void }) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const templates = useQuery({ queryKey: [...qk.org(orgId).pipelines, 'templates'], queryFn: listPipelineTemplates, staleTime: Infinity })
  const [name, setName] = useState('')
  const [templateKey, setTemplateKey] = useState('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const template = templates.data?.find((t) => t.key === templateKey)
  async function save() {
    setBusy(true)
    setError(null)
    try {
      await createPipeline({ name: name.trim(), templateKey })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).pipelines })
      onClose()
    } catch (err) {
      if (!handleGlobalApiError(err)) setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const guard = useUnsavedChanges({ name, templateKey }, onClose, busy, true)
  return (
    <>
    <Dialog
      open
      onClose={guard.requestClose}
      busy={busy}
      title="New pipeline"
      footer={
        <>
          <Button variant="secondary" onClick={guard.requestClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            Create pipeline
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">{({ id }) => <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dealer onboarding" maxLength={60} />}</Field>
        <Field label="Start from">
          {({ id }) => (
            <Select id={id} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {(templates.data ?? []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {template && (
          <ol className="flex flex-wrap items-center gap-2 text-xs">
            {template.stages.map((s) => (
              <li key={s.name} className="rounded-md bg-zinc-100 px-2 py-1 text-ink">
                {s.name} <span className="text-muted">{s.probability}%</span>
              </li>
            ))}
            <li className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">Won</li>
            <li className="rounded-md bg-red-50 px-2 py-1 text-red-700">Lost</li>
          </ol>
        )}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Dialog>
    {guard.confirmation}
    </>
  )
}

/** Stage settings: name, probability, rotting days, required fields. Won/Lost: name (+ Won's required fields). */
function StageRow({ pipeline, stage, index, openCount, canManage, onChanged, onDelete, onMove }: { pipeline: Pipeline; stage: PipelineStage; index: number; openCount: number; canManage: boolean; onChanged: () => Promise<unknown>; onDelete: () => void; onMove: (dir: -1 | 1) => void }) {
  const notify = useToast()
  const defs = useCustomFieldDefs('deal')
  const [name, setName] = useState(stage.name)
  const [probability, setProbability] = useState(String(stage.probability))
  const [rotting, setRotting] = useState(stage.rottingDays === null ? '' : String(stage.rottingDays))
  const system = stage.type !== 'open'
  const options = [...Object.entries(requirableFieldLabels).map(([value, label]) => ({ value, label })), ...(defs.data ?? []).filter((d) => !d.archived).map((d) => ({ value: `cf.${d.key}`, label: d.label }))]

  async function save(values: Parameters<typeof updateStage>[2]) {
    try {
      await updateStage(pipeline.id, stage.id, values)
      await onChanged()
    } catch (err) {
      notify({ tone: 'error', title: 'Couldn’t save the stage', description: errorText(err) })
      setName(stage.name)
      setProbability(String(stage.probability))
      setRotting(stage.rottingDays === null ? '' : String(stage.rottingDays))
    }
  }

  return (
    <li className={cn('space-y-2 px-3 py-3', system && 'bg-surface-subtle')}>
      <div className="flex flex-wrap items-center gap-2">
        {system ? stage.type === 'won' ? <Trophy className="size-4 text-success" aria-hidden="true" /> : <X className="size-4 text-danger" aria-hidden="true" /> : <span className="w-4 text-center text-xs text-muted tabular-nums">{index + 1}</span>}
        <input
          value={name}
          disabled={!canManage}
          aria-label={`Name of stage ${stage.name}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== stage.name && save({ name: name.trim() })}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm font-medium text-ink hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        {!system && (
          <>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                type="number"
                min={0}
                max={100}
                value={probability}
                disabled={!canManage}
                onChange={(e) => setProbability(e.target.value)}
                onBlur={() => Number(probability) !== stage.probability && save({ probability: Math.max(0, Math.min(100, Number(probability) || 0)) })}
                className="h-8 w-16 rounded-md border border-line px-2 text-sm tabular-nums"
                aria-label={`Win probability for ${stage.name}`}
              />
              %
            </label>
            <label className="flex items-center gap-1 text-xs text-muted" title="Days without activity before a deal is flagged">
              Rots after
              <input
                type="number"
                min={1}
                max={365}
                value={rotting}
                disabled={!canManage}
                placeholder="off"
                onChange={(e) => setRotting(e.target.value)}
                onBlur={() => {
                  const next = rotting === '' ? null : Math.max(1, Number(rotting) || 1)
                  if (next !== stage.rottingDays) void save({ rottingDays: next })
                }}
                className="h-8 w-16 rounded-md border border-line px-2 text-sm tabular-nums"
                aria-label={`Rotting days for ${stage.name}`}
              />
              days
            </label>
          </>
        )}
        {system && <Badge>{stage.type === 'won' ? '100%' : '0%'} · system stage</Badge>}
        <span className="text-xs text-muted tabular-nums">{stage.dealCount ?? 0} deals</span>
        {canManage && !system && (
          <span className="flex">
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded-control p-2 text-muted hover:bg-zinc-100 disabled:opacity-30" aria-label={`Move ${stage.name} up`}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
            <button type="button" disabled={index === openCount - 1} onClick={() => onMove(1)} className="rounded-control p-2 text-muted hover:bg-zinc-100 disabled:opacity-30" aria-label={`Move ${stage.name} down`}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
            <button type="button" disabled={openCount <= 1} onClick={onDelete} className="rounded-control p-2 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30" aria-label={`Delete ${stage.name}`}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      {stage.type !== 'lost' && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-xs text-muted">Required to enter:</span>
          {options.map((o) => {
            const on = stage.requiredFields.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                disabled={!canManage}
                aria-pressed={on}
                onClick={() => save({ requiredFields: on ? stage.requiredFields.filter((f) => f !== o.value) : [...stage.requiredFields, o.value] })}
                className={cn('rounded-full px-2 py-1 text-xs ring-1', on ? 'bg-brand-50 text-brand-800 ring-brand-200' : 'text-muted ring-line hover:bg-surface')}
              >
                {o.label}
              </button>
            )
          })}
          {stage.type === 'won' && <span className="text-xs text-muted">(a value is always required)</span>}
        </div>
      )}
    </li>
  )
}

function PipelineCard({ pipeline, pipelines, canManage }: { pipeline: Pipeline; pipelines: Pipeline[]; canManage: boolean }) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const notify = useToast()
  const [newStage, setNewStage] = useState('')
  const [deleting, setDeleting] = useState<PipelineStage | 'pipeline' | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [name, setName] = useState(pipeline.name)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).pipelines })
  const open = pipeline.stages.filter((s) => s.type === 'open')
  const system = pipeline.stages.filter((s) => s.type !== 'open')

  async function run(fn: () => Promise<unknown>, success?: string) {
    try {
      await fn()
      await refresh()
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all })
      if (success) notify({ title: success })
      return true
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t save', description: errorText(err) })
      return false
    }
  }

  const otherOpenStages = deleting === 'pipeline' ? pipelines.filter((p) => p.id !== pipeline.id).flatMap((p) => p.stages.filter((s) => s.type === 'open').map((s) => ({ ...s, label: `${p.name} → ${s.name}` }))) : open.filter((s) => s !== deleting).map((s) => ({ ...s, label: s.name }))
  const needsMove = deleting === 'pipeline' ? (pipeline.dealCount ?? 0) > 0 : deleting ? (deleting.dealCount ?? 0) > 0 : false

  return (
    <SettingsSection
      title={pipeline.name}
      description={pipeline.readOnly ? 'Read-only on your plan: deals can only be marked won or lost.' : `${pipeline.dealCount ?? 0} deals`}
      actions={
        canManage && (
          <>
            {!pipeline.isDefault && (
              <Button size="sm" variant="secondary" onClick={() => run(() => updatePipeline(pipeline.id, { isDefault: true }), `${pipeline.name} is now the default`)}>
                <Star className="size-4" aria-hidden="true" />
                Make default
              </Button>
            )}
            {!pipeline.isDefault && (
              <Button size="sm" variant="ghost" onClick={() => setDeleting('pipeline')} aria-label={`Delete ${pipeline.name}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
          </>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {pipeline.isDefault && <Badge tone="brand">Default</Badge>}
        {pipeline.readOnly && (
          <Badge tone="warning">
            <Lock className="size-3" aria-hidden="true" />
            Read-only
          </Badge>
        )}
        {canManage && (
          <input
            value={name}
            aria-label="Pipeline name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== pipeline.name && run(() => updatePipeline(pipeline.id, { name: name.trim() }))}
            className="rounded-md border border-line px-2 py-1 text-sm"
          />
        )}
      </div>
      <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-line">
        {open.map((s, i) => (
          <StageRow
            key={`${s.id}:${s.name}:${s.probability}:${s.rottingDays}`}
            pipeline={pipeline}
            stage={s}
            index={i}
            openCount={open.length}
            canManage={canManage}
            onChanged={refresh}
            onDelete={() => setDeleting(s)}
            onMove={(dir) => {
              const ids = open.map((x) => x.id)
              ;[ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]
              void run(() => reorderStages(pipeline.id, ids))
            }}
          />
        ))}
        {system.map((s, i) => (
          <StageRow key={`${s.id}:${s.name}`} pipeline={pipeline} stage={s} index={i} openCount={open.length} canManage={canManage} onChanged={refresh} onDelete={() => {}} onMove={() => {}} />
        ))}
      </ul>
      {canManage && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (newStage.trim() && (await run(() => createStage(pipeline.id, { name: newStage.trim() }), 'Stage added'))) setNewStage('')
          }}
        >
          <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="New stage, e.g. Demo done" aria-label="New stage name" maxLength={60} />
          <Button type="submit" variant="secondary" disabled={!newStage.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add stage
          </Button>
        </form>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null)
          setMoveTo('')
        }}
        onConfirm={async () => {
          const ok =
            deleting === 'pipeline'
              ? await run(() => deletePipeline(pipeline.id, moveTo || undefined), 'Pipeline deleted')
              : deleting && (await run(() => deleteStage(pipeline.id, deleting.id, moveTo || undefined), 'Stage deleted'))
          if (ok) {
            setDeleting(null)
            setMoveTo('')
          }
        }}
        title={deleting === 'pipeline' ? `Delete ${pipeline.name}?` : `Delete stage “${deleting?.name ?? ''}”?`}
        description={
          <span className="block space-y-3">
            <span className="block">{needsMove ? 'Its deals need a new home first. Won and lost deals keep their outcome.' : 'There are no deals in it.'}</span>
            {needsMove && (
              <Select aria-label="Move deals to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Move deals to…</option>
                {otherOpenStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </span>
        }
        confirmLabel="Delete"
        tone="danger"
      />
    </SettingsSection>
  )
}

/** Settings → Pipelines (M09): pipelines from templates, stage editor, plan limit. */
export default function PipelinesSettings() {
  useSeo({ title: 'Pipelines', noindex: true })
  const canManage = useCan('settings.pipelines.manage')
  const pipelines = usePipelines()
  const limit = useEntitlement('pipelines')
  const [creating, setCreating] = useState(false)
  const live = (pipelines.data ?? []).filter((p) => !p.archived)
  const full = limit.limit !== null && live.length >= limit.limit

  return (
    <div className="space-y-6">
      <PageHeader title="Pipelines" description="Shape the stages your team uses to move deals forward." />
      <SettingsSection
        title="Pipelines"
        description={`Stages, win probabilities, when deals count as rotting, and what a deal needs before it can move on.${limit.limit !== null ? ` Your plan includes ${limit.limit} pipeline${limit.limit === 1 ? '' : 's'} (${live.length} used).` : ''}`}
        actions={
          canManage && (
            <Button size="sm" onClick={() => (full ? emitAppEvent({ type: 'upgrade', reason: 'limit', resource: 'pipelines', message: `Your plan includes ${limit.limit} pipeline${limit.limit === 1 ? '' : 's'}. Upgrade to add more.` }) : setCreating(true))}>
              <Plus className="size-4" aria-hidden="true" />
              New pipeline
            </Button>
          )
        }
      >
        {pipelines.isPending ? <ListSkeleton rows={3} /> : pipelines.isError ? <ErrorState error={pipelines.error} onRetry={() => pipelines.refetch()} /> : null}
      </SettingsSection>
      {live.map((p) => (
        <PipelineCard key={p.id} pipeline={p} pipelines={live} canManage={canManage} />
      ))}
      {creating && <NewPipelineDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
