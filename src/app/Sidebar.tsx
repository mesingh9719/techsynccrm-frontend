import { Link, NavLink } from 'react-router-dom'
import { LifeBuoy, Lock } from 'lucide-react'
import { cn } from '../lib/cn'
import { emitAppEvent } from '../lib/appEvents'
import { useAuth } from '../lib/useAuth'
import { hasPermission, type Permission } from '../lib/permissions'
import { useLocation } from 'react-router-dom'
import { useEntitlement } from '../lib/useOrg'
import { LogoMark } from '../components/ui/Brand'
import { mainNav, settingsNavItem, type NavItem } from './navigation'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useTaskSummary } from '../features/tasks/useTaskSummary'

/** Number of my overdue tasks next to “Tasks”. */
function OverdueBadge({ active }: { active: boolean }) {
  const summary = useTaskSummary()
  const n = summary.data?.overdue ?? 0
  if (!n) return null
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
        active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700',
      )}
      aria-label={`${n} overdue`}
    >
      {n}
    </span>
  )
}

const itemClass = (active: boolean) =>
  cn(
    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
    active ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
  )

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const resource = { leads: 'leads.read', deals: 'deals.read', contacts: 'contacts.read', tasks: 'tasks.read' }[
    item.key
  ] as Permission | undefined
  const entitlement = useEntitlement(item.feature ?? '')
  const locked = Boolean(item.feature) && !entitlement.enabled

  if (resource && !hasPermission(user?.organization?.permissions, resource)) return null

  // Not in the plan: still listed (so people know it exists), opens the upgrade prompt.
  if (locked) {
    return (
      <button
        type="button"
        onClick={() =>
          emitAppEvent({
            type: 'upgrade',
            reason: 'feature',
            feature: item.feature,
            requiredPlan: entitlement.requiredPlan ?? undefined,
          })
        }
        className={cn(itemClass(false), 'w-full')}
      >
        <item.icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{item.label}</span>
        <Lock className="size-3.5 text-zinc-400" aria-label="Upgrade required" />
      </button>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        itemClass(isActive || (item.key === 'contacts' && location.pathname.startsWith('/app/companies')))
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn('size-4 shrink-0', isActive ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600')}
            aria-hidden="true"
          />
          <span className="flex-1">{item.label}</span>
          {item.key === 'tasks' && <OverdueBadge active={isActive} />}
          {!item.ready && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                isActive ? 'bg-white/15 text-white' : 'bg-zinc-100 text-zinc-500',
              )}
            >
              Soon
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

/** App navigation: workspace switcher, main sections, settings. Used in the desktop rail and the mobile menu. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200/80 px-4">
        <LogoMark className="size-6" />
        <span className="text-[15px] font-semibold text-zinc-950">
          TechSync <span className="font-normal text-zinc-500">CRM</span>
        </span>
      </div>
      <div className="px-3 pt-3">
        <WorkspaceSwitcher />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
        <p className="eyebrow px-2.5 pb-3 pt-3">Workspace</p>
        <ul className="space-y-1">
          {mainNav.map((item) => (
            <li key={item.key}>
              <SidebarLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-zinc-200/80 px-3 py-3">
        <Link to="/app/setup" onClick={onNavigate} className={itemClass(false)}>
          <LifeBuoy className="size-4 text-brand-600" />
          <span>Getting started</span>
        </Link>
        <Link to="/contact?topic=support" onClick={onNavigate} className={itemClass(false)}>
          <LifeBuoy className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <span>Contact support</span>
        </Link>
        <SidebarLink item={settingsNavItem} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
