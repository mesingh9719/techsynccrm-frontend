import type { ComponentType } from 'react'
import {
  Bell,
  Building2,
  ChartColumn,
  House,
  Inbox,
  ListChecks,
  MessageCircle,
  Receipt,
  Settings,
  SquareKanban,
  Users,
  Workflow,
} from 'lucide-react'
import { t } from '../lib/i18n'

export interface NavItem {
  key: string
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  /** Exact match for active state (Home). */
  end?: boolean
  /** Plan feature that gates it (lib/useOrg useEntitlement); locked items open the upgrade dialog. */
  feature?: string
  /** False until its module is built; shows a "Soon" badge and the Coming soon page. */
  ready: boolean
  /** Roadmap module that builds it (docs/modules). */
  module?: string
  /** Keyboard shortcut after "g" (g l → Leads). */
  shortcut?: string
}

export const mainNav: NavItem[] = [
  { key: 'home', label: t('nav.home', 'Home'), to: '/app', icon: House, end: true, ready: true, shortcut: 'h' },
  { key: 'leads', label: t('nav.leads', 'Leads'), to: '/app/leads', icon: Inbox, ready: true, shortcut: 'l' },
  { key: 'contacts', label: t('nav.contacts', 'Contacts'), to: '/app/contacts', icon: Users, ready: true, shortcut: 'c' },
  { key: 'companies', label: t('nav.companies', 'Companies'), to: '/app/companies', icon: Building2, ready: true },
  { key: 'deals', label: t('nav.deals', 'Deals'), to: '/app/deals', icon: SquareKanban, ready: true, shortcut: 'd' },
  { key: 'notifications', label: 'Notifications', to: '/app/notifications', icon: Bell, ready: true },
  { key: 'tasks', label: t('nav.tasks', 'Tasks'), to: '/app/tasks', icon: ListChecks, ready: true, shortcut: 't' },
  { key: 'inbox', label: t('nav.inbox', 'Inbox'), to: '/app/inbox', icon: MessageCircle, feature: 'whatsapp', ready: false, module: 'M19' },
  { key: 'quotes', label: t('nav.quotes', 'Quotes'), to: '/app/quotes', icon: Receipt, feature: 'quotes', ready: false, module: 'M17' },
  { key: 'reports', label: t('nav.reports', 'Reports'), to: '/app/reports', icon: ChartColumn, ready: false, module: 'M15', shortcut: 'r' },
  { key: 'automation', label: t('nav.automation', 'Automation'), to: '/app/automation', icon: Workflow, feature: 'automation', ready: false, module: 'M18' },
]

export const settingsNavItem: NavItem = {
  key: 'settings',
  label: t('nav.settings', 'Settings'),
  to: '/app/settings',
  icon: Settings,
  ready: true,
  shortcut: 's',
}

export interface SettingsNavItem {
  key: string
  label: string
  to: string
  ready: boolean
  module?: string
  group: 'You' | 'Workspace'
}

export const settingsNav: SettingsNavItem[] = [
  { key: 'profile', label: 'Profile', to: '/app/settings/profile', ready: true, group: 'You' },
  { key: 'security', label: 'Security', to: '/app/settings/security', ready: true, group: 'You' },
  { key: 'notifications', label: 'Notifications', to: '/app/settings/notifications', ready: true, group: 'You' },
  { key: 'workspace', label: 'Workspace', to: '/app/settings/workspace', ready: true, group: 'Workspace' },
  { key: 'team', label: 'Team', to: '/app/settings/team', ready: true, group: 'Workspace' },
  { key: 'pipelines', label: 'Pipelines', to: '/app/settings/pipelines', ready: true, group: 'Workspace' },
  { key: 'custom-fields', label: 'Custom fields', to: '/app/settings/custom-fields', ready: true, group: 'Workspace' },
  { key: 'lead-settings', label: 'Lead sources', to: '/app/settings/leads', ready: true, group: 'Workspace' },
  { key: 'plan', label: 'Plan & usage', to: '/app/settings/plan', ready: true, group: 'Workspace' },
  { key: 'billing', label: 'Billing', to: '/app/settings/billing', ready: false, module: 'M16', group: 'Workspace' },
]
