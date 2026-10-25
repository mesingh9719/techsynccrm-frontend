import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Check, Copy, Flame, Hand, Mail, Megaphone, Pencil, Phone, Snowflake, Star, ThermometerSun, UserRound } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { gstStates } from '../../../lib/india'
import { useCan } from '../../../lib/useOrg'
import { useToast } from '../../../components/ui/Toast'
import { CampaignPicker } from '../../campaigns/CampaignPicker'
import { OwnerCell, InlineMoney, InlineText } from '../../crm/components/RecordParts'
import { TagChips, TagPicker } from '../../crm/components/Tags'
import { formatCustomValue } from '../../crm/customFieldFormat'
import { formatPhone, relativeTime } from '../../crm/format'
import { useCustomFieldDefs } from '../../crm/hooks'
import type { LeadRecord } from '../../crm/types'
import { SourceBadge } from '../SourceBadge'
import { qualificationOptions, type LeadPriority, type LeadQualification } from './extrasApi'
import { Card, InlineDate, InlineSelect, Row } from './InlineFields'
import type { LeadDetail } from './useLeadDetail'

const stateName = (code: string | null) => gstStates.find(([c]) => c === code)?.[1] ?? null

const priorityStyle: Record<LeadPriority, { icon: typeof Flame; className: string }> = {
  hot: { icon: Flame, className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  warm: { icon: ThermometerSun, className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  cold: { icon: Snowflake, className: 'bg-sky-50 text-sky-700 ring-sky-200' },
}

export function PriorityLabel({ priority }: { priority: LeadPriority }) {
  const { icon: Icon, className } = priorityStyle[priority]
  const label = qualificationOptions.priorities.find((p) => p.value === priority)?.label
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset', className)}>
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </span>
  )
}

/** Hover/focus-revealed copy button for a contact value. */
function CopyValue({ value, label }: { value: string; label: string }) {
  const notify = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
            notify({ title: `Copied ${label}` })
          })
          .catch(() => notify({ tone: 'error', title: `Couldn’t copy the ${label}` }))
      }}
      className="compact-control ml-auto shrink-0 rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-subtle hover:text-ink focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  )
}

function formatDuration(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`
  return `${Math.round(seconds / 86_400)} days`
}

/** Left column: who the lead is, how to reach them, and the deal facts — all editable in place. */
export function ProfileCard({
  detail,
  qualification,
  saveQualification,
  onEditContacts,
  onAssign,
  onClaim,
}: {
  detail: LeadDetail
  qualification: LeadQualification
  saveQualification: (values: Partial<LeadQualification>) => Promise<unknown>
  onEditContacts: () => void
  onAssign: () => void
  onClaim: () => void
}) {
  const lead = detail.lead as LeadRecord
  const { can, patch } = detail
  const defs = useCustomFieldDefs('lead')
  const canReadCampaigns = useCan('campaigns.read')
  const notify = useToast()
  const [editingTags, setEditingTags] = useState(false)
  const [pickingCampaign, setPickingCampaign] = useState(false)
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived || lead.customFields[d.key] !== undefined)
  const campaign = lead.campaign ?? (lead.campaignId === undefined && lead.utm?.utm_campaign ? { id: lead.utm.campaign_id ?? '', code: lead.utm.utm_campaign, name: lead.sourceDetail ?? lead.utm.utm_campaign } : null)

  return (
    <>
      <Card
        title="Contact"
        icon={UserRound}
        actions={
          can.update && (
            <button type="button" onClick={onEditContacts} className="text-xs font-medium text-brand-700 hover:underline">
              Edit
            </button>
          )
        }
      >
        <dl className="lead-fields">
          <Row label="Phone" id="lead-field-phone">
            {lead.phones.length ? (
              <ul className="space-y-1">
                {lead.phones.map((p) => (
                  <li key={p.raw} className="group flex items-center gap-2 tabular-nums">
                    <Phone className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    <a href={`tel:${p.e164 ?? p.raw}`} className="truncate hover:text-brand-700 hover:underline">
                      {formatPhone(p.e164, p.raw)}
                    </a>
                    {p.primary && lead.phones.length > 1 && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Primary" />}
                    {!p.e164 && <span className="text-xs text-warning">invalid</span>}
                    <CopyValue value={p.e164 ?? p.raw} label="phone number" />
                  </li>
                ))}
              </ul>
            ) : can.update ? (
              <button type="button" onClick={onEditContacts} className="text-muted hover:text-ink">Add phone…</button>
            ) : '—'}
          </Row>
          <Row label="Email" id="lead-field-email">
            {lead.emails.length ? (
              <ul className="space-y-1">
                {lead.emails.map((e) => (
                  <li key={e.value} className="group flex min-w-0 items-center gap-2">
                    <Mail className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    <a href={`mailto:${e.value}`} className="truncate hover:text-brand-700 hover:underline" title={e.value}>
                      {e.value}
                    </a>
                    <CopyValue value={e.value} label="email" />
                  </li>
                ))}
              </ul>
            ) : can.update ? (
              <button type="button" onClick={onEditContacts} className="text-muted hover:text-ink">Add email…</button>
            ) : '—'}
          </Row>
          <Row label="Company" id="lead-field-company">
            <InlineText label="company" value={lead.companyName} disabled={!can.update} onSave={(v) => patch({ companyName: v })} />
          </Row>
          <Row label="City">
            <InlineText label="city" value={lead.city} disabled={!can.update} onSave={(v) => patch({ city: v })} />
            {(lead.stateCode || lead.pincode) && (
              <p className="text-xs text-muted">{[stateName(lead.stateCode), lead.pincode].filter(Boolean).join(' · ')}</p>
            )}
          </Row>
        </dl>
      </Card>

      <Card title="Deal" icon={BriefcaseBusiness}>
        <dl className="lead-fields">
          <Row label="Owner" id="lead-field-owner">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <OwnerCell owner={lead.owner} />
              {can.claim && (
                <button type="button" onClick={onClaim} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                  <Hand className="size-3" aria-hidden="true" /> Claim
                </button>
              )}
              {can.assign && (
                <button type="button" onClick={onAssign} className="text-xs font-medium text-brand-700 hover:underline">
                  Change
                </button>
              )}
            </span>
          </Row>
          <Row label="Priority">
            <InlineSelect
              label="Priority"
              value={qualification.priority}
              options={qualificationOptions.priorities}
              disabled={!can.update}
              placeholder="Set priority…"
              render={(v) => <PriorityLabel priority={v} />}
              onSave={(priority) => saveQualification({ priority })}
            />
          </Row>
          <Row label="Deal value" id="lead-field-dealValue">
            <InlineMoney
              label="expected deal value in rupees"
              value={qualification.dealValueMinor}
              placeholder="Add value…"
              disabled={!can.update}
              strong
              onSave={(dealValueMinor) => saveQualification({ dealValueMinor })}
            />
          </Row>
          <Row label="Close by">
            <InlineDate
              label="Expected close date"
              value={qualification.expectedCloseDate}
              disabled={!can.update}
              onSave={(expectedCloseDate) => saveQualification({ expectedCloseDate })}
            />
          </Row>
          <Row label="Tags">
            {editingTags ? (
              <div className="space-y-2">
                <TagPicker
                  label="Tags"
                  value={lead.tags.map((t) => t.id)}
                  onChange={(tagIds) =>
                    patch({ tagIds }).catch((err: Error) => notify({ tone: 'error', title: 'Tags not saved', description: err.message }))
                  }
                />
                <button type="button" onClick={() => setEditingTags(false)} className="text-xs font-medium text-brand-700 hover:underline">
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!can.update}
                onClick={() => setEditingTags(true)}
                className={cn('group -mx-2 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left', can.update && 'hover:bg-surface-subtle')}
                aria-label="Edit tags"
              >
                {lead.tags.length ? <TagChips tags={lead.tags} max={8} /> : <span className="text-muted">{can.update ? 'Add tags…' : '—'}</span>}
                {can.update && <Pencil className="ml-auto size-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100" aria-hidden="true" />}
              </button>
            )}
          </Row>
        </dl>
      </Card>

      <Card title="Source" icon={Megaphone}>
        <dl className="lead-fields">
          <Row label="Source">
            <SourceBadge name={lead.source?.name} />
          </Row>
          {lead.latestEnquiryAt && (
            <Row label="Latest enquiry">
              <span className="block">
                {lead.latestSource?.name ?? 'Unknown source'}
                {lead.latestWebForm && (
                  <>
                    {' · '}
                    <Link to={`/app/settings/forms/${lead.latestWebForm.id}`} className="text-brand-700 hover:underline">
                      {lead.latestWebForm.name}
                    </Link>
                  </>
                )}
              </span>
              <span className="block text-xs text-muted">{relativeTime(lead.latestEnquiryAt)}</span>
            </Row>
          )}
          {lead.webForm && (
            <Row label="Web form">
              <Link to={`/app/settings/forms/${lead.webForm.id}`} className="text-brand-700 hover:underline">
                {lead.webForm.name}
              </Link>
            </Row>
          )}
          {lead.assignmentHeldAt && !lead.ownerId && (
            <Row label="Routing">
              <span className="text-warning">Waiting for working hours to assign</span>
            </Row>
          )}
          <Row label="Details">
            <InlineText label="source details" value={lead.sourceDetail} disabled={!can.update} onSave={(v) => patch({ sourceDetail: v })} />
          </Row>
          <Row label="Campaign">
            <span className="flex flex-wrap items-center gap-2">
              <Megaphone className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              {campaign?.id && canReadCampaigns && !('deleted' in campaign && campaign.deleted) ? (
                <Link to={`/app/campaigns/${campaign.id}`} title={campaign.code} className="min-w-0 truncate hover:text-brand-700 hover:underline">
                  {campaign.name}
                </Link>
              ) : (
                <span className={cn('min-w-0 truncate', !campaign && 'text-muted')}>{campaign?.name ?? 'Not attributed'}</span>
              )}
              {campaign && 'deleted' in campaign && campaign.deleted && <span className="text-xs text-muted">Deleted campaign</span>}
              {can.update && canReadCampaigns && (
                <button type="button" onClick={() => setPickingCampaign(true)} className="text-xs font-medium text-brand-700 hover:underline">
                  {campaign ? 'Change' : 'Link'}
                </button>
              )}
            </span>
          </Row>
          {lead.utm && Object.keys(lead.utm).length > 0 && (
            <Row label="UTM">
              <span className="flex flex-wrap gap-1 font-mono text-xs text-muted">
                {Object.entries(lead.utm).map(([k, v]) => (
                  <span key={k} className="rounded border border-line bg-surface-subtle px-1.5 py-0.5">
                    {k.replace('utm_', '')}: {v}
                  </span>
                ))}
              </span>
            </Row>
          )}
          <Row label="Created">{relativeTime(lead.createdAt)}</Row>
          <Row label="First reply">
            {lead.firstResponseSeconds !== null ? `${formatDuration(lead.firstResponseSeconds)} after enquiry` : <span className="text-warning">Not yet</span>}
          </Row>
          {activeDefs.map((d) => (
            <Row key={d.id} label={d.label}>
              {formatCustomValue(d, lead.customFields[d.key])}
            </Row>
          ))}
        </dl>
      </Card>

      {pickingCampaign && (
        <CampaignPicker
          open
          currentCampaignId={lead.campaignId ?? undefined}
          currentCampaignCode={lead.campaign?.code ?? (lead.campaignId === undefined ? lead.utm?.utm_campaign : undefined)}
          currentCampaignName={lead.sourceDetail ?? undefined}
          onClose={() => setPickingCampaign(false)}
          onSelect={async (camp) => {
            await patch({ campaignId: camp?.id ?? null })
            notify({ title: camp ? `Attributed to ${camp.name}` : 'Campaign attribution removed' })
          }}
        />
      )}
    </>
  )
}
