import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Copy, History, Repeat, UserRound } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { DeletedBanner } from '../../crm/components/RecordParts'
import { matchedOnLabels, relativeTime } from '../../crm/format'
import { useOrgId } from '../../crm/hooks'
import type { LeadRecord } from '../../crm/types'
import { checkLeadDuplicates } from '../api'
import { Card } from './InlineFields'

/**
 * Contextual alerts, one place: blocking states (deleted, converted) as banners; informational
 * history (repeat enquiry, existing customer, earlier lead) as one compact chip row.
 */
export function LeadAlerts({ lead, canRestore, onRestore }: { lead: LeadRecord; canRestore: boolean; onRestore: () => void }) {
  const chips = [
    lead.enquiryCount > 1 && (
      <span key="repeat" className="alert-chip is-warning">
        <Repeat className="size-3.5" aria-hidden="true" />
        Enquired {lead.enquiryCount}× · latest{lead.latestSource ? ` via ${lead.latestSource.name}` : ''} {relativeTime(lead.latestEnquiryAt ?? lead.lastActivityAt)}
      </span>
    ),
    lead.isExistingCustomer && lead.contactId && (
      <Link key="customer" to={`/app/contacts/${lead.contactId}`} className="alert-chip is-brand">
        <UserRound className="size-3.5" aria-hidden="true" />
        Existing customer — open contact
      </Link>
    ),
    lead.previousLeadId && (
      <Link key="previous" to={`/app/leads/${lead.previousLeadId}`} className="alert-chip">
        <History className="size-3.5" aria-hidden="true" />
        Earlier enquiry
      </Link>
    ),
  ].filter(Boolean)

  return (
    <>
      {lead.deletedAt && <DeletedBanner deletedAt={lead.deletedAt} canRestore={canRestore} onRestore={onRestore} />}
      {lead.status === 'converted' && (
        <div
          className="flex flex-col gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-100 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="flex items-center gap-2">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            Converted {relativeTime(lead.convertedAt)}. This lead is now read-only.
          </p>
          <div className="flex flex-wrap gap-2">
            {lead.convertedContactId && (
              <Button size="sm" variant="secondary" to={`/app/contacts/${lead.convertedContactId}`}>
                Contact
              </Button>
            )}
            {lead.convertedCompanyId && (
              <Button size="sm" variant="secondary" to={`/app/companies/${lead.convertedCompanyId}`}>
                Company
              </Button>
            )}
            {lead.convertedDealId && (
              <Button size="sm" to={`/app/deals/${lead.convertedDealId}`}>
                Open deal
              </Button>
            )}
          </div>
        </div>
      )}
      {chips.length > 0 && <div className="flex flex-wrap gap-2">{chips}</div>}
    </>
  )
}

/** Other leads/contacts sharing this lead's phone or email. Hidden when there are none. */
export function DuplicatesCard({ lead }: { lead: LeadRecord }) {
  const orgId = useOrgId()
  const emails = lead.emails.map((e) => e.value)
  const phones = lead.phones.map((p) => p.e164 ?? p.raw)
  const query = useQuery({
    queryKey: ['org', orgId, 'leads', 'duplicates', lead.id, emails, phones],
    queryFn: ({ signal }) => checkLeadDuplicates({ emails, phones, excludeId: lead.id }, signal),
    enabled: (emails.length > 0 || phones.length > 0) && !lead.deletedAt,
    staleTime: 60_000,
  })
  const items = query.data ?? []
  if (!items.length) return null
  return (
    <Card title={items.length === 1 ? 'Possible duplicate' : `${items.length} possible duplicates`} icon={Copy} className="ring-1 ring-amber-200">
      <ul className="space-y-2">
        {items.slice(0, 5).map((d) => (
          <li key={`${d.entityType ?? 'lead'}${d.id}`} className="text-sm">
            <Link
              to={d.entityType === 'contact' ? `/app/contacts/${d.id}` : `/app/leads/${d.id}`}
              className="font-medium text-ink hover:text-brand-700 hover:underline"
            >
              {d.displayName}
            </Link>
            <p className="text-xs text-muted">
              {d.entityType === 'contact' ? 'Contact' : `${d.status ?? ''} lead`} · same {matchedOnLabels[d.matchedOn]}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
