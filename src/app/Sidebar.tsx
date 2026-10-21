import { Link, NavLink } from 'react-router-dom'
import { LifeBuoy, Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
        'rounded-full px-2 text-xs font-semibold tabular-nums',
        active ? 'bg-surface/20 text-white' : 'bg-red-100 text-red-700',
      )}
      aria-label={`${n} overdue`}
    >
      {n}
    </span>
  )
}

const itemClass = (active: boolean) => cn('sidebar-link', active && 'bg-sidebar-active text-sidebar-ink')

function SidebarLink({ item, onNavigate, collapsed = false }: { item: NavItem; onNavigate?: () => void; collapsed?: boolean }) {
  const { user } = useAuth()
  const location = useLocation()
  const resource = { leads: 'leads.read', deals: 'deals.read', contacts: 'contacts.read', tasks: 'tasks.read', campaigns: 'campaigns.read' }[
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
        title={item.label}
        aria-label={collapsed ? item.label : undefined}
        className={cn(itemClass(false), 'w-full')}
      >
        <item.icon className="size-4 shrink-0" aria-hidden="true" />
        <span className={collapsed ? 'sr-only' : 'flex-1 text-left'}>{item.label}</span>
        <Lock className={cn("size-4 text-sidebar-muted", collapsed && "hidden")} aria-label="Upgrade required" />
      </button>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      aria-label={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        itemClass(isActive || (item.key === 'contacts' && location.pathname.startsWith('/app/companies')))
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn('size-4 shrink-0', 'text-current')}
            aria-hidden="true"
          />
          <span className={collapsed ? 'sr-only' : 'flex-1'}>{item.label}</span>
          {!collapsed && item.key === 'tasks' && <OverdueBadge active={isActive} />}
          {!collapsed && !item.ready && (
            <span
              className={cn(
                'rounded px-2 py-1 text-xs font-medium',
                isActive ? 'bg-surface/15 text-white' : 'border border-line bg-surface-subtle text-muted',
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
export function Sidebar({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div className="sidebar-rail flex h-full min-h-0 flex-col">
      <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-hover', collapsed ? 'justify-center px-4' : 'px-5')}>
        <LogoMark className="size-8 shrink-0" />
        <span className={collapsed ? 'sr-only' : 'font-display text-base font-semibold'}>TechSync <span className="font-normal text-sidebar-muted">CRM</span></span>
      </div>
      <div className={cn('py-4', collapsed ? 'px-2' : 'px-3')}><WorkspaceSwitcher compact={collapsed} /></div>
      <nav aria-label="Main" className={cn('min-h-0 flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && <p className="px-3 pb-3 text-xs font-medium text-sidebar-muted">WORKSPACE</p>}
        <ul className="space-y-2">{mainNav.map((item) => <li key={item.key}><SidebarLink item={item} onNavigate={onNavigate} collapsed={collapsed} /></li>)}</ul>
      </nav>
      <div className={cn('shrink-0 space-y-2 border-t border-sidebar-hover py-4', collapsed ? 'px-2' : 'px-3')}>
        <Link to="/app/setup" onClick={onNavigate} className="sidebar-link" title="Getting started"><LifeBuoy className="size-4 shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : ''}>Getting started</span></Link>
        <Link to="/contact?topic=support" onClick={onNavigate} className="sidebar-link" title="Contact support"><LifeBuoy className="size-4 shrink-0" aria-hidden="true" /><span className={collapsed ? 'sr-only' : ''}>Contact support</span></Link>
        <SidebarLink item={settingsNavItem} onNavigate={onNavigate} collapsed={collapsed} />
        {onToggle && <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="sidebar-link w-full">{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}<span className={collapsed ? 'sr-only' : ''}>Collapse sidebar</span></button>}
      </div>
    </div>
  )
}
