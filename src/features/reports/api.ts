import { api } from '../../services/http'

/** Reports always describe the authenticated workspace. */
export const reportsLive = true
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
  winRate: number
  activities: number
  targetMinor: number | null
}
export interface ReportData {
  kpis: ReportKpi[]
  revenue: { period: string; valueMinor: number }[]
  sources: SourceReport[]
  funnel: { stage: string; count: number }[]
  team: TeamReport[]
}
export async function getReports(filters: ReportFilters, _today?: string, _currency?: string): Promise<ReportData> {
  const query = { ...filters }
  const [kpis, revenue, sources, funnel, team] = await Promise.all([
    api<ReportKpi[]>('/reports/kpis', { query }),
    api<ReportData['revenue']>('/reports/revenue-series', { query: { ...query, interval: 'month', months: 12 } }),
    api<SourceReport[]>('/reports/leads-by-source', { query }),
    api<ReportData['funnel']>('/reports/funnel', { query }),
    api<TeamReport[]>('/reports/leaderboard', { query }),
  ])
  return { kpis, revenue, sources, funnel, team }
}

export interface ReportExport { filename: string; headers: string[]; rows: unknown[][] }
export function exportReport(type: 'sources' | 'funnel' | 'team' | 'revenue' | 'kpis', filters: ReportFilters) {
  return api<ReportExport>(`/reports/${type}/export`, { query: { ...filters } })
}

/** Matches the lead cohort definition: exclude junk and preserve every selected filter. */
export function sourceLeadUrl(sourceId: string, filters: ReportFilters) {
  const params = new URLSearchParams({ sourceId, createdFrom: filters.from, createdTo: filters.to, status: 'new,contacted,qualified,converted,lost' })
  if (filters.ownerId) params.set('ownerId', filters.ownerId)
  return `/app/leads?${params}`
}
