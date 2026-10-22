import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '../crm/hooks'
import { useCan } from '../../lib/useOrg'
import { listCampaigns, saveCampaign, deleteCampaign, updateCampaignStatus, syncMetaCampaigns } from './api'
import type { CampaignInput, CampaignStatus } from './types'

export function useCampaigns() {
  const orgId = useOrgId()
  const allowed = useCan('campaigns.read')
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
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaigns'] }),
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaign'] }),
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaign-meta'] }),
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'campaign-leads'] }),
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'dashboard'] }),
    ])
  const save = useMutation({
    mutationFn: ({ input, id, ifMatch }: { input: CampaignInput; id?: string; ifMatch?: string }) =>
      saveCampaign(orgId, input, id, ifMatch),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: ({ id, ifMatch }: { id: string; ifMatch?: string }) => deleteCampaign(orgId, id, ifMatch),
    onSuccess: invalidate,
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
