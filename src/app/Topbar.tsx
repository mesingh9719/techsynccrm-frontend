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
  const canCreate = useCan('leads.create')
  if (!canCreate) return null
  const soon = <span className="ml-1 text-xs text-zinc-400">Soon</span>
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
          <MenuItem disabled icon={<Inbox className="size-4" />} onSelect={() => {}}>
            Lead {soon}
          </MenuItem>
          <MenuItem disabled icon={<Users className="size-4" />} onSelect={() => {}}>
            Contact {soon}
          </MenuItem>
          <MenuItem disabled icon={<Building2 className="size-4" />} onSelect={() => {}}>
            Company {soon}
          </MenuItem>
          <MenuItem disabled icon={<SquareKanban className="size-4" />} onSelect={() => {}}>
            Deal {soon}
          </MenuItem>
          <MenuItem disabled icon={<ListChecks className="size-4" />} onSelect={() => {}}>
            Task {soon}
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

/** Top bar: mobile menu button, global search (arrives with the CRM modules), create, notifications, account. */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header data-topbar className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onOpenMenu} className="-ml-1.5 rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden" aria-label="Open navigation">
        <MenuIcon className="size-5" aria-hidden="true" />
      </button>

      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          data-global-search-target
          aria-label="Search the workspace"
          aria-keyshortcuts="/"
          placeholder="Search leads, contacts, deals…"
          className="h-9 w-full rounded-lg border border-transparent bg-zinc-100 pr-10 pl-9 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
          title="Search is coming with the leads and contacts modules"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-zinc-300 bg-white px-1.5 font-mono text-[10px] text-zinc-500 sm:block">/</kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <CreateMenu />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
