import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '../crm/hooks'
import type { ReportFilters } from './api'

/** One report section's data, cached per workspace, report and filter set. */
export function useReportQuery<T>(name: string, filters: ReportFilters, load: () => Promise<T>, extra: unknown[] = []) {
  const orgId = useOrgId()
  return useQuery({ queryKey: ['org', orgId, 'reports', name, filters, ...extra], queryFn: load, staleTime: 30_000 })
}

export const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')
export const number = (value: number) => value.toLocaleString('en-IN')

/** Compact axis/tile money: ₹1.2L, ₹3.4Cr for INR; $1.2K elsewhere. */
export function compactMoney(major: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(major)
}

/** Round, readable y-axis ticks for a maximum value. */
export function niceTicks(max: number) {
  const safe = Math.max(1, max)
  const step = 10 ** Math.floor(Math.log10(safe))
  const upper = Math.ceil(safe / step) * step
  return [0, upper / 2, upper]
}
