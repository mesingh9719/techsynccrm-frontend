import { api } from '../../services/http'
const base = '/integrations/facebook'
export interface FacebookFormSettings {
  id: string; pageId: string; facebookFormId: string; name: string; mapping: Record<string, string>; enabled: boolean; defaultOwnerId: string | null; dedupe: boolean; syncStatus: string; lastSyncedAt: string | null; lastError: string | null; updatedAt: string
}
export interface FacebookPage { id: string; facebookPageId: string; name: string; enabled: boolean; forms: FacebookFormSettings[] }
export interface FacebookSdkConfiguration { appId: string; version: string; configId: string | null; scope: string }
export interface FacebookStatus { sdk: FacebookSdkConfiguration; configured: boolean; available: boolean; missing: string[]; connected: boolean; needsReconnect: boolean; apiVersion: string; callbackUrl: string | null; webhookPath: string; account: { name: string; facebookUserId: string; tokenExpiresAt: string | null } | null; pages: FacebookPage[] }
export interface FacebookPageOption { id: string; name: string; tasks: string[]; connected: boolean }
export interface FacebookForm { id: string; name: string; status: string; questions?: { key?: string; label?: string; type?: string }[]; settings: FacebookFormSettings | null }
export interface FacebookAdAccount { id: string; account_id: string; name: string; currency: string; account_status: number }
export interface FacebookCampaign { id: string; name: string; status: string; effective_status: string; objective: string }
export interface FacebookDelivery { id: string; facebookLeadId: string; facebookFormId: string; leadId: string | null; status: string; outcome: string | null; attempts: number; lastError: string | null; createdAt: string; processedAt: string | null; page: { name: string }; metadata: { campaignName?: string; campaignId?: string; adName?: string } }
export interface FacebookList<T> { items: T[]; nextCursor: string | null }
export const getFacebookStatus = () => api<FacebookStatus>(base)
export const startFacebookLogin = () => api<{ url: string }>(`${base}/connect`, { method: 'POST' })
export const disconnectFacebook = () => api<void>(base, { method: 'DELETE' })
export const getFacebookPages = (after?: string) => api<FacebookList<FacebookPageOption>>(`${base}/pages`, { query: { after } })
export const connectFacebookPage = (facebookPageId: string) => api<FacebookPage>(`${base}/pages`, { method: 'POST', body: { facebookPageId } })
export const disconnectFacebookPage = (pageId: string) => api<void>(`${base}/pages/${pageId}`, { method: 'DELETE' })
export const getFacebookForms = (pageId: string, after?: string) => api<FacebookList<FacebookForm>>(`${base}/pages/${pageId}/forms`, { query: { after } })
export const saveFacebookForm = (pageId: string, formId: string, body: Pick<FacebookFormSettings, 'enabled' | 'mapping' | 'dedupe' | 'defaultOwnerId'>) => api<FacebookFormSettings>(`${base}/pages/${pageId}/forms/${formId}`, { method: 'PUT', body })
export const syncFacebookForm = (id: string) => api<FacebookFormSettings>(`${base}/forms/${id}/sync`, { method: 'POST' })
export const getFacebookAdAccounts = (after?: string) => api<FacebookList<FacebookAdAccount>>(`${base}/ad-accounts`, { query: { after } })
export const getFacebookCampaigns = (accountId: string, after?: string) => api<FacebookList<FacebookCampaign>>(`${base}/campaigns`, { query: { accountId, after } })
export const getFacebookDeliveries = (before?: string) => api<{ items: FacebookDelivery[] }>(`${base}/deliveries`, { query: { before } })
export const retryFacebookDelivery = (id: string) => api<void>(`${base}/deliveries/${id}/retry`, { method: 'POST' })

export const prepareFacebookSdkLogin = () => api<{ nonce: string; expiresIn: number }>(`${base}/sdk/challenge`, { method: 'POST' })
export const finishFacebookSdkLogin = (body: { nonce: string; accessToken: string; userId: string; signedRequest: string }) => api<{ connected: boolean; organizationId: string }>(`${base}/sdk/connect`, { method: 'POST', body })
