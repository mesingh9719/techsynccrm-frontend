import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { qk } from '../../lib/queryKeys'
import { useCan } from '../../lib/useOrg'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/app/States'
import { Panel } from '../crm/components/RecordParts'
import { formatMinor } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import { listDeals } from './api'
import { DealFormDrawer } from './DealFormDrawer'

const tone = { open: 'brand', won: 'success', lost: 'danger' } as const

/** Deals linked to a contact or company (their detail pages), with "New deal" pre-filled. */
export function RecordDeals({ contact, company }: { contact?: { id: string; name: string }; company?: { id: string; name: string } }) {
  const orgId = useOrgId()
  const canCreate = useCan('deals.create')
  const [creating, setCreating] = useState(false)
  const params = { ...(contact && { contactId: contact.id }), ...(company && { companyId: company.id }), limit: 50 }
  const deals = useQuery({ queryKey: qk.org(orgId).deals.list(params), queryFn: () => listDeals(params) })
  const items = deals.data?.items ?? []
  const open = items.filter((d) => d.status === 'open')

  return (
    <Panel
      title={`Deals${items.length ? ` (${items.length})` : ''}`}
      actions={
        canCreate && (
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            New deal
          </Button>
        )
      }
    >
      {deals.isPending ? (
        <Skeleton className="h-12" />
      ) : items.length ? (
        <>
          {open.length > 0 && <p className="mb-2 text-xs text-zinc-500">Open: {formatMinor(open.reduce((n, d) => n + d.valueMinor, 0))}</p>}
          <ul className="divide-y divide-zinc-100">
            {items.map((d) => (
              <li key={d.id}>
                <Link to={`/app/deals/${d.id}`} className="flex items-center gap-3 py-2.5 hover:bg-zinc-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">{d.title}</span>
                    <span className="block truncate text-xs text-zinc-500">{d.pipeline.name}</span>
                  </span>
                  <Badge tone={tone[d.status]}>{d.status === 'open' ? d.stage.name : d.status === 'won' ? 'Won' : 'Lost'}</Badge>
                  <span className="text-sm font-medium tabular-nums">{formatMinor(d.valueMinor)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-zinc-500">No deals yet.</p>
      )}
      {creating && (
        <DealFormDrawer
          open
          onClose={() => setCreating(false)}
          defaults={{ ...(company && { company: { id: company.id, label: company.name } }), ...(contact && { contact: { id: contact.id, label: contact.name } }) }}
        />
      )}
    </Panel>
  )
}
