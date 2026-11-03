import { api, ApiError } from '../../services/http'

/** Reports always describe the authenticated workspace. */
export const reportsLive = import.meta.env.VITE_CRM_REPORTS_API !== 'false'
export interface ReportFilters {
  from: string
  to: string
  ownerId?: string
  sourceId?: string
  compare?: string
}
export interface ReportKpi {
  key: string
  label: string
  value: string
  delta: string
  positive: boolean
  context: string
}
export interface SourceReport {
  sourceId: string
  source: string
  leads: number
  converted: number
  revenueMinor: number
}
export interface TeamReport {
  ownerId: string
  name: string
  revenueMinor: number
  dealsWon: number
  dealsLost: number
  /** null when the member closed no deals in the period */
  winRate: number | null
  /** null on the "Former members & unassigned" row */
  activities: number | null
  targetMinor: number | null
  targetDeals: number | null
  attainment: number | null
}
export type TrendInterval = 'day' | 'week' | 'month'
export interface TrendPoint {
  period: string
  leads: number
  converted: number
  dealsWon: number
  revenueMinor: number
}
export interface TrendReport {
  interval: TrendInterval
  points: TrendPoint[]
}
export interface PipelineStageReport {
  stageId: string
  stage: string
  probability: number
  count: number
  valueMinor: number
  weightedMinor: number
  avgDaysInStage: number | null
  stuck: number
  rottingDays: number | null
}
export interface PipelineReport {
  pipelines: { id: string; name: string; isDefault: boolean }[]
  pipelineId: string | null
  stages: PipelineStageReport[]
}
export interface ForecastCell {
  count: number
  valueMinor: number
  weightedMinor: number
}
export interface ForecastReport {
  months: (ForecastCell & { month: string; wonMinor: number })[]
  overdue: ForecastCell
  later: ForecastCell
  noDate: ForecastCell
}
export interface LostReasonRow {
  reasonId: string
  reason: string
  count: number
  valueMinor?: number
}
export interface LostReasonsReport {
  deals: LostReasonRow[]
  leads: LostReasonRow[]
}
export interface CampaignReport {
  campaignId: string
  name: string
  status: string
  leads: number
  converted: number
  dealsWon: number
  revenueMinor: number
  spendMinor: number | null
  budgetMinor: number | null
  spendCurrency: string
  leadsToDate: number
  revenueToDateMinor: number
  costPerLeadMinor: number | null
  costPerWonMinor: number | null
  returnOnSpend: number | null
}
export const ACTIVITY_TYPES = ['call', 'meeting', 'site_visit', 'whatsapp', 'email', 'sms'] as const
export type ActivityKind = (typeof ACTIVITY_TYPES)[number]
export type ActivityRow = { ownerId: string; name: string; total: number } & Record<ActivityKind, number>
export interface ActivityReport {
  types: ActivityKind[]
  rows: ActivityRow[]
}
export interface ResponseSummary {
  total: number
  responded: number
  unresponded: number
  medianMinutes: number | null
  buckets: { label: string; count: number }[]
}
export interface FollowUpSummary {
  due: number
  completed: number
  onTime: number
  overdueNow: number
  compliancePercent: number | null
}

const live = async <T>(path: string, query: Record<string, string | number | undefined>) => {
  if (!reportsLive) throw new ApiError('Workspace reports are temporarily unavailable. Please try again later.', 503, 'FEATURE_DISABLED')
  return api<T>(path, { query })
}

export const getKpis = (f: ReportFilters) => live<ReportKpi[]>('/reports/kpis', { ...f, compare: 'previous' })
export const getTrend = (f: ReportFilters, interval: TrendInterval | 'auto' = 'auto') => live<TrendReport>('/reports/trend', { ...f, interval })
export const getSources = (f: ReportFilters) => live<SourceReport[]>('/reports/leads-by-source', { ...f })
export const getFunnel = (f: ReportFilters) => live<{ stage: string; count: number }[]>('/reports/funnel', { ...f })
export const getTeam = (f: ReportFilters) => live<TeamReport[]>('/reports/leaderboard', { ...f })
export const getPipeline = (f: ReportFilters, pipelineId?: string) => live<PipelineReport>('/reports/pipeline', { ...f, pipelineId })
export const getForecast = (f: ReportFilters) => live<ForecastReport>('/reports/forecast', { ...f })
export const getLostReasons = (f: ReportFilters) => live<LostReasonsReport>('/reports/lost-reasons', { ...f })
export const getCampaigns = (f: ReportFilters) => live<CampaignReport[]>('/reports/campaigns', { ...f })
export const getActivity = (f: ReportFilters) => live<ActivityReport>('/reports/activity', { ...f })
export const getFollowUps = async (f: ReportFilters) => {
  const [response, tasks] = await Promise.all([live<ResponseSummary>('/reports/first-response', { ...f }), live<FollowUpSummary>('/reports/follow-ups', { ...f })])
  return { response, tasks }
}

/** Dashboard widget data: the 12-month revenue series and source table. */
export interface ReportData {
  revenue: { period: string; valueMinor: number }[]
  sources: SourceReport[]
}

export type ExportType = 'kpis' | 'trend' | 'revenue' | 'sources' | 'funnel' | 'team' | 'pipeline' | 'forecast' | 'lost' | 'campaigns' | 'activity' | 'follow-ups'
export interface ReportExport { filename: string; headers: string[]; rows: unknown[][] }
export function exportReport(type: ExportType, filters: ReportFilters & { pipelineId?: string }) {
  return api<ReportExport>(`/reports/${type}/export`, { query: { ...filters } })
}

/** Matches the lead cohort definition: exclude junk and preserve every selected filter. */
export function sourceLeadUrl(sourceId: string, filters: ReportFilters) {
  const params = new URLSearchParams({ sourceId, createdFrom: filters.from, createdTo: filters.to, status: 'new,contacted,qualified,converted,lost' })
  if (filters.ownerId) params.set('ownerId', filters.ownerId)
  return `/app/leads?${params}`
}

/** Open deals in one stage of the deals list, keeping the owner and source filters. */
export function stageDealsUrl(pipelineId: string, stageId: string, filters: ReportFilters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ view: 'list', pipelineId, stageId, status: 'open', ...extra })
  if (filters.ownerId) params.set('ownerId', filters.ownerId)
  if (filters.sourceId) params.set('sourceId', filters.sourceId)
  return `/app/deals?${params}`
}

// ---------- Targets ----------

export interface TargetMember {
  userId: string
  name: string
  role: string
  canEdit: boolean
  revenueTargetMinor: number | null
  dealsTarget: number | null
  revenueMinor: number
  dealsWon: number
}
export interface TargetsMonth {
  month: string
  currency: string
  members: TargetMember[]
}
export const getTargets = (month: string) => api<TargetsMonth>('/reports/targets', { query: { month } })
export const saveTargets = (month: string, targets: { userId: string; revenueMinor?: number | null; dealsWon?: number | null }[]) =>
  api<TargetsMonth>('/reports/targets', { method: 'PUT', body: { month, targets } })

// ---------- Emailed summaries ----------

export type ScheduleFrequency = 'weekly' | 'monthly'
export interface ReportSchedule {
  frequency: ScheduleFrequency
  enabled: boolean
  filters: { ownerId?: string; sourceId?: string }
  lastSentAt: string | null
}
export interface ReportSchedules {
  available: boolean
  schedules: ReportSchedule[]
}
export const getSchedules = () => api<ReportSchedules>('/reports/schedules')
export const saveSchedule = (frequency: ScheduleFrequency, body: { enabled: boolean; filters?: { ownerId?: string; sourceId?: string } }) =>
  api<ReportSchedules>(`/reports/schedules/${frequency}`, { method: 'PUT', body })
