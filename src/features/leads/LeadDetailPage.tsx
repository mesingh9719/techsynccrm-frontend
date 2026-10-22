import { RecordWorkspace } from '../crm/components/RecordWorkspace'
import { QuickFollowUp } from '../activities/QuickFollowUp'
import { InlineLeadStatus } from './InlineLeadStatus'
import { SourceBadge } from './SourceBadge'
import { useId, useRef, useState } from 'react'
import { RecordTasks } from '../tasks/RecordTasks'
import { TaskFormDialog } from '../tasks/TaskFormDialog'
import { StageTracker } from './detail/StageTracker'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowLeft,
  ListChecks,
  CalendarClock,
  CircleCheck,
  Hand,
  History,
  Mail,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  Repeat,
  Sparkles,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { gstStates } from '../../lib/india'
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
import { BulkAssignDialog } from '../crm/components/BulkDialogs'
import { formatCustomValue } from '../crm/customFieldFormat'
import { DeletedBanner, FieldRow, InlineText, OwnerCell, Panel } from '../crm/components/RecordParts'
import { TagChips } from '../crm/components/Tags'
import { formatMinor, formatPhone, junkReasonLabels, relativeTime, whatsappLink } from '../crm/format'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import type { LeadRecord, LeadStatus } from '../crm/types'
import { assignLead, claimLead, deleteLead, getLead, restoreLead, updateLead, type LeadInput } from './api'
import { ConvertDialog } from './ConvertDialog'
import { LeadFormDrawer } from './LeadFormDrawer'
import { ScoreBreakdownList } from './LeadBits'
import { CampaignPicker } from '../campaigns/CampaignPicker'

const FROZEN: LeadStatus[] = ['converted', 'lost', 'junk']
const stateName = (code: string | null) => gstStates.find(([c]) => c === code)?.[1] ?? null

function formatDuration(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`
  return `${Math.round(seconds / 86_400)} days`
}

/** /app/leads/:id */
export default function LeadDetailPage() {
  const { id = '' } = useParams()
  const orgId = useOrgId()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const query = useQuery({ queryKey: qk.org(orgId).leads.detail(id), queryFn: () => getLead(id) })
  const defs = useCustomFieldDefs('lead')
  const canUpdateAny = useCan('leads.update')
  const canDeleteAny = useCan('leads.delete')
  const canAssign = useCan('records.assign')
  const canReadCampaigns = useCan('campaigns.read')
  const [dialog, setDialog] = useState<null | 'edit' | 'convert' | 'assign' | 'delete' | 'campaign' | 'follow-up'>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('activity')
  const tabId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const canReadTasks = useCan('tasks.read')
  const canCreateTasks = useCan('tasks.create')
  const lead = query.data
  useSeo({ title: lead?.displayName ?? 'Lead', noindex: true })

  if (query.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-6xl rounded-card" />
  if (query.isError || !lead)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    )

  const permissions = user?.organization?.permissions ?? []
  const ownScoped = (action: string) => permissions.includes(`leads.${action}.own`) && lead.ownerId !== user?.id
  const isOpen = !FROZEN.includes(lead.status)
  const canUpdate = canUpdateAny && !ownScoped('update') && !lead.deletedAt && lead.status !== 'converted'
  const canDelete = canDeleteAny && !ownScoped('delete')
  const canClaim =
    !lead.ownerId &&
    !lead.deletedAt &&
    !FROZEN.includes(lead.status) &&
    permissions.some((p) => p === 'records.claim' || p.startsWith('records.assign'))
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.all })
  const setLead = (value: LeadRecord) => queryClient.setQueryData(qk.org(orgId).leads.detail(id), value)

  async function patch(values: Omit<LeadInput, 'ownerId'>) {
    try {
      setLead(await updateLead(lead!.id, values, { ifMatch: lead!.updatedAt }))
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.lists })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaign'] }),
        queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaign-leads'] }),
      ])
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await refresh()
      if (handleGlobalApiError(err)) throw new Error('Not saved')
      throw new Error(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save')
    }
  }

  async function act(fn: () => Promise<LeadRecord>, success: string) {
    setBusy(true)
    try {
      setLead(await fn())
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.lists })
      notify({ title: success })
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ASSIGNED') await refresh()
      if (!handleGlobalApiError(err))
        notify({
          tone: 'error',
          title: 'Couldn’t do that',
          description: err instanceof ApiError ? err.message : undefined,
        })
      return false
    } finally {
      setBusy(false)
    }
  }

  const phone = lead.phones.find((p) => p.primary) ?? lead.phones[0]
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived || lead.customFields[d.key] !== undefined)

  return (
    <div className="lead-page app-page max-w-wide">
      <Link to="/app/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Leads
      </Link>

      <div className="mt-4 space-y-2">
        {lead.deletedAt && (
          <DeletedBanner
            deletedAt={lead.deletedAt}
            canRestore={canDelete}
            onRestore={() => act(() => restoreLead(lead.id), 'Lead restored')}
          />
        )}
        {lead.status === 'converted' && (
          <div
            className="flex flex-col gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-100 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <p className="flex items-center gap-2">
              <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
              Converted {relativeTime(lead.convertedAt)}. This lead is read-only — keep working on the contact.
            </p>
            <div className="flex gap-2">
              {lead.convertedContactId && (
                <Button size="sm" variant="secondary" to={`/app/contacts/${lead.convertedContactId}`}>
                  Open contact
                </Button>
              )}
              {lead.convertedCompanyId && (
                <Button size="sm" variant="secondary" to={`/app/companies/${lead.convertedCompanyId}`}>
                  Open company
                </Button>
              )}
            </div>
          </div>
        )}
        {lead.enquiryCount > 1 && (
          <p
            className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100"
            role="status"
          >
            <Repeat className="size-4 shrink-0" aria-hidden="true" />
            Enquired {lead.enquiryCount} times — the latest {relativeTime(lead.lastActivityAt)}.
          </p>
        )}
        {lead.isExistingCustomer && lead.contactId && (
          <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100">
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            Existing contact —{' '}
            <Link to={`/app/contacts/${lead.contactId}`} className="font-medium underline">
              open their record
            </Link>
          </p>
        )}
        {lead.previousLeadId && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <History className="size-4" aria-hidden="true" />
            Enquired before —{' '}
            <Link to={`/app/leads/${lead.previousLeadId}`} className="font-medium text-brand-700 hover:underline">
              see the earlier lead
            </Link>
          </p>
        )}
      </div>

      <header className="lead-header surface mt-4">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{lead.displayName}</h1>
            <p className="mt-1 text-sm text-muted">
              {[lead.companyName, lead.source?.name, lead.city].filter(Boolean).join(' · ') || 'No details yet'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <InlineLeadStatus lead={lead} />
              {lead.status === 'lost' && lead.lostReason && (
                <span className="text-xs text-muted">{lead.lostReason.name}</span>
              )}
              {lead.status === 'junk' && lead.junkReason && (
                <span className="text-xs text-muted">{junkReasonLabels[lead.junkReason]}</span>
              )}
              <Badge tone={lead.score >= 70 ? 'success' : lead.score >= 40 ? 'warning' : 'neutral'}>
                Score {lead.score}
              </Badge>
              <TagChips tags={lead.tags} max={6} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canClaim && (
            <Button size="sm" loading={busy} onClick={() => act(() => claimLead(lead.id), 'Lead claimed — it’s yours')}>
              <Hand className="size-4" aria-hidden="true" />
              Claim
            </Button>
          )}
          {canUpdate && isOpen && (
            <Button size="sm" onClick={() => setDialog('convert')}>
              <Sparkles className="size-4" aria-hidden="true" />
              Convert
            </Button>
          )}
          {canUpdate && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('edit')} aria-label="Edit lead">
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          )}
          {canDelete && !lead.deletedAt && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('delete')} aria-label="Delete lead">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4"><StageTracker lead={lead} canUpdate={Boolean(canUpdate) && !busy} onChange={act} onConvert={() => setDialog('convert')} /></div>
      </header>

      <div className="lead-layout">
        <div role="tablist" aria-label="Lead sections" className="lead-tabs">
          {[
            { key: 'activity', label: 'Activity', icon: Activity },
            { key: 'details', label: 'Details', icon: UserRound },
            { key: 'next', label: 'Next steps', icon: ListChecks },
          ].map((item, index, items) => <button key={item.key} ref={(element) => { tabRefs.current[index] = element }} type="button" role="tab" id={`${tabId}-${item.key}-tab`} aria-controls={`${tabId}-${item.key}-panel`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)} onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
            setTab(items[next].key); tabRefs.current[next]?.focus()
          }} className="lead-tab"><item.icon className="size-4" aria-hidden="true" />{item.label}</button>)}
        </div>
        <div className="lead-grid">
        <section id={`${tabId}-details-panel`} role="tabpanel" aria-labelledby={`${tabId}-details-tab`} aria-label="Lead details" className="lead-col lead-col-profile" data-active={tab === 'details' || undefined}>
          <Panel title="Lead profile">
            <div className="flex items-center gap-3"><Avatar name={lead.displayName} size="lg" /><div className="min-w-0"><p className="truncate font-display text-lg font-semibold" title={lead.displayName}>{lead.displayName}</p><p className="mt-1 truncate text-sm text-muted">{lead.companyName ?? 'Individual enquiry'}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2">          {phone && (
            <Button href={`tel:${phone.e164 ?? phone.raw}`} variant="secondary" size="sm">
              <Phone className="size-4" aria-hidden="true" />
              Call
            </Button>
          )}
          {phone?.e164 && (
            <Button href={whatsappLink(phone.e164)!} target="_blank" rel="noreferrer" variant="secondary" size="sm">
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </Button>
          )}
          {lead.primaryEmail && (
            <Button href={`mailto:${lead.primaryEmail}`} variant="secondary" size="sm">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </Button>
          )}
            </div>
          </Panel>
          <Panel title="Details">
            <dl className="divide-y divide-line">
              <FieldRow label="Requirement">
                <InlineText
                  label="requirement"
                  multiline
                  value={lead.requirement}
                  disabled={!canUpdate}
                  onSave={(v) => patch({ requirement: v })}
                />
              </FieldRow>
              <FieldRow label="Company">
                <InlineText
                  label="company"
                  value={lead.companyName}
                  disabled={!canUpdate}
                  onSave={(v) => patch({ companyName: v })}
                />
              </FieldRow>
              <FieldRow label="Phone">
                {lead.phones.length ? (
                  <ul className="space-y-1">
                    {lead.phones.map((p) => (
                      <li key={p.raw} className="flex items-center gap-2 tabular-nums">
                        {p.primary && lead.phones.length > 1 && (
                          <Star className="size-3 fill-amber-400 text-amber-400" aria-label="Primary" />
                        )}
                        <a href={`tel:${p.e164 ?? p.raw}`} className="hover:underline">
                          {formatPhone(p.e164, p.raw)}
                        </a>
                        {!p.e164 && <span className="text-xs text-amber-700">(not a valid number)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </FieldRow>
              <FieldRow label="Email">
                {lead.emails.length ? lead.emails.map((e) => <div key={e.value}>{e.value}</div>) : '—'}
              </FieldRow>
              <FieldRow label="Budget">{formatMinor(lead.budgetMinor)}</FieldRow>
              <FieldRow label="Location">
                {[lead.city, stateName(lead.stateCode), lead.pincode].filter(Boolean).join(', ') || '—'}
              </FieldRow>
              <FieldRow label="Source">
                <SourceBadge name={lead.source?.name} />
              </FieldRow>
              <FieldRow label="Source details">
                <InlineText
                  label="source details"
                  value={lead.sourceDetail}
                  disabled={!canUpdate}
                  onSave={(v) => patch({ sourceDetail: v })}
                />
              </FieldRow>
              <FieldRow label="Campaign">
                <div className="w-full">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <Megaphone className="size-4 text-muted shrink-0" />
                      {lead.utm?.utm_campaign || lead.sourceDetail ? (
                        <span className="text-xs font-semibold text-ink">
                          {lead.sourceDetail || lead.utm?.utm_campaign}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Not attributed</span>
                      )}
                    </div>
                    {canUpdate && canReadCampaigns && (
                      <button
                        type="button"
                        onClick={() => setDialog('campaign')}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        {lead.utm?.utm_campaign || lead.sourceDetail ? 'Change' : 'Associate'}
                      </button>
                    )}
                  </div>
                  {lead.utm && Object.keys(lead.utm).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 font-mono text-xs text-muted">
                      {Object.entries(lead.utm).map(([k, v]) => (
                        <span key={k} className="rounded-control border border-line bg-surface-subtle px-2 py-1">
                          {k.replace('utm_', '')}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Owner">
                <span className="flex flex-wrap items-center gap-2">
                  <OwnerCell owner={lead.owner} />
                  {canAssign && !FROZEN.includes(lead.status) && !lead.deletedAt && (
                    <button
                      type="button"
                      onClick={() => setDialog('assign')}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Change
                    </button>
                  )}
                </span>
              </FieldRow>
              <FieldRow label="First response">
                {lead.firstResponseSeconds !== null
                  ? `${formatDuration(lead.firstResponseSeconds)} after the enquiry`
                  : 'Not yet'}
              </FieldRow>
              <FieldRow label="Created">{relativeTime(lead.createdAt)}</FieldRow>
              {lead.status === 'lost' && lead.lostNote && <FieldRow label="Lost note">{lead.lostNote}</FieldRow>}
              {activeDefs.map((d) => (
                <FieldRow key={d.id} label={d.label}>
                  {formatCustomValue(d, lead.customFields[d.key])}
                </FieldRow>
              ))}
            </dl>
          </Panel>
          {lead.scoreBreakdown && (
            <Panel title={`Score · ${lead.score}/100`}>
              <div className="text-sm">
                <ScoreBreakdownList breakdown={lead.scoreBreakdown} frozen={FROZEN.includes(lead.status)} />
              </div>
            </Panel>
          )}
        </section>
        <section id={`${tabId}-activity-panel`} role="tabpanel" aria-labelledby={`${tabId}-activity-tab`} aria-label="Lead activity" className="lead-col lead-col-main" data-active={tab === 'activity' || undefined}>
        <RecordWorkspace key={lead.id} entityType="lead" entityId={lead.id} name={lead.displayName} canPin={canUpdate} allowTasks={false} deals={
          <Panel title="Deals"><p className="text-sm leading-6 text-muted">Convert this lead to manage opportunities from its contact record.</p>{(lead.convertedContactId || lead.contactId) ? <Button className="mt-4" variant="secondary" to={`/app/contacts/${lead.convertedContactId ?? lead.contactId}`}>Open contact and deals</Button> : canUpdate && isOpen ? <Button className="mt-4" onClick={() => setDialog('convert')}>Convert lead</Button> : null}</Panel>
        } />
        </section>
        <aside id={`${tabId}-next-panel`} role="tabpanel" aria-labelledby={`${tabId}-next-tab`} aria-label="Next steps" className="lead-col lead-col-next" data-active={tab === 'next' || undefined}>
          <Panel title="Next best step">
            <p className="text-sm leading-6 text-muted">{lead.deletedAt ? 'Restore this lead before making changes.' : lead.status === 'converted' ? 'Continue the conversation from the contact record.' : lead.status === 'new' ? 'Start the conversation, confirm what they need, and log the outcome.' : lead.status === 'contacted' ? 'Confirm the requirement and budget, then qualify the enquiry.' : lead.status === 'qualified' ? 'Convert the qualified enquiry into a contact and opportunity.' : 'Review the reason this lead was closed before reopening it.'}</p>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted">Owner</dt><dd><OwnerCell owner={lead.owner} /></dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Budget</dt><dd className="font-medium tabular-nums">{formatMinor(lead.budgetMinor)}</dd></div></dl>
            {canClaim && <Button className="mt-4 w-full" loading={busy} onClick={() => act(() => claimLead(lead.id), 'Lead claimed — it’s yours')}>Claim lead</Button>}
            {canUpdate && lead.status === 'qualified' && <Button className="mt-4 w-full" onClick={() => setDialog('convert')}>Convert lead</Button>}
          </Panel>
      {canCreateTasks && !lead.deletedAt && lead.status !== 'converted' && (
        <div className="surface p-4">
          <p className="mb-3 text-xs font-medium text-brand-700">Keep the conversation moving</p>
          <QuickFollowUp key={lead.id} entityType="lead" entityId={lead.id} name={lead.displayName} />
        </div>
      )}


          {canReadTasks && lead.status !== 'converted' && !lead.deletedAt && <RecordTasks key={lead.id} entityType="lead" entityId={lead.id} recordName={lead.displayName} />}
        </aside>
        </div>
      </div>

      {!lead.deletedAt && (phone || lead.primaryEmail || (canCreateTasks && lead.status !== 'converted')) && <nav className="lead-mobile-bar" aria-label="Lead quick actions">
        {phone && <a href={`tel:${phone.e164 ?? phone.raw}`} className="lead-mobile-action is-primary"><Phone className="size-5" aria-hidden="true" /><span>Call</span></a>}
        {phone?.e164 && <a href={whatsappLink(phone.e164)!} target="_blank" rel="noreferrer" className="lead-mobile-action"><MessageCircle className="size-5" aria-hidden="true" /><span>WhatsApp</span></a>}
        {lead.primaryEmail && <a href={`mailto:${lead.primaryEmail}`} className="lead-mobile-action"><Mail className="size-5" aria-hidden="true" /><span>Email</span></a>}
        {canCreateTasks && lead.status !== 'converted' && <button type="button" className="lead-mobile-action" onClick={() => setDialog('follow-up')}><CalendarClock className="size-5" aria-hidden="true" /><span>Follow-up</span></button>}
      </nav>}

      {dialog === 'follow-up' && <TaskFormDialog record={{ entityType: 'lead', entityId: lead.id, name: lead.displayName }} defaults={{ type: 'follow_up', title: `Follow up with ${lead.displayName}` }} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <LeadFormDrawer open lead={lead} onClose={() => setDialog(null)} />}
      {dialog === 'convert' && <ConvertDialog lead={lead} onClose={() => setDialog(null)} />}
      <BulkAssignDialog
        open={dialog === 'assign'}
        count={1}
        onClose={() => setDialog(null)}
        onAssign={async (ownerId) => {
          setLead(await assignLead(lead.id, ownerId))
          await queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.lists })
          notify({ title: ownerId ? 'Lead reassigned' : 'Lead is now unassigned' })
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await deleteLead(lead.id)
          await refresh()
          notify({ title: 'Lead deleted', description: 'You can restore it from the bin for 30 days.' })
          navigate('/app/leads')
        }}
        title={`Delete ${lead.displayName}?`}
        description="It moves to the bin and can be restored for 30 days."
        confirmLabel="Delete"
        tone="danger"
      />
      {dialog === 'campaign' && (
        <CampaignPicker
          open={true}
          currentCampaignCode={lead.utm?.utm_campaign}
          currentCampaignName={lead.sourceDetail ?? undefined}
          onClose={() => setDialog(null)}
          onSelect={async (camp) => {
            if (!camp) {
              const nextUtm = lead.utm
                ? Object.fromEntries(
                    Object.entries(lead.utm).filter(([k]) => !['utm_campaign', 'campaign_id', 'campaign'].includes(k)),
                  )
                : null
              await patch({
                sourceDetail: null,
                utm: nextUtm && Object.keys(nextUtm).length > 0 ? nextUtm : null,
              })
              notify({ title: 'Campaign attribution removed' })
            } else {
              await patch({
                sourceDetail: camp.name,
                utm: {
                  ...(lead.utm ?? {}),
                  utm_campaign: camp.code,
                  campaign_id: camp.id,
                  ...(camp.utm.utm_source ? { utm_source: camp.utm.utm_source } : {}),
                  ...(camp.utm.utm_medium ? { utm_medium: camp.utm.utm_medium } : {}),
                },
              })
              notify({ title: `Attributed to ${camp.name}` })
            }
          }}
        />
      )}
    </div>
  )
}
