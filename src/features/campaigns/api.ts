import { api } from '../../services/http'
import type { LeadPage } from '../leads/api'
import type { Campaign, CampaignInput, CampaignStatus, MetaCampaignState, UtmParameters } from './types'

export const getMetaCampaignState = (id: string) => api<MetaCampaignState>(`/campaigns/${id}/meta-status`)

export function metaAdsManagerUrl(campaign: Campaign) {
  const accountId = campaign.externalAccountId?.replace(/^act_/, '')
  return accountId && /^\d+$/.test(accountId) && /^\d+$/.test(campaign.externalCampaignId ?? '')
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${campaign.externalCampaignId}`
    : 'https://adsmanager.facebook.com/'
}

export function generateCampaignCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36)
    .replace(/-$/, '')
}

export function buildUtmUrl(landingUrl: string, utm: UtmParameters): string {
  if (!landingUrl.trim()) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(landingUrl) ? landingUrl : `https://${landingUrl}`)
    if (!['https:', 'http:'].includes(url.protocol)) return ''
    for (const [key, value] of Object.entries(utm)) if (value) url.searchParams.set(key, value)
    return url.toString()
  } catch {
    return ''
  }
}

/** The authenticated session selects the workspace; clients cannot choose another org in a body. */
export async function listCampaigns(_orgId: string): Promise<Campaign[]> {
  const items: Campaign[] = []
  let cursor: string | undefined
  do {
    const page = await api<{ items: Campaign[]; nextCursor: string | null }>('/campaigns', {
      query: { limit: 100, cursor },
    })
    items.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return items
}

export function getCampaign(_orgId: string, id: string): Promise<Campaign> {
  return api<{ campaign: Campaign }>(`/campaigns/${id}`).then((result) => result.campaign)
}

export function saveCampaign(_orgId: string, input: CampaignInput, id?: string, ifMatch?: string): Promise<Campaign> {
  return api<{ campaign: Campaign }>(id ? `/campaigns/${id}` : '/campaigns', {
    method: id ? 'PATCH' : 'POST',
    body: input,
    ifMatch,
  }).then((result) => result.campaign)
}

export async function deleteCampaign(_orgId: string, id: string, ifMatch?: string): Promise<void> {
  await api(`/campaigns/${id}`, { method: 'DELETE', ifMatch })
}

export function updateCampaignStatus(
  _orgId: string,
  id: string,
  status: CampaignStatus,
  ifMatch?: string,
): Promise<Campaign> {
  return api<{ campaign: Campaign }>(`/campaigns/${id}/status`, { method: 'POST', body: { status }, ifMatch }).then(
    (result) => result.campaign,
  )
}

export function getCampaignLeads(id: string, cursor?: string): Promise<LeadPage> {
  return api<LeadPage>(`/campaigns/${id}/leads`, { query: { limit: 25, cursor, counts: true } })
}

export async function syncMetaCampaigns(_orgId: string, adAccountId: string): Promise<{ synced: number }> {
  let synced = 0
  let after: string | undefined
  do {
    const result = await api<{ synced: number; nextCursor: string | null }>('/campaigns/sync/meta', {
      method: 'POST',
      body: { adAccountId, after },
    })
    synced += result.synced
    after = result.nextCursor ?? undefined
  } while (after)
  return { synced }
}
