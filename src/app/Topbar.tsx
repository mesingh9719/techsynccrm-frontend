import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, CircleHelp, Inbox, ListChecks, LogOut, Menu as MenuIcon, MonitorSmartphone, Plus, Search, ShieldCheck, SquareKanban, UserRound, Users } from 'lucide-react'
import { NotificationBell } from '../features/notifications/NotificationInbox'
import { logout } from '../services/auth'
import { useAuth } from '../lib/useAuth'
import { useCan } from '../lib/useOrg'
import { roleLabels } from '../lib/permissions'
import { UserAvatar } from '../components/app/UserAvatar'
import { useToast } from '../components/ui/Toast'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../components/app/Menu'
import { Button } from '../components/ui/Button'

/** "Create" menu — items enable as their modules ship. Shortcut: c. */
function CreateMenu() {
  const navigate = useNavigate()
  const canCreate = useCan('leads.create')
  if (!canCreate) return null
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <Button size="sm" {...props} data-create-trigger aria-keyshortcuts="c">
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Create</span>
          <span className="sr-only sm:hidden">Create</span>
        </Button>
      )}
    >
      {() => (
        <>
          <MenuLabel>Create new</MenuLabel>
          <MenuItem icon={<Inbox className="size-4" />} onSelect={() => navigate('/app/leads?create=true')}>
            Lead
          </MenuItem>
          <MenuItem icon={<Users className="size-4" />} onSelect={() => navigate('/app/contacts?create=true')}>
            Contact
          </MenuItem>
          <MenuItem icon={<Building2 className="size-4" />} onSelect={() => navigate('/app/companies?create=true')}>
            Company
          </MenuItem>
          <MenuItem icon={<SquareKanban className="size-4" />} onSelect={() => navigate('/app/deals?create=true')}>
            Deal
          </MenuItem>
          <MenuItem icon={<ListChecks className="size-4" />} onSelect={() => navigate('/app/tasks?create=true')}>
            Task
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

function UserMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  if (!user) return null

  async function signOut(everywhere: boolean) {
    setBusy(true)
    await logout({ everywhere }).catch(() => {})
    if (everywhere) notify({ title: 'Signed out on all devices' })
    navigate('/login', { replace: true })
  }

  return (
    <Menu
      align="end"
      trigger={(props) => (
        <button type="button" {...props} disabled={busy} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-4 hover:ring-zinc-100 disabled:opacity-60">
          <UserAvatar name={user.fullName} url={user.avatarUrl} size="sm" />
          <span className="sr-only">Account menu for {user.fullName}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-zinc-900">{user.fullName}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
            {user.organization && (
              <p className="mt-1 text-xs text-zinc-500">
                {roleLabels[user.organization.role]} · {user.organization.name}
              </p>
            )}
          </div>
          <MenuSeparator />
          <MenuItem icon={<UserRound className="size-4" />} onSelect={() => (close(), navigate('/app/settings/profile'))}>
            Profile
          </MenuItem>
          <MenuItem icon={<ShieldCheck className="size-4" />} onSelect={() => (close(), navigate('/app/settings/security'))}>
            Security
          </MenuItem>
          <MenuItem icon={<CircleHelp className="size-4" />} onSelect={() => (close(), navigate('/help'))}>
            Help Center
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut className="size-4" />} onSelect={() => signOut(false)}>
            Log out
          </MenuItem>
          <MenuItem icon={<MonitorSmartphone className="size-4" />} onSelect={() => signOut(true)}>
            Log out of all devices
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

/** Top bar: record search, create, notifications and account controls. */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [resource, setResource] = useState('leads')
  return (
    <header data-topbar className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onOpenMenu} className="-ml-1.5 rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden" aria-label="Open navigation">
        <MenuIcon className="size-5" aria-hidden="true" />
      </button>

      <form className="flex min-w-0 max-w-lg flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (search.trim()) navigate(`/app/${resource}?${new URLSearchParams({ q: search.trim() })}`) }}>
        <select aria-label="Search record type" value={resource} onChange={(e) => setResource(e.target.value)} className="hidden max-w-28 rounded-lg bg-zinc-100 px-2 py-2 text-sm sm:block"><option value="leads">Leads</option><option value="contacts">Contacts</option><option value="companies">Companies</option><option value="deals">Deals</option></select>
        <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          data-global-search-target
          aria-label={`Search ${resource}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-keyshortcuts="/"
          placeholder={`Search ${resource}…`}
          className="h-9 w-full rounded-lg border border-transparent bg-zinc-100 pr-10 pl-9 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
          title="Enter a search and press Enter"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-zinc-300 bg-white px-1.5 font-mono text-[10px] text-zinc-500 sm:block">/</kbd>
        </div>
        <button type="submit" className="sr-only">Search records</button>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <CreateMenu />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
