import { useState } from 'react'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { Menu, MenuItem } from '../../components/app/Menu'
import { useToast } from '../../components/ui/Toast'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { leadStatusLabels } from '../crm/format'
import type { LeadRecord } from '../crm/types'
import { changeLeadStatus, LEAD_TRANSITIONS, type LeadPage, type StatusChange } from './api'
import { LeadStatusBadge } from './LeadBits'
import { StatusDialog } from './StatusDialog'
import { ChevronDown } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'

type Cache = LeadRecord | InfiniteData<LeadPage>
export function InlineLeadStatus({ lead }: { lead: LeadRecord }) {
  const client = useQueryClient(),
    orgId = useOrgId(),
    notify = useToast(),
    { user } = useAuth()
  const [reasonStatus, setReasonStatus] = useState<'lost' | 'junk' | null>(null)
  const canUpdate = useCan('leads.update')
  const ownOnly = user?.organization?.permissions.includes('leads.update.own')
  const allowed = LEAD_TRANSITIONS[lead.status]
  function updateCache(record: LeadRecord) {
    client.setQueriesData<Cache>({ queryKey: qk.org(orgId).leads.all }, (old) => {
      if (!old) return old
      if ('pages' in old)
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === record.id ? record : item)),
          })),
        }
      return old.id === record.id ? record : old
    })
  }
  const mutation = useMutation({
    meta: { skipGlobalErrorHandler: true },
    mutationFn: (change: StatusChange) => changeLeadStatus(lead.id, change),
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: qk.org(orgId).leads.all })
      updateCache({ ...lead, status: change.status })
      return lead
    },
    onSuccess: (saved) => {
      updateCache(saved)
      notify({ title: 'Lead status updated' })
    },
    onError: (error, _change, previous) => {
      if (previous) updateCache(previous)
      if (!handleGlobalApiError(error))
        notify({ tone: 'error', title: 'Couldn’t update status', description: error.message })
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: qk.org(orgId).leads.all }),
        client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll }),
        client.invalidateQueries({ queryKey: ['org', orgId, 'dashboard'] }),
      ]),
  })
  if (!canUpdate || (ownOnly && lead.ownerId !== user?.id) || lead.deletedAt || !allowed.length)
    return <LeadStatusBadge status={lead.status} />
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <Menu
        trigger={(props) => (
          <button
            {...props}
            type="button"
            disabled={mutation.isPending}
            aria-label={`Change status for ${lead.displayName}, currently ${leadStatusLabels[lead.status]}`}
            className="inline-flex items-center gap-1 rounded-lg p-1 hover:bg-zinc-100 disabled:opacity-50"
          >
            <LeadStatusBadge status={lead.status} />
            <ChevronDown className="size-3 text-muted" />
          </button>
        )}
      >
        {(close) =>
          allowed.map((status) => (
            <MenuItem
              key={status}
              onSelect={() => {
                close()
                if (status === 'lost' || status === 'junk') setReasonStatus(status)
                else mutation.mutate({ status })
              }}
            >
              {leadStatusLabels[status]}
            </MenuItem>
          ))
        }
      </Menu>
      {reasonStatus && (
        <StatusDialog
          key={reasonStatus}
          open
          allowed={allowed}
          initial={reasonStatus}
          onClose={() => setReasonStatus(null)}
          onSubmit={(change) => mutation.mutateAsync(change)}
        />
      )}
    </span>
  )
}
