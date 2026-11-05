import { leadStatusLabels, relativeTime } from '../crm/format'
import type { LeadRecord, LeadStatus } from '../crm/types'
import { LeadStatusBadge } from './LeadBits'

const ORDER: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost', 'junk']

/**
 * Board view of the loaded leads, one column per status. Read-only grouping of the current page of
 * results (the list API is cursor-paginated); status changes still go through the row menu or the
 * lead page, which run the lost/junk reason dialogs the API requires.
 */
export function LeadBoard({ rows, status, counts, onOpen }: { rows: LeadRecord[]; status?: LeadStatus; counts?: Partial<Record<LeadStatus, number>>; onOpen?: (lead: LeadRecord) => void }) {
  const columns = status ? [status] : ORDER
  return (
    <div className="board" role="list" aria-label="Leads by status">
      {columns.map((key) => {
        const items = rows.filter((lead) => lead.status === key)
        const total = counts?.[key]
        return (
          <section key={key} className="board-col" role="listitem" aria-label={`${leadStatusLabels[key]} leads`}>
            <header className="board-col-head">
              <LeadStatusBadge status={key} />
              <span>{total !== undefined && total > items.length ? `${items.length} of ${total}` : items.length}</span>
            </header>
            <div className="board-col-body">
              {items.length === 0 && <p className="board-empty">No leads</p>}
              {items.map((lead) => {
                const body = (
                  <>
                    <span className="block truncate text-[13px] font-medium text-ink">{lead.displayName}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{lead.companyName ?? lead.requirement ?? lead.source?.name ?? '—'}</span>
                    <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="truncate">{lead.owner?.fullName ?? 'Unassigned'}</span>
                      <span className="shrink-0 tabular-nums">{relativeTime(lead.lastActivityAt)}</span>
                    </span>
                  </>
                )
                return onOpen ? (
                  <button key={lead.id} type="button" className="board-card" onClick={() => onOpen(lead)}>
                    {body}
                  </button>
                ) : (
                  <div key={lead.id} className="board-card">
                    {body}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
