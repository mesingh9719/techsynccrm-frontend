import { RecordWorkspace } from '../crm/components/RecordWorkspace'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Building2, Check, Clock, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { ApiError } from '../../services/http'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { listContacts } from '../contacts/api'
import { DeletedBanner, FieldRow, InlineText, OwnerCell, Panel } from '../crm/components/RecordParts'
import { RecordPicker } from '../crm/components/RecordPicker'
import { TagChips } from '../crm/components/Tags'
import { formatCustomValue } from '../crm/customFieldFormat'
import { formatMinor, formatPhone, relativeTime } from '../crm/format'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import type { DealRecord, PipelineStage } from '../crm/types'
import {
  addDealContact,
  deleteDeal,
  getDeal,
  getDealHistory,
  removeDealContact,
  restoreDeal,
  updateDeal,
  usePipelines,
  type DealInput,
} from './api'
import { DealFormDrawer } from './DealFormDrawer'
import { useDealMover } from './useDealMover'

const duration = (s: number | null) =>
  s === null ? '' : s < 86_400 ? `${Math.max(1, Math.round(s / 3600))} h` : `${Math.round(s / 86_400)} d`

/** Clickable stage stepper: open stages in order, then Won / Lost buttons. */
function StageStepper({
  deal,
  stages,
  onMove,
  disabled,
}: {
  deal: DealRecord
  stages: PipelineStage[]
  onMove: (s: PipelineStage) => void
  disabled: boolean
}) {
  const open = stages.filter((s) => s.type === 'open')
  const currentIndex = open.findIndex((s) => s.id === deal.stageId)
  const won = stages.find((s) => s.type === 'won')
  const lost = stages.find((s) => s.type === 'lost')
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <ol className="flex min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-surface-subtle p-1" aria-label="Deal stage">
        {open.map((s, i) => {
          const done = deal.status === 'won' || (deal.status === 'open' && i < currentIndex)
          const current = s.id === deal.stageId
          return (
            <li key={s.id} className="min-w-28 flex-1">
              <button
                type="button"
                disabled={disabled || current}
                onClick={() => onMove(s)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors',
                  current
                    ? 'bg-ink text-surface'
                    : done
                      ? 'bg-brand-100 text-brand-800 hover:bg-brand-200  '
                      : 'text-muted hover:bg-surface hover:text-ink',
                  disabled && !current && 'cursor-default hover:bg-transparent',
                )}
                title={`${s.name} · ${s.probability}%`}
              >
                {done && <Check className="size-3" aria-hidden="true" />}
                {s.name}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="flex shrink-0 gap-2">
        {won && (
          <Button
            size="sm"
            variant="secondary"
            className={deal.status === 'won' ? 'bg-emerald-50 text-emerald-800' : ''}
            disabled={disabled || deal.status === 'won'}
            onClick={() => onMove(won)}
          >
            <Trophy className="size-4" aria-hidden="true" />
            {deal.status === 'won' ? 'Won' : `Mark ${won.name.toLowerCase()}`}
          </Button>
        )}
        {lost && (
          <Button
            size="sm"
            variant="secondary"
            className={deal.status === 'lost' ? 'text-red-700 ring-red-200' : ''}
            disabled={disabled || deal.status === 'lost'}
            onClick={() => onMove(lost)}
          >
            <X className="size-4" aria-hidden="true" />
            {deal.status === 'lost' ? 'Lost' : `Mark ${lost.name.toLowerCase()}`}
          </Button>
        )}
      </div>
    </div>
  )
}

/** /app/deals/:id */
export default function DealDetailPage() {
  const { id = '' } = useParams()
  const orgId = useOrgId()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const query = useQuery({ queryKey: qk.org(orgId).deals.detail(id), queryFn: () => getDeal(id) })
  const history = useQuery({
    queryKey: [...qk.org(orgId).deals.detail(id), 'history'],
    queryFn: () => getDealHistory(id),
  })
  const pipelines = usePipelines()
  const defs = useCustomFieldDefs('deal')
  const canUpdateAny = useCan('deals.update')
  const canDeleteAny = useCan('deals.delete')
  const [dialog, setDialog] = useState<null | 'edit' | 'delete'>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [now] = useState(() => Date.now())
  const deal = query.data
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all })
  const mover = useDealMover({ onSettled: refresh })
  useSeo({ title: deal?.title ?? 'Deal', noindex: true })

  if (query.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-6xl rounded-card" />
  if (query.isError || !deal)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    )

  const permissions = user?.organization?.permissions ?? []
  const ownScoped = (action: string) => permissions.includes(`deals.${action}.own`) && deal.ownerId !== user?.id
  const canUpdate = canUpdateAny && !ownScoped('update') && !deal.deletedAt
  const canDelete = canDeleteAny && !ownScoped('delete')
  const pipeline = pipelines.data?.find((p) => p.id === deal.pipelineId)
  const stages = pipeline?.stages ?? [deal.stage]
  const setDeal = (d: DealRecord) => queryClient.setQueryData(qk.org(orgId).deals.detail(id), d)

  async function patch(values: DealInput) {
    try {
      setDeal(await updateDeal(deal!.id, values, deal!.updatedAt))
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.lists })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await refresh()
      if (handleGlobalApiError(err)) throw new Error('Not saved')
      throw new Error(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save')
    }
  }

  async function contactAction(fn: () => Promise<DealRecord>) {
    try {
      setDeal(await fn())
    } catch (err) {
      if (!handleGlobalApiError(err))
        notify({
          tone: 'error',
          title: 'Couldn’t update contacts',
          description: err instanceof ApiError ? err.message : undefined,
        })
    }
  }

  const activeDefs = (defs.data ?? []).filter((d) => !d.archived || deal.customFields[d.key] !== undefined)
  const close = deal.expectedCloseDate ? new Date(`${deal.expectedCloseDate}T00:00:00`) : null

  return (
    <div className="app-page">
      <Link to="/app/deals" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Deals
      </Link>
      {deal.deletedAt && (
        <div className="mt-4">
          <DeletedBanner
            deletedAt={deal.deletedAt}
            canRestore={canDelete}
            onRestore={async () => {
              try {
                setDeal(await restoreDeal(deal.id))
                await refresh()
                notify({ title: 'Deal restored' })
              } catch (err) {
                if (!handleGlobalApiError(err))
                  notify({
                    tone: 'error',
                    title: 'Couldn’t restore',
                    description: err instanceof ApiError ? err.message : undefined,
                  })
              }
            }}
          />
        </div>
      )}

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{deal.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="text-lg font-semibold text-ink tabular-nums">
              {formatMinor(deal.valueMinor, deal.currency)}
            </span>
            {deal.status === 'open' && (
              <span className="tabular-nums">
                Weighted {formatMinor(deal.weightedMinor, deal.currency)} ({deal.probability}%)
              </span>
            )}
            <span>{deal.pipeline.name}</span>
            {deal.company && (
              <Link to={`/app/companies/${deal.company.id}`} className="inline-flex items-center gap-1 hover:underline">
                <Building2 className="size-4" aria-hidden="true" />
                {deal.company.name}
              </Link>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'danger' : 'brand'}>
              {deal.status === 'open' ? deal.stage.name : deal.status === 'won' ? 'Won' : 'Lost'}
            </Badge>
            {deal.status === 'lost' && deal.lostReason && (
              <span className="text-xs text-muted">{deal.lostReason.name}</span>
            )}
            {deal.isRotting && (
              <Badge tone="warning">
                <Clock className="size-3" aria-hidden="true" />
                {deal.daysInStage} days idle
              </Badge>
            )}
            <TagChips tags={deal.tags} max={6} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canUpdate && (
            <Button size="sm" onClick={() => setDialog('edit')}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {canDelete && !deal.deletedAt && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('delete')} aria-label="Delete deal">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div className="mt-6">
        <StageStepper deal={deal} stages={stages} disabled={!canUpdate} onMove={(s) => void mover.move(deal, s)} />
        {pipeline?.readOnly && (
          <p className="mt-2 text-xs text-amber-700">
            This pipeline is read-only on your plan — the deal can only be marked won or lost.
          </p>
        )}
      </div>

      <div className="record-workspace mt-6">
        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-line">
              <FieldRow label="Title">
                <InlineText
                  label="title"
                  value={deal.title}
                  disabled={!canUpdate}
                  onSave={(v) => (v ? patch({ title: v }) : Promise.reject(new Error('A deal needs a title')))}
                />
              </FieldRow>
              <FieldRow label="Value">{formatMinor(deal.valueMinor, deal.currency)}</FieldRow>
              <FieldRow label="Expected close">
                <span
                  className={cn(close && deal.status === 'open' && close.getTime() < now && 'font-medium text-danger')}
                >
                  {close ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(close) : '—'}
                </span>
              </FieldRow>
              <FieldRow label="Probability">
                {deal.probabilityOverride !== null
                  ? `${deal.probabilityOverride}% (set on deal)`
                  : `${deal.stage.probability}% (stage)`}
              </FieldRow>
              <FieldRow label="Owner">
                <OwnerCell owner={deal.owner} />
              </FieldRow>
              <FieldRow label="Source">{deal.source?.name ?? '—'}</FieldRow>
              <FieldRow label="In stage">
                {deal.status === 'open' ? `${deal.daysInStage} day${deal.daysInStage === 1 ? '' : 's'}` : '—'}
              </FieldRow>
              {deal.leadId && (
                <FieldRow label="From lead">
                  <Link to={`/app/leads/${deal.leadId}`} className="text-brand-700 hover:underline">
                    Open the original lead
                  </Link>
                </FieldRow>
              )}
              {deal.status === 'lost' && deal.lostNote && <FieldRow label="Lost note">{deal.lostNote}</FieldRow>}
              <FieldRow label="Created">{relativeTime(deal.createdAt)}</FieldRow>
              {activeDefs.map((d) => (
                <FieldRow key={d.id} label={d.label}>
                  {formatCustomValue(d, deal.customFields[d.key])}
                </FieldRow>
              ))}
            </dl>
          </Panel>

          <Panel
            title={`Contacts${deal.contacts.length ? ` (${deal.contacts.length})` : ''}`}
            actions={
              canUpdate && (
                <Button size="sm" variant="secondary" onClick={() => setAddingContact((v) => !v)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              )
            }
          >
            {addingContact && (
              <div className="mb-3">
                <RecordPicker
                  queryKey={qk.org(orgId).contacts.all}
                  search={async (q) =>
                    (await listContacts({ q, limit: 10 })).items.map((c) => ({
                      id: c.id,
                      label: c.displayName,
                      hint: c.companies[0]?.name,
                    }))
                  }
                  selected={null}
                  onChange={(o) => {
                    if (!o) return
                    setAddingContact(false)
                    void contactAction(() =>
                      addDealContact(deal.id, { contactId: o.id, isPrimary: !deal.contacts.length }),
                    )
                  }}
                  placeholder="Search contacts…"
                />
              </div>
            )}
            {deal.contacts.length ? (
              <ul className="divide-y divide-line">
                {deal.contacts.map((c) => (
                  <li key={c.contactId} className="flex items-center gap-3 py-3">
                    <Avatar name={c.displayName} size="sm" />
                    <Link to={`/app/contacts/${c.contactId}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink hover:underline">
                        {c.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[c.role, formatPhone(c.primaryPhoneE164, null)].filter((v) => v && v !== '—').join(' · ')}
                      </span>
                    </Link>
                    {c.isPrimary && deal.contacts.length > 1 && <Badge>Primary</Badge>}
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => contactAction(() => removeDealContact(deal.id, c.contactId))}
                        className="rounded p-1 text-muted hover:text-danger"
                        aria-label={`Remove ${c.displayName}`}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No contacts on this deal yet.</p>
            )}
          </Panel>

          <Panel title="Stage history">
            {history.isPending ? (
              <Skeleton className="h-16" />
            ) : history.isError ? (
              <ErrorState error={history.error} onRetry={() => history.refetch()} />
            ) : (
              <ol className="space-y-3">
                {(history.data ?? []).map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-zinc-300" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      {h.from ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {h.from.name} <ArrowRight className="size-3 text-muted" aria-hidden="true" />{' '}
                          <strong className="font-medium">{h.to.name}</strong>
                          {h.secondsInPrevStage !== null && (
                            <span className="text-xs text-muted">after {duration(h.secondsInPrevStage)}</span>
                          )}
                        </span>
                      ) : (
                        <span>
                          Created in <strong className="font-medium">{h.to.name}</strong>
                        </span>
                      )}
                      <span className="block text-xs text-muted">
                        {relativeTime(h.movedAt)}
                        {h.movedBy && ` · ${h.movedBy.fullName}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <RecordWorkspace key={deal.id} entityType="deal" entityId={deal.id} name={deal.title} canPin={canUpdate} />
      </div>

      {mover.dialog}
      {dialog === 'edit' && <DealFormDrawer open deal={deal} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await deleteDeal(deal.id)
          await refresh()
          notify({ title: 'Deal deleted', description: 'You can restore it from the bin for 30 days.' })
          navigate('/app/deals')
        }}
        title={`Delete ${deal.title}?`}
        description="It moves to the bin and can be restored for 30 days."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}
