import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Building2, CornerDownLeft, Inbox, Search, SquareKanban, Users } from 'lucide-react'
import { Dialog } from '../components/app/Dialog'
import { ErrorState, ListSkeleton } from '../components/app/States'
import { useCan } from '../lib/useOrg'
import { useOrgId } from '../features/crm/hooks'
import { listLeads } from '../features/leads/api'
import { listContacts } from '../features/contacts/api'
import { listCompanies } from '../features/companies/api'
import { listDeals } from '../features/deals/api'
import { listCampaigns } from '../features/campaigns/api'
import { cn } from '../lib/cn'

const links = [
  { label: 'Leads', to: '/app/leads', icon: Inbox, color: 'text-blue-500 bg-blue-50' },
  { label: 'Pipeline', to: '/app/deals', icon: SquareKanban, color: 'text-amber-500 bg-amber-50' },
  { label: 'Contacts', to: '/app/contacts', icon: Users, color: 'text-emerald-500 bg-emerald-50' },
  { label: 'Integrations', to: '/app/integrations', icon: Building2, color: 'text-purple-500 bg-purple-50' },
]

const typeBadgeStyles: Record<string, string> = {
  Lead: 'bg-blue-50 text-blue-700 border-blue-200/60',
  Contact: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  Company: 'bg-purple-50 text-purple-700 border-purple-200/60',
  Deal: 'bg-amber-50 text-amber-700 border-amber-200/60',
}

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const orgId = useOrgId()
  const navigate = useNavigate()
  const id = useId()

  const canLeads = useCan('leads.read')
  const canContacts = useCan('contacts.read')
  const canCompanies = useCan('companies.read')
  const canDeals = useCan('deals.read')

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(term.trim())
      setSelectedIndex(0)
    }, 200)
    return () => clearTimeout(timeout)
  }, [term])

  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const results = useQuery({
    queryKey: ['org', orgId, 'search', query],
    enabled: open && query.length >= 2,
    queryFn: async () => {
      const params = { q: query, limit: 5 }
      const [leads, contacts, companies, deals, campaigns] = await Promise.all([
        canLeads ? listLeads(params) : null,
        canContacts ? listContacts(params) : null,
        canCompanies ? listCompanies(params) : null,
        canDeals ? listDeals(params) : null,
        listCampaigns(orgId),
      ])
      const qLower = query.toLowerCase()
      const matchingCampaigns = (campaigns ?? []).filter(
        (c) => c.name.toLowerCase().includes(qLower) || c.code.toLowerCase().includes(qLower),
      ).slice(0, 4)

      return [
        ...(leads?.items ?? []).map((r) => ({
          name: r.displayName,
          type: 'Lead',
          to: `/app/leads/${r.id}`,
          detail: r.companyName ?? r.primaryEmail,
        })),
        ...matchingCampaigns.map((c) => ({
          name: c.name,
          type: 'Campaign',
          to: `/app/campaigns/${c.id}`,
          detail: `${c.code} · ${c.type}`,
        })),
        ...(contacts?.items ?? []).map((r) => ({
          name: r.displayName,
          type: 'Contact',
          to: `/app/contacts/${r.id}`,
          detail: r.primaryEmail,
        })),
        ...(companies?.items ?? []).map((r) => ({
          name: r.name,
          type: 'Company',
          to: `/app/companies/${r.id}`,
          detail: r.domain,
        })),
        ...(deals?.items ?? []).map((r) => ({
          name: r.title,
          type: 'Deal',
          to: `/app/deals/${r.id}`,
          detail: r.company?.name,
        })),
      ]
    },
  })

  const currentItems = useMemo(() => {
    if (query.length < 2) {
      return links.map((l) => ({ name: l.label, type: 'Page', to: l.to, detail: '' }))
    }
    return results.data ?? []
  }, [query, results.data])

  function go(to: string) {
    setOpen(false)
    setTerm('')
    setQuery('')
    setSelectedIndex(0)
    navigate(to)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!currentItems.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % currentItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (currentItems[selectedIndex]) {
        go(currentItems[selectedIndex].to)
      }
    }
  }

  function handleClose() {
    setOpen(false)
    setSelectedIndex(0)
  }

  return (
    <>
      <button
        type="button"
        data-search-trigger
        onClick={() => setOpen(true)}
        aria-label="Search workspace (Ctrl or Cmd K)"
        title="Search workspace (Ctrl or Cmd K)"
        aria-keyshortcuts="Meta+k Control+k"
        className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-surface-subtle px-3 text-left text-sm text-muted transition-colors hover:border-brand-300 hover:text-ink sm:max-w-md"
      >
        <Search className="size-4 shrink-0 text-muted" />
        <span className="hidden truncate sm:inline">Search your workspace…</span>
        <kbd className="ml-auto hidden whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-muted shadow-xs sm:block">
          ⌘ / Ctrl K
        </kbd>
      </button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Search your workspace"
        description="Jump to pages or search across leads, contacts, companies and deals."
        className="max-w-xl"
        footer={
          <div className="flex w-full items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line bg-surface-subtle px-2 py-1 text-xs font-medium">↑</kbd>
                <kbd className="rounded border border-line bg-surface-subtle px-2 py-1 text-xs font-medium">↓</kbd>
                Navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line bg-surface-subtle px-2 py-1 text-xs font-medium">↵</kbd>
                Select
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line bg-surface-subtle px-2 py-1 text-xs font-medium">ESC</kbd>
                Close
              </span>
            </div>
            {currentItems.length > 0 && (
              <span>{currentItems.length} {currentItems.length === 1 ? 'item' : 'items'}</span>
            )}
          </div>
        }
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted" />
          <label htmlFor={id} className="sr-only">
            Search records
          </label>
          <input
            id={id}
            autoFocus
            type="search"
            placeholder="Search by name, email, phone or company"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-12 w-full rounded-xl border border-line bg-surface-subtle pr-4 pl-11 text-base text-ink placeholder:text-muted transition-all focus:border-brand-500 focus:bg-surface focus:ring-4 focus:ring-brand-500/10 focus:outline-none"
          />
        </div>

        <div ref={listRef} className="mt-3 max-h-[50vh] overflow-y-auto" aria-live="polite">
          {query.length < 2 ? (
            <div className="space-y-1 py-1">
              <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Quick navigation</p>
              {links.map((link, index) => {
                const isActive = selectedIndex === index
                return (
                  <button
                    key={link.to}
                    type="button"
                    onClick={() => go(link.to)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-50/80 text-brand-900 ring-1 ring-brand-200' : 'text-ink hover:bg-surface-subtle',
                    )}
                  >
                    <span className={cn('flex size-7 items-center justify-center rounded-lg', link.color)}>
                      <link.icon className="size-4" />
                    </span>
                    <span>{link.label}</span>
                    <ArrowUpRight className={cn('ml-auto size-4', isActive ? 'text-brand-700' : 'text-muted')} />
                  </button>
                )
              })}
            </div>
          ) : term.trim() !== query || results.isPending ? (
            <ListSkeleton rows={3} />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : !results.data?.length ? (
            <div className="py-12 text-center">
              <Search className="mx-auto size-7 text-muted/60" />
              <p className="mt-3 text-sm font-medium text-ink">No matching records found</p>
              <p className="mt-1 text-xs text-muted">Try searching with a full name, email, phone number, or company.</p>
            </div>
          ) : (
            <div className="space-y-1 py-1">
              {results.data.map((r, index) => {
                const isActive = selectedIndex === index
                const badgeClass = typeBadgeStyles[r.type] ?? 'bg-surface-subtle text-muted border-line'
                return (
                  <button
                    key={r.to}
                    type="button"
                    onClick={() => go(r.to)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                      isActive ? 'bg-brand-50/80 ring-1 ring-brand-200' : 'hover:bg-surface-subtle',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn('truncate text-sm font-semibold', isActive ? 'text-brand-900' : 'text-ink')}>
                          {r.name}
                        </p>
                        <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium tracking-wide', badgeClass)}>
                          {r.type}
                        </span>
                      </div>
                      {r.detail && <p className="mt-1 truncate text-xs text-muted">{r.detail}</p>}
                    </div>
                    {isActive ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-brand-700">
                        Open <CornerDownLeft className="size-3" />
                      </span>
                    ) : (
                      <ArrowUpRight className="size-4 text-muted group-hover:text-ink" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Dialog>
    </>
  )
}
