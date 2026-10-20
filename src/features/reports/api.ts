import { api } from '../../services/http'
import { calendarDate } from '../dashboard/dates'
import { formatMinor } from '../crm/format'

export const reportsLive = import.meta.env.VITE_CRM_REPORTS_API === 'true'
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
export const sampleSources = [
  { id: 'website', name: 'Website' },
  { id: 'facebook', name: 'Facebook Lead Ads' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'google', name: 'Google Ads' },
  { id: 'referral', name: 'Referral' },
]
export const sampleOwners = [
  { id: 'asha', name: 'Asha Sharma' },
  { id: 'ravi', name: 'Ravi Kumar' },
  { id: 'priya', name: 'Priya Shah' },
]

/** Deterministic preview facts, separate from CRM records. Every filter is actually applied. */
export function sampleReport(filters: ReportFilters, today: string, currency = 'INR'): ReportData {
  const facts = Array.from({ length: 180 }, (_, i) => {
    const created = calendarDate(today, -((i * 7) % 180)),
      phase = (i + Math.floor(i / 5)) % 5
    return {
      source: sampleSources[i % sampleSources.length],
      owner: sampleOwners[(i * 7) % sampleOwners.length],
      created,
      contacted: phase >= 1,
      qualified: phase >= 2,
      converted: phase >= 3,
      junk: i % 19 === 0,
      won: phase === 4 && created < calendarDate(today, -7),
      closed: calendarDate(created, 7),
      valueMinor: ((i % 14) + 1) * 175000,
      activities: 1 + (i % 8),
      lost: phase === 3 && i % 3 === 0,
    }
  }).filter(
    (f) =>
      !f.junk &&
      (!filters.ownerId || f.owner.id === filters.ownerId) &&
      (!filters.sourceId || f.source.id === filters.sourceId),
  )
  const inRange = (date: string, from = filters.from, to = filters.to) => date >= from && date <= to
  const cohort = facts.filter((f) => inRange(f.created)),
    won = facts.filter((f) => f.won && inRange(f.closed)),
    lost = facts.filter((f) => f.lost && inRange(f.closed))
  const duration =
    Math.round((Date.parse(`${filters.to}T12:00:00Z`) - Date.parse(`${filters.from}T12:00:00Z`)) / 86400000) + 1
  const previousTo = calendarDate(filters.from, -1),
    previousFrom = calendarDate(previousTo, -(duration - 1))
  const prevCohort = facts.filter((f) => inRange(f.created, previousFrom, previousTo)),
    prevWon = facts.filter((f) => f.won && inRange(f.closed, previousFrom, previousTo))
  const revenue = won.reduce((n, f) => n + f.valueMinor, 0),
    prevRevenue = prevWon.reduce((n, f) => n + f.valueMinor, 0),
    conversion = cohort.length ? (cohort.filter((f) => f.converted).length / cohort.length) * 100 : 0,
    prevConversion = prevCohort.length ? (prevCohort.filter((f) => f.converted).length / prevCohort.length) * 100 : 0
  const delta = (value: number, previous: number) =>
    previous ? `${value >= previous ? '+' : '−'}${Math.abs(((value - previous) / previous) * 100).toFixed(1)}%` : '—'
  const kpis: ReportKpi[] = [
    {
      key: 'leads',
      label: 'New leads',
      value: String(cohort.length),
      delta: delta(cohort.length, prevCohort.length),
      positive: cohort.length >= prevCohort.length,
      context: 'vs previous period',
    },
    {
      key: 'revenue',
      label: 'Revenue won',
      value: formatMinor(revenue, currency),
      delta: delta(revenue, prevRevenue),
      positive: revenue >= prevRevenue,
      context: 'vs previous period',
    },
    {
      key: 'conversion',
      label: 'Lead conversion',
      value: cohort.length ? `${conversion.toFixed(1)}%` : '—',
      delta: `${conversion >= prevConversion ? '+' : '−'}${Math.abs(conversion - prevConversion).toFixed(1)} pp`,
      positive: conversion >= prevConversion,
      context: 'vs previous cohort',
    },
    {
      key: 'winRate',
      label: 'Deal win rate',
      value: won.length + lost.length ? `${Math.round((won.length / (won.length + lost.length)) * 100)}%` : '—',
      delta: '',
      positive: true,
      context: 'won / closed deals in period',
    },
  ]
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(`${filters.to.slice(0, 7)}-15T12:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() - (11 - i))
    return date.toISOString().slice(0, 7)
  })
  return {
    kpis,
    revenue: months.map((period) => ({
      period,
      valueMinor: facts
        .filter((f) => f.won && f.closed.startsWith(period) && inRange(f.closed))
        .reduce((n, f) => n + f.valueMinor, 0),
    })),
    sources: sampleSources
      .map((source) => ({
        sourceId: source.id,
        source: source.name,
        leads: cohort.filter((f) => f.source.id === source.id).length,
        converted: cohort.filter((f) => f.source.id === source.id && f.converted).length,
        revenueMinor: won.filter((f) => f.source.id === source.id).reduce((n, f) => n + f.valueMinor, 0),
      }))
      .filter((s) => !filters.sourceId || s.sourceId === filters.sourceId),
    funnel: [
      { stage: 'New enquiries', count: cohort.length },
      { stage: 'Contacted', count: cohort.filter((f) => f.contacted).length },
      { stage: 'Qualified', count: cohort.filter((f) => f.qualified).length },
      { stage: 'Converted', count: cohort.filter((f) => f.converted).length },
      { stage: 'Deal won', count: cohort.filter((f) => f.won).length },
    ],
    team: sampleOwners
      .filter((o) => !filters.ownerId || o.id === filters.ownerId)
      .map((owner) => {
        const mine = won.filter((f) => f.owner.id === owner.id),
          myLost = lost.filter((f) => f.owner.id === owner.id)
        return {
          ownerId: owner.id,
          name: owner.name,
          revenueMinor: mine.reduce((n, f) => n + f.valueMinor, 0),
          dealsWon: mine.length,
          winRate: mine.length + myLost.length ? Math.round((mine.length / (mine.length + myLost.length)) * 100) : 0,
          activities: cohort.filter((f) => f.owner.id === owner.id).reduce((n, f) => n + f.activities, 0),
          targetMinor: null,
        }
      }),
  }
}
export async function getReports(filters: ReportFilters, today: string, currency: string): Promise<ReportData> {
  if (!reportsLive) return sampleReport(filters, today, currency)
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
