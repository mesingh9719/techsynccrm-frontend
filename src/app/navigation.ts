import type { ComponentType } from 'react'
import { ChartColumn, House, Inbox, ListChecks, Megaphone, Settings, SquareKanban, Users, PlugZap } from 'lucide-react'
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
  { key: 'home', label: t('nav.home', 'Dashboard'), to: '/app', icon: House, end: true, ready: true, shortcut: 'h' },
  { key: 'leads', label: t('nav.leads', 'Leads'), to: '/app/leads', icon: Inbox, ready: true, shortcut: 'l' },
  { key: 'campaigns', label: 'Campaigns', to: '/app/campaigns', icon: Megaphone, ready: true, shortcut: 'm' },
  { key: 'deals', label: t('nav.deals', 'Pipeline'), to: '/app/deals', icon: SquareKanban, ready: true, shortcut: 'd' },
  {
    key: 'tasks',
    label: t('nav.tasks', 'Tasks & follow-ups'),
    to: '/app/tasks',
    icon: ListChecks,
    ready: true,
    shortcut: 't',
  },
  {
    key: 'contacts',
    label: t('nav.contacts', 'Contacts & companies'),
    to: '/app/contacts',
    icon: Users,
    ready: true,
    shortcut: 'c',
  },
  { key: 'integrations', label: 'Integrations', to: '/app/integrations', icon: PlugZap, ready: true },
  {
    key: 'reports',
    label: t('nav.reports', 'Reports'),
    to: '/app/reports',
    icon: ChartColumn,
    ready: true,
    module: 'M15',
    shortcut: 'r',
  },
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
  { key: 'availability', label: 'Availability', to: '/app/settings/availability', ready: true, group: 'You' },
  { key: 'forms', label: 'Web forms', to: '/app/settings/forms', ready: true, group: 'Workspace' },
  { key: 'assignment', label: 'Assignment rules', to: '/app/settings/assignment', ready: true, group: 'Workspace' },
  { key: 'tags', label: 'Tags', to: '/app/settings/tags', ready: true, group: 'Workspace' },
  { key: 'facebook', label: 'Facebook Lead Ads', to: '/app/settings/facebook', ready: true, group: 'Workspace' },
  { key: 'data', label: 'Data transfers', to: '/app/settings/data', ready: true, group: 'Workspace' },
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
