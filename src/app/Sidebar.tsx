import { useState, type FocusEvent, type PointerEvent } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LifeBuoy, Lock, PanelLeftClose, PanelLeftOpen, Rocket, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { emitAppEvent } from '../lib/appEvents'
import { useEntitlement } from '../lib/useOrg'
import { LogoMark } from '../components/ui/Brand'
import { mainNav, settingsNavItem, type NavItem } from './navigation'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useNavItemVisible } from './useSidebarPreference'
import { useTaskSummary } from '../features/tasks/useTaskSummary'

/** Number of my overdue tasks next to “Tasks”; a dot on the icon when the rail is collapsed. */
export function OverdueBadge({ active, dot = false }: { active: boolean; dot?: boolean }) {
  const summary = useTaskSummary()
  const n = summary.data?.overdue ?? 0
  if (!n) return null
  if (dot) {
    return (
      <span
        className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-[var(--rail-dot-ring,var(--color-sidebar))]"
        aria-label={`${n} overdue`}
      />
    )
  }
  return (
    <span
      className={cn(
        'rounded-full px-2 text-xs font-semibold tabular-nums',
        active ? 'bg-black/25 text-white' : 'bg-red-500/15 text-red-300',
      )}
      aria-label={`${n} overdue`}
    >
      {n}
    </span>
  )
}

function SidebarLink({ item, onNavigate, collapsed = false }: { item: NavItem; onNavigate?: () => void; collapsed?: boolean }) {
  const location = useLocation()
  const visible = useNavItemVisible()
  const entitlement = useEntitlement(item.feature ?? '')
  const locked = Boolean(item.feature) && !entitlement.enabled

  if (!visible(item)) return null

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
        data-tip={`${item.label} · Upgrade`}
        aria-label={collapsed ? `${item.label} (upgrade required)` : undefined}
        className="sidebar-link w-full"
      >
        <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="sidebar-label flex-1 text-left">{item.label}</span>
        <Lock className="sidebar-label size-4 text-sidebar-muted" aria-label="Upgrade required" />
      </button>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-tip={item.label}
      aria-label={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn('sidebar-link', (isActive || (item.key === 'contacts' && location.pathname.startsWith('/app/companies'))) && 'is-active')
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative flex shrink-0">
            <item.icon className="size-[18px]" aria-hidden="true" />
            {collapsed && item.key === 'tasks' && <OverdueBadge active={isActive} dot />}
          </span>
          <span className="sidebar-label flex-1 truncate">{item.label}</span>
          {!collapsed && item.key === 'tasks' && <OverdueBadge active={isActive} />}
          {!collapsed && !item.ready && (
            <span className="rounded-control border border-sidebar-active bg-sidebar-hover px-1.5 py-0.5 text-xs font-medium text-sidebar-muted">
              Soon
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

/** Hover/focus label for icons in the collapsed rail; positioned fixed so the scrolling nav never clips it. */
function useRailTooltip(enabled: boolean) {
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null)
  const show = (e: PointerEvent | FocusEvent) => {
    if (!enabled) return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
    if (!el) return setTip(null)
    // Only keyboard focus shows a tooltip on focus (not the focus left behind by a click).
    if (e.type === 'focus' && !el.matches(':focus-visible')) return
    const rect = el.getBoundingClientRect()
    setTip({ label: el.dataset.tip ?? '', top: rect.top + rect.height / 2 })
  }
  const hide = () => setTip(null)
  const handlers = enabled ? { onPointerOver: show, onFocus: show, onPointerLeave: hide, onBlur: hide } : {}
  const node = enabled && tip && (
    <div aria-hidden="true" className="rail-tooltip" style={{ top: tip.top }}>
      {tip.label}
    </div>
  )
  return { handlers, node }
}

interface SidebarProps {
  onNavigate?: () => void
  /** Desktop rail only. */
  collapsed?: boolean
  onToggle?: () => void
  /** Mobile drawer only: shows a close button in the header. */
  onClose?: () => void
}

/** App navigation: workspace switcher, main sections, settings. Used in the desktop rail and the mobile drawer. */
export function Sidebar({ onNavigate, collapsed = false, onToggle, onClose }: SidebarProps) {
  const tooltip = useRailTooltip(collapsed)
  const pad = 'px-3'

  return (
    <div className="sidebar-rail flex h-full min-h-0 flex-col" data-collapsed={collapsed || undefined} {...tooltip.handlers}>
      <div className={cn('flex h-16 shrink-0 items-center gap-3 overflow-hidden border-b border-sidebar-hover', collapsed ? 'justify-center px-3' : 'px-5')}>
        <Link to="/app" onClick={onNavigate} className="flex min-w-0 items-center gap-3 rounded-control" aria-label="TechSync CRM home" data-tip="Dashboard">
          <LogoMark className="size-8 shrink-0" />
          <span className="sidebar-label truncate font-display text-base font-semibold whitespace-nowrap">
            TechSync <span className="font-normal text-sidebar-muted">CRM</span>
          </span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="sidebar-icon-button ml-auto" aria-label="Close navigation">
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={cn('py-3', pad)}>
        <WorkspaceSwitcher compact={collapsed} />
      </div>

      <nav aria-label="Main" className={cn('sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-4', pad)}>
        <p className="sidebar-label sidebar-section">Workspace</p>
        <ul className="space-y-1">
          {mainNav.map((item) => (
            <li key={item.key}>
              <SidebarLink item={item} onNavigate={onNavigate} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('shrink-0 space-y-1 overflow-hidden border-t border-sidebar-hover py-3', pad)}>
        <Link to="/app/setup" onClick={onNavigate} className="sidebar-link" data-tip="Getting started" aria-label={collapsed ? 'Getting started' : undefined}>
          <Rocket className="size-[18px] shrink-0" aria-hidden="true" />
          <span className="sidebar-label truncate">Getting started</span>
        </Link>
        <Link to="/contact?topic=support" onClick={onNavigate} className="sidebar-link" data-tip="Contact support" aria-label={collapsed ? 'Contact support' : undefined}>
          <LifeBuoy className="size-[18px] shrink-0" aria-hidden="true" />
          <span className="sidebar-label truncate">Contact support</span>
        </Link>
        <SidebarLink item={settingsNavItem} onNavigate={onNavigate} collapsed={collapsed} />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-keyshortcuts="["
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-tip="Expand sidebar  ["
            className="sidebar-link w-full"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-[18px] shrink-0" aria-hidden="true" />
            )}
            <span className="sidebar-label flex-1 text-left">Collapse sidebar</span>
            <kbd className="sidebar-label rounded-control border border-sidebar-active px-1.5 text-xs text-sidebar-muted">[</kbd>
          </button>
        )}
      </div>
      {tooltip.node}
    </div>
  )
}
