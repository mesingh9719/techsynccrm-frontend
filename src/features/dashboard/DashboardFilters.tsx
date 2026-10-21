import { useState } from 'react'
import { CalendarDays, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { listLeadSources } from '../leads/api'
import { qk } from '../../lib/queryKeys'
import { memberOptions } from '../../services/team'
import { useOrgId } from '../crm/hooks'
import type { DatePreset } from './datePresets'

export interface DashboardFilterState {
  preset: DatePreset
  customFrom?: string
  customTo?: string
  sourceId?: string
  ownerId?: string
}
const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_year', label: 'This year' },
  { key: 'custom', label: 'Custom range' },
]
export function DashboardFilters({
  filters,
  onChange,
  onReset,
  today,
  enabled = true,
}: {
  filters: DashboardFilterState
  onChange: (next: DashboardFilterState) => void
  onReset: () => void
  today: string
  enabled?: boolean
}) {
  const orgId = useOrgId()
  const [expanded, setExpanded] = useState(false)
  const sources = useQuery({
    queryKey: qk.org(orgId).leadSources,
    queryFn: listLeadSources,
    staleTime: 60_000,
    enabled: enabled && (expanded || Boolean(filters.sourceId)),
  })
  const members = useQuery({
    queryKey: ['org', orgId, 'member-options'],
    queryFn: () => memberOptions(),
    staleTime: 60_000,
    enabled: expanded && enabled,
  })
  const count = Number(Boolean(filters.sourceId)) + Number(Boolean(filters.ownerId))
  const selectClass = 'h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-xs text-ink'
  function selectPreset(preset: DatePreset) {
    onChange({
      ...filters,
      preset,
      ...(preset === 'custom' ? { customFrom: filters.customFrom || today, customTo: filters.customTo || today } : {}),
    })
  }
  return (
    <section aria-label="Dashboard filters" className="surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="mr-1 size-4 text-muted" />
          <div className="hidden items-center gap-1 rounded-lg bg-surface-subtle p-1 sm:flex">
            {(['7d', '30d', 'this_month'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={filters.preset === preset}
                onClick={() => selectPreset(preset)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${filters.preset === preset ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}
              >
                {PRESETS.find((option) => option.key === preset)?.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="dashboard-period">
            Date range
          </label>
          <select
            id="dashboard-period"
            value={filters.preset}
            onChange={(event) => selectPreset(event.target.value as DatePreset)}
            className="h-10 max-w-40 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
          >
            {PRESETS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {filters.preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Start date"
                type="date"
                value={filters.customFrom || today}
                max={filters.customTo || today}
                onChange={(event) => onChange({ ...filters, customFrom: event.target.value || today })}
                className="h-10 max-w-40 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
              />
              <span className="text-xs text-muted">to</span>
              <input
                aria-label="End date"
                type="date"
                value={filters.customTo || today}
                min={filters.customFrom || today}
                onChange={(event) => onChange({ ...filters, customTo: event.target.value || today })}
                className="h-10 max-w-40 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted lg:block">Applies to lead metrics and funnel</span>
          {enabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls="dashboard-advanced-filters"
            >
              <SlidersHorizontal className="size-4" />
              Filters{count > 0 && <span className="rounded-full bg-brand-500/10 px-2 text-brand-700">{count}</span>}
            </Button>
          )}
          {(count > 0 || filters.preset !== '7d') && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset dashboard filters"
              className="rounded-lg p-2 text-muted hover:bg-surface-subtle"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      </div>
      {enabled && expanded && (
        <div id="dashboard-advanced-filters" className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <label className="space-y-2 text-xs font-medium text-muted">
            <span>Lead source</span>
            <select
              value={filters.sourceId || ''}
              onChange={(event) => onChange({ ...filters, sourceId: event.target.value || undefined })}
              className={selectClass}
            >
              <option value="">All sources</option>
              {(sources.data ?? [])
                .filter((source) => !source.archived)
                .map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-2 text-xs font-medium text-muted">
            <span>Lead owner</span>
            <select
              value={filters.ownerId || ''}
              onChange={(event) => onChange({ ...filters, ownerId: event.target.value || undefined })}
              className={selectClass}
            >
              <option value="">All team members</option>
              <option value="me">Assigned to me</option>
              {(members.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {count > 0 && (
        <p className="mt-2 text-xs text-brand-700">
          {filters.sourceId
            ? `Source: ${sources.data?.find((source) => source.id === filters.sourceId)?.name ?? 'Selected source'}`
            : ''}
          {filters.sourceId && filters.ownerId ? ' · ' : ''}
          {filters.ownerId
            ? `Owner: ${filters.ownerId === 'me' ? 'Me' : (members.data?.find((member) => member.userId === filters.ownerId)?.fullName ?? 'Selected owner')}`
            : ''}
        </p>
      )}
    </section>
  )
}
