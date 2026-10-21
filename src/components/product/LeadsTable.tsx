import { useMemo, useState } from 'react'
import { Search, SearchX } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Avatar, Badge } from '../ui/Badge'
import type { LeadRow } from './types'

const statuses = ['All', 'New', 'Contacted', 'Qualified', 'Lost'] as const
type Status = (typeof statuses)[number]

const statusTone = {
  New: 'brand',
  Contacted: 'neutral',
  Qualified: 'success',
  Lost: 'danger',
} as const

/** Filterable lead list: search by name/company/source and filter by status. Data comes in via `leads`. */
export function LeadsTable({ leads, className }: { leads: LeadRow[]; className?: string }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('All')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter(
      (l) =>
        (status === 'All' || l.status === status) &&
        (!q || [l.name, l.company, l.source, l.owner].some((v) => v.toLowerCase().includes(q))),
    )
  }, [leads, query, status])

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: leads.length }
    for (const l of leads) map[l.status] = (map[l.status] ?? 0) + 1
    return map
  }, [leads])

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filter leads by status">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
                status === s ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              {s}
              <span className={cn('tabular-nums', status === s ? 'text-zinc-400' : 'text-zinc-400')}>{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads…"
            aria-label="Search leads"
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pr-2 pl-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-zinc-200">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">Lead</th>
              <th scope="col" className="px-3 py-3 font-medium">Source</th>
              <th scope="col" className="px-3 py-3 font-medium">Score</th>
              <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Owner</th>
              <th scope="col" className="px-3 py-3 font-medium">Status</th>
              <th scope="col" className="hidden px-3 py-3 text-right font-medium xl:table-cell">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {rows.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-zinc-50/80">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={lead.name} size="sm" className="size-7" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900">{lead.name}</p>
                      <p className="truncate text-zinc-500">{lead.company}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-zinc-600">{lead.source}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-12 rounded-full bg-zinc-100" aria-hidden="true">
                      <div
                        className={cn('h-full rounded-full', lead.score >= 80 ? 'bg-emerald-500' : lead.score >= 60 ? 'bg-amber-400' : 'bg-zinc-400')}
                        style={{ width: `${lead.score}%` }}
                      />
                    </div>
                    <span className="font-medium text-zinc-800 tabular-nums">{lead.score}</span>
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-zinc-600 md:table-cell">{lead.owner}</td>
                <td className="px-3 py-3">
                  <Badge tone={statusTone[lead.status as keyof typeof statusTone]}>{lead.status}</Badge>
                </td>
                <td className="hidden px-3 py-3 text-right text-zinc-500 xl:table-cell">{lead.lastActivity}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center">
                  <SearchX className="mx-auto size-5 text-zinc-400" aria-hidden="true" />
                  <p className="mt-2 text-zinc-600">No leads match your filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setStatus('All')
                    }}
                    className="mt-1 font-medium text-brand-700 hover:underline"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
