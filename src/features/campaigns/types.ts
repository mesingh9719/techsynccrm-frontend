export type CampaignType = 'meta_ads' | 'google_ads' | 'email' | 'sms' | 'website' | 'referral' | 'offline' | 'other'

export type CampaignObjective =
  'lead_generation' | 'brand_awareness' | 'conversion' | 'retargeting' | 'event' | 'retention'

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived'

export interface UtmParameters {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export interface CampaignMetrics {
  impressions?: number
  clicks?: number
  leadsCount: number
  contactedCount: number
  qualifiedCount: number
  convertedCount: number
  dealsWonCount: number
  revenueWonMinor: number
  costPerLeadMinor: number | null
  conversionRate: number
  roas?: number | null
}

export interface Campaign {
  id: string
  organizationId: string
  name: string
  code: string
  type: CampaignType
  objective: CampaignObjective
  status: CampaignStatus
  startDate: string
  endDate?: string | null
  budgetMinor?: number | null
  actualSpendMinor?: number | null
  currency: string
  sourceId?: string | null
  sourceName?: string | null
  externalAccountId?: string | null
  externalCampaignId?: string | null
  externalPlatform?: 'facebook' | 'google' | null
  landingUrl?: string | null
  targetAudience?: string | null
  ownerId?: string | null
  ownerName?: string | null
  description?: string | null
  utm: UtmParameters
  metrics: CampaignMetrics
  createdAt: string
  updatedAt: string
}

export interface CampaignInput {
  name: string
  code?: string
  type: CampaignType
  objective: CampaignObjective
  status: CampaignStatus
  startDate: string
  endDate?: string | null
  budgetMinor?: number | null
  actualSpendMinor?: number | null
  currency?: string
  sourceId?: string | null
  externalAccountId?: string | null
  externalCampaignId?: string | null
  externalPlatform?: 'facebook' | 'google' | null
  landingUrl?: string | null
  targetAudience?: string | null
  ownerId?: string | null
  description?: string | null
  utm?: UtmParameters
}

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  meta_ads: 'Meta (Facebook & IG) Ads',
  google_ads: 'Google Ads',
  email: 'Email Campaign',
  sms: 'SMS / WhatsApp Blast',
  website: 'Website & Landing Page',
  referral: 'Partner & Referral',
  offline: 'Offline / Event / Print',
  other: 'Custom Channel',
}

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  lead_generation: 'Lead Generation',
  conversion: 'Sales & Conversion',
  retargeting: 'Retargeting / Nurturing',
  brand_awareness: 'Brand Awareness',
  event: 'Event Registration',
  retention: 'Customer Retention',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}
