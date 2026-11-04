import { invalidateSales } from '../crm/invalidateSales'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import { useCan } from '../../lib/useOrg'
import { listCampaigns, saveCampaign, deleteCampaign, updateCampaignStatus, syncMetaCampaigns, getCampaignOptions } from './api'
import type { CampaignInput, CampaignStatus } from './types'

export function useCampaigns() {
  const orgId = useOrgId()
  const allowed = useCan('campaigns.list')
  return useQuery({
    queryKey: ['org', orgId, 'campaigns'],
    queryFn: () => listCampaigns(orgId),
    enabled: orgId !== 'none' && allowed,
    staleTime: 60_000,
  })
}

export function useCampaignMutations() {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const invalidate = () => invalidateSales(queryClient, orgId, { leads: true })
  const save = useMutation({
    mutationFn: ({ input, id, ifMatch }: { input: CampaignInput; id?: string; ifMatch?: string }) =>
      saveCampaign(orgId, input, id, ifMatch),
    onSuccess: invalidate,
    onError: error => { if (error instanceof ApiError && error.code === 'STALE_UPDATE') return invalidate() },
  })
  const remove = useMutation({
    mutationFn: ({ id, ifMatch }: { id: string; ifMatch?: string }) => deleteCampaign(orgId, id, ifMatch),
    onSuccess: () => invalidateSales(queryClient, orgId, { leads: true, refetchType: 'none' }),
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status, ifMatch }: { id: string; status: CampaignStatus; ifMatch?: string }) =>
      updateCampaignStatus(orgId, id, status, ifMatch),
    onSettled: invalidate,
  })
  const syncMeta = useMutation({
    mutationFn: (adAccountId: string) => syncMetaCampaigns(orgId, adAccountId),
    onSuccess: invalidate,
  })
  return { save, remove, setStatus, syncMeta }
}

export function useCampaignOptions() {
  const orgId = useOrgId(), allowed = useCan('campaigns.read')
  return useQuery({ queryKey: ['org', orgId, 'campaign-options'], queryFn: getCampaignOptions, enabled: allowed && orgId !== 'none', staleTime: Infinity })
}
