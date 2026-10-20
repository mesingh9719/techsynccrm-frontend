import { QuickFollowUp } from '../activities/QuickFollowUp'
import { InlineLeadStatus } from './InlineLeadStatus'
import { SourceBadge } from './SourceBadge'
import { Attachments } from '../files/Attachments'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CircleCheck,
  Hand,
  History,
  Mail,
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
import { Timeline } from '../activities/Timeline'
import { RecordTasks } from '../tasks/RecordTasks'
import type { LeadRecord, LeadStatus } from '../crm/types'
import { assignLead, claimLead, deleteLead, getLead, restoreLead, updateLead, type LeadInput } from './api'
import { ConvertDialog } from './ConvertDialog'
import { LeadFormDrawer } from './LeadFormDrawer'
import { ScoreBreakdownList } from './LeadBits'

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
  const [dialog, setDialog] = useState<null | 'edit' | 'convert' | 'assign' | 'delete'>(null)
  const [busy, setBusy] = useState(false)
  const lead = query.data
  useSeo({ title: lead?.displayName ?? 'Lead', noindex: true })

  if (query.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-6xl rounded-2xl" />
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
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ASSIGNED') await refresh()
      if (!handleGlobalApiError(err))
        notify({
          tone: 'error',
          title: 'Couldn’t do that',
          description: err instanceof ApiError ? err.message : undefined,
        })
    } finally {
      setBusy(false)
    }
  }

  const phone = lead.phones.find((p) => p.primary) ?? lead.phones[0]
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived || lead.customFields[d.key] !== undefined)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/app/leads" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
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
          <p className="flex items-center gap-2 text-sm text-zinc-600">
            <History className="size-4" aria-hidden="true" />
            Enquired before —{' '}
            <Link to={`/app/leads/${lead.previousLeadId}`} className="font-medium text-brand-700 hover:underline">
              see the earlier lead
            </Link>
          </p>
        )}
      </div>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar name={lead.displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{lead.displayName}</h1>
            <p className="mt-0.5 text-sm text-zinc-600">
              {[lead.companyName, lead.source?.name, lead.city].filter(Boolean).join(' · ') || 'No details yet'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <InlineLeadStatus lead={lead} />
              {lead.status === 'lost' && lead.lostReason && (
                <span className="text-xs text-zinc-500">{lead.lostReason.name}</span>
              )}
              {lead.status === 'junk' && lead.junkReason && (
                <span className="text-xs text-zinc-500">{junkReasonLabels[lead.junkReason]}</span>
              )}
              <Badge tone={lead.score >= 70 ? 'success' : lead.score >= 40 ? 'warning' : 'neutral'}>
                Score {lead.score}
              </Badge>
              <TagChips tags={lead.tags} max={6} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {phone && (
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
      </header>

      {canUpdate && (
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <p className="mb-3 text-xs font-medium text-brand-700">Keep the conversation moving</p>
          <QuickFollowUp entityType="lead" entityId={lead.id} name={lead.displayName} />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-zinc-100">
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
                      <li key={p.raw} className="flex items-center gap-1.5 tabular-nums">
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
              {lead.utm && Object.keys(lead.utm).length > 0 && (
                <FieldRow label="Campaign">
                  <span className="text-xs text-zinc-600">
                    {Object.entries(lead.utm)
                      .map(([k, v]) => `${k.replace('utm_', '')}: ${v}`)
                      .join(' · ')}
                  </span>
                </FieldRow>
              )}
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
        </div>
        <div className="space-y-6">
          {lead.status !== 'converted' && (
            <RecordTasks entityType="lead" entityId={lead.id} recordName={lead.displayName} />
          )}
          <Attachments entityType="lead" entityId={lead.id} />
          <Timeline entityType="lead" entityId={lead.id} recordName={lead.displayName} canPin={canUpdate} />
        </div>
      </div>

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
    </div>
  )
}
