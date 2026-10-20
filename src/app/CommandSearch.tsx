import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Building2, Inbox, Search, SquareKanban, Users } from 'lucide-react'
import { Dialog } from '../components/app/Dialog'
import { ErrorState, ListSkeleton } from '../components/app/States'
import { useCan } from '../lib/useOrg'
import { useOrgId } from '../features/crm/hooks'
import { listLeads } from '../features/leads/api'
import { listContacts } from '../features/contacts/api'
import { listCompanies } from '../features/companies/api'
import { listDeals } from '../features/deals/api'

const links = [
  { label: 'Leads', to: '/app/leads', icon: Inbox },
  { label: 'Pipeline', to: '/app/deals', icon: SquareKanban },
  { label: 'Contacts', to: '/app/contacts', icon: Users },
  { label: 'Integrations', to: '/app/integrations', icon: Building2 },
]
export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const orgId = useOrgId()
  const navigate = useNavigate()
  const id = useId()
  const canLeads = useCan('leads.read'),
    canContacts = useCan('contacts.read'),
    canCompanies = useCan('companies.read'),
    canDeals = useCan('deals.read')
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(term.trim()), 250)
    return () => clearTimeout(timeout)
  }, [term])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
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
      const [leads, contacts, companies, deals] = await Promise.all([
        canLeads ? listLeads(params) : null,
        canContacts ? listContacts(params) : null,
        canCompanies ? listCompanies(params) : null,
        canDeals ? listDeals(params) : null,
      ])
      return [
        ...(leads?.items ?? []).map((r) => ({
          name: r.displayName,
          type: 'Lead',
          to: `/app/leads/${r.id}`,
          detail: r.companyName ?? r.primaryEmail,
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
  function go(to: string) {
    setOpen(false)
    setTerm('')
    setQuery('')
    navigate(to)
  }
  return (
    <>
      <button
        type="button"
        data-search-trigger
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+k Control+k"
        className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-zinc-200/70 bg-zinc-50 px-3 text-left text-sm text-zinc-500 sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search your workspace…</span>
        <kbd className="ml-auto hidden whitespace-nowrap rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] sm:block">
          ⌘ / Ctrl K
        </kbd>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Search your workspace"
        description="Find a lead, contact, company or deal."
        className="max-w-xl"
      >
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
          className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-900 focus:border-brand-500 focus:outline-none"
        />
        <div className="mt-3 max-h-[50vh] overflow-y-auto" aria-live="polite">
          {query.length < 2 ? (
            <div className="space-y-1 py-2">
              <p className="px-2 py-2 text-xs font-medium text-zinc-500">Jump to</p>
              {links.map((link) => (
                <button
                  key={link.to}
                  onClick={() => go(link.to)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  <link.icon className="size-4 text-zinc-400" />
                  {link.label}
                  <ArrowUpRight className="ml-auto size-3.5 text-zinc-400" />
                </button>
              ))}
            </div>
          ) : term.trim() !== query || results.isPending ? (
            <ListSkeleton rows={3} />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : !results.data.length ? (
            <p className="py-10 text-center text-sm text-zinc-500">No matches. Try a name, phone number or email.</p>
          ) : (
            results.data.map((r) => (
              <button
                key={r.to}
                onClick={() => go(r.to)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-zinc-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{r.name}</p>
                  <p className="truncate text-xs text-zinc-500">{r.detail}</p>
                </div>
                <span className="text-xs text-zinc-400">{r.type}</span>
                <ArrowUpRight className="size-3.5 text-zinc-400" />
              </button>
            ))
          )}
        </div>
      </Dialog>
    </>
  )
}
