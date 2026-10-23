import type { ComponentType } from 'react'
import {
  ArrowDownUp,
  Bell,
  Building2,
  CalendarOff,
  ChartColumn,
  CreditCard,
  FileInput,
  Gauge,
  House,
  Inbox,
  ListChecks,
  Megaphone,
  PlugZap,
  Settings,
  ShieldCheck,
  Shuffle,
  SquareKanban,
  Tag,
  TextCursorInput,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react'
import { Facebook } from '../features/leads/BrandIcons'
import { t } from '../lib/i18n'
import type { Permission } from '../lib/permissions'

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
  /** Hidden from members without this permission. */
  permission?: Permission
  /** Short label for the mobile tab bar. */
  shortLabel?: string
}

export const mainNav: NavItem[] = [
  { key: 'home', label: t('nav.home', 'Dashboard'), shortLabel: 'Home', to: '/app', icon: House, end: true, ready: true, shortcut: 'h' },
  { key: 'leads', label: t('nav.leads', 'Leads'), to: '/app/leads', icon: Inbox, ready: true, shortcut: 'l', permission: 'leads.read' },
  { key: 'campaigns', label: 'Campaigns', to: '/app/campaigns', icon: Megaphone, ready: true, shortcut: 'm', permission: 'campaigns.read' },
  { key: 'deals', label: t('nav.deals', 'Pipeline'), to: '/app/deals', icon: SquareKanban, ready: true, shortcut: 'd', permission: 'deals.read' },
  {
    key: 'tasks',
    label: t('nav.tasks', 'Tasks & follow-ups'),
    shortLabel: 'Tasks',
    to: '/app/tasks',
    icon: ListChecks,
    ready: true,
    shortcut: 't',
    permission: 'tasks.read',
  },
  {
    key: 'contacts',
    label: t('nav.contacts', 'Contacts & companies'),
    to: '/app/contacts',
    icon: Users,
    ready: true,
    shortcut: 'c',
    permission: 'contacts.read',
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

/** Bottom tab bar on phones (the rest live under “More”). */
export const mobileTabKeys = ['home', 'leads', 'deals', 'tasks']

export const settingsNavItem: NavItem = {
  key: 'settings',
  label: t('nav.settings', 'Settings'),
  to: '/app/settings',
  icon: Settings,
  ready: true,
  shortcut: 's',
}

export type SettingsGroup = 'Account' | 'Workspace' | 'Sales setup' | 'Lead capture' | 'Data'

export interface SettingsNavItem {
  key: string
  label: string
  to: string
  ready: boolean
  module?: string
  group: SettingsGroup
  icon: ComponentType<{ className?: string }>
  /** One line shown in settings search results and as the item tooltip. */
  description: string
  /** Hidden from members who can't use the page at all. */
  permission?: Permission
}

export const settingsGroups: SettingsGroup[] = ['Account', 'Workspace', 'Sales setup', 'Lead capture', 'Data']

export const settingsNav: SettingsNavItem[] = [
  { key: 'profile', label: 'Profile', to: '/app/settings/profile', ready: true, group: 'Account', icon: UserRound, description: 'Name, photo, email and phone' },
  { key: 'gmail', label: 'Gmail', to: '/app/settings/gmail', ready: true, group: 'Account', icon: Inbox, description: 'Work email, signatures and templates' },
  { key: 'security', label: 'Security', to: '/app/settings/security', ready: true, group: 'Account', icon: ShieldCheck, description: 'Password, two-factor and sessions' },
  { key: 'notifications', label: 'Notifications', to: '/app/settings/notifications', ready: true, group: 'Account', icon: Bell, description: 'What you hear about, and where' },
  { key: 'availability', label: 'Availability', to: '/app/settings/availability', ready: true, group: 'Account', icon: CalendarOff, description: 'Out-of-office for new enquiries' },
  { key: 'workspace', label: 'General', to: '/app/settings/workspace', ready: true, group: 'Workspace', icon: Building2, description: 'Company identity, region and business details' },
  { key: 'team', label: 'Team & roles', to: '/app/settings/team', ready: true, group: 'Workspace', icon: UsersRound, description: 'Invite people, roles and sales teams' },
  { key: 'plan', label: 'Plan & usage', to: '/app/settings/plan', ready: true, group: 'Workspace', icon: Gauge, description: 'Your plan, limits and seats' },
  { key: 'billing', label: 'Billing', to: '/app/settings/billing', ready: false, module: 'M16', group: 'Workspace', icon: CreditCard, description: 'Invoices and payment method' },
  { key: 'pipelines', label: 'Pipelines', to: '/app/settings/pipelines', ready: true, group: 'Sales setup', icon: SquareKanban, description: 'Deal stages and probabilities' },
  { key: 'lead-settings', label: 'Lead settings', to: '/app/settings/leads', ready: true, group: 'Sales setup', icon: Inbox, description: 'Sources, scoring weights and lost reasons' },
  { key: 'custom-fields', label: 'Custom fields', to: '/app/settings/custom-fields', ready: true, group: 'Sales setup', icon: TextCursorInput, description: 'Extra fields on records' },
  { key: 'tags', label: 'Tags', to: '/app/settings/tags', ready: true, group: 'Sales setup', icon: Tag, description: 'Labels to organise records' },
  { key: 'forms', label: 'Web forms', to: '/app/settings/forms', ready: true, group: 'Lead capture', icon: FileInput, description: 'Embeddable enquiry forms' },
  { key: 'assignment', label: 'Assignment rules', to: '/app/settings/assignment', ready: true, group: 'Lead capture', icon: Shuffle, description: 'Who gets each new lead' },
  { key: 'facebook', label: 'Facebook Lead Ads', to: '/app/settings/facebook', ready: true, group: 'Lead capture', icon: Facebook, description: 'Bring in leads from Facebook forms' },
  { key: 'data', label: 'Import & export', to: '/app/settings/data', ready: true, group: 'Data', icon: ArrowDownUp, description: 'Import history and your exports' },
]
