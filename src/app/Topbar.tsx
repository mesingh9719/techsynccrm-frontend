import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CircleHelp,
  Ellipsis,
  Inbox,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  SquareKanban,
  UserRound,
  Users,
} from 'lucide-react'
import { NotificationBell } from '../features/notifications/NotificationInbox'
import { logout } from '../services/auth'
import { useAuth } from '../lib/useAuth'
import { useCan } from '../lib/useOrg'
import { roleLabels } from '../lib/permissions'
import { UserAvatar } from '../components/app/UserAvatar'
import { useToast } from '../components/ui/Toast'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../components/app/Menu'
import { CommandSearch } from './CommandSearch'
import { ThemeControl } from './ThemeControl'
import { Button } from '../components/ui/Button'

/** "Create" menu — items enable as their modules ship. Shortcut: c. */
function CreateMenu() {
  const navigate = useNavigate()
  const canCreate = useCan('leads.create')
  const canCreateContact = useCan('contacts.create')
  const canCreateCompany = useCan('companies.create')
  const canCreateDeal = useCan('deals.create')
  const canCreateTask = useCan('tasks.create')
  if (![canCreate, canCreateContact, canCreateCompany, canCreateDeal, canCreateTask].some(Boolean)) return null
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <Button
          size="sm"
          {...props}
          data-create-trigger
          aria-keyshortcuts="c"
          variant="secondary"
          aria-label="More quick actions"
        >
          <Ellipsis className="size-4" aria-hidden="true" />
          <span className="hidden xl:inline">More</span>
          <span className="sr-only xl:hidden">More quick actions</span>
        </Button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Create new</MenuLabel>
          {canCreate && (
            <MenuItem
              icon={<Inbox className="size-4" />}
              onSelect={() => {
                close()
                navigate('/app/leads?create=true')
              }}
            >
              Lead
            </MenuItem>
          )}
          {canCreateContact && (
            <MenuItem
              icon={<Users className="size-4" />}
              onSelect={() => {
                close()
                navigate('/app/contacts?create=true')
              }}
            >
              Contact
            </MenuItem>
          )}
          {canCreateCompany && (
            <MenuItem
              icon={<Building2 className="size-4" />}
              onSelect={() => {
                close()
                navigate('/app/companies?create=true')
              }}
            >
              Company
            </MenuItem>
          )}
          {canCreateDeal && (
            <MenuItem
              icon={<SquareKanban className="size-4" />}
              onSelect={() => {
                close()
                navigate('/app/deals?create=true')
              }}
            >
              Deal
            </MenuItem>
          )}
          {canCreateTask && (
            <MenuItem
              icon={<ListChecks className="size-4" />}
              onSelect={() => {
                close()
                navigate('/app/tasks?create=true')
              }}
            >
              Task
            </MenuItem>
          )}
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
        <button
          type="button"
          {...props}
          disabled={busy}
          className="flex items-center gap-2 rounded-full p-0.5 hover:ring-4 hover:ring-zinc-100 disabled:opacity-60"
        >
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
          <MenuItem
            icon={<UserRound className="size-4" />}
            onSelect={() => (close(), navigate('/app/settings/profile'))}
          >
            Profile
          </MenuItem>
          <MenuItem
            icon={<ShieldCheck className="size-4" />}
            onSelect={() => (close(), navigate('/app/settings/security'))}
          >
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

function QuickAddLead() {
  const allowed = useCan('leads.create')
  const navigate = useNavigate()
  if (!allowed) return null
  return (
    <Button size="sm" className="h-9" onClick={() => navigate('/app/leads?create=true')}>
      <Plus className="size-4" />
      <span className="hidden sm:inline">New lead</span>
      <span className="sr-only sm:hidden">New lead</span>
    </Button>
  )
}

/** Top bar: record search, create, notifications and account controls. */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header
      data-topbar
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur sm:px-6"
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="-ml-1.5 rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon className="size-5" aria-hidden="true" />
      </button>

      <CommandSearch />

      <div className="ml-auto flex items-center gap-2">
        <QuickAddLead />
        <ThemeControl />
        <CreateMenu />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
