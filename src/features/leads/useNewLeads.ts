import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { listLeads } from './api'

/** A bounded latest-leads poll; old/initial records and the actor's own manual creates do not toast. */
export function useNewLeads() {
  const { user } = useAuth(),
    canRead = useCan('leads.read'),
    client = useQueryClient(),
    navigate = useNavigate(),
    notify = useToast()
  const orgId = user?.organization?.id ?? 'none'
  const previous = useRef<{ orgId: string; ids: Set<string>; newest: string } | null>(null)
  const query = useQuery({
    queryKey: ['org', orgId, 'lead-arrivals'],
    queryFn: () => listLeads({ limit: 25, sort: '-createdAt' }),
    enabled: canRead && orgId !== 'none',
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    meta: { skipGlobalErrorHandler: true },
  })
  useEffect(() => {
    if (!query.data) return
    const rows = query.data.items,
      before = previous.current
    const fresh =
      before?.orgId === orgId
        ? rows.filter(
            (lead) => !before.ids.has(lead.id) && lead.createdAt > before.newest && lead.createdById !== user?.id,
          )
        : []
    previous.current = {
      orgId,
      ids: new Set(rows.map((r) => r.id)),
      newest: rows[0]?.createdAt ?? before?.newest ?? '',
    }
    if (!fresh.length) return
    notify({
      title: fresh.length === 1 ? `New lead: ${fresh[0].displayName}` : `${fresh.length} new leads received`,
      description: 'Your lead inbox has been updated.',
      action: {
        label: 'View leads',
        onClick: () => {
          navigate('/app/leads?status=new')
        },
      },
    })
    void client.invalidateQueries({ queryKey: qk.org(orgId).leads.all })
    void client.invalidateQueries({ queryKey: ['org', orgId, 'dashboard'] })
  }, [query.data, orgId, user?.id, client, navigate, notify])
}
