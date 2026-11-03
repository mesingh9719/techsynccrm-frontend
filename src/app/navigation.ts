import type { ComponentType } from 'react'
import {
  ArrowDownUp,
  Bell,
  Building2,
  CalendarOff,
  CalendarDays,
  Table2,
  ChartColumn,
  CreditCard,
  FileInput,
  Gauge,
  House,
  Inbox,
  ListChecks,
  LayoutTemplate,
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
  { key: 'templates', label: 'Templates', to: '/app/templates', icon: LayoutTemplate, ready: true },
  { key: 'calendar', label: 'Calendar & Meet', to: '/app/calendar', icon: CalendarDays, ready: true, permission: 'google.connect.own' },
  { key: 'sheets', label: 'Google Sheets', to: '/app/sheets', icon: Table2, ready: true, permission: 'google.connect.own' },
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

export type SettingsGroup = 'Account' | 'Workspace & team' | 'Plan & billing' | 'Sales setup' | 'Lead capture' | 'Integrations' | 'Data'

export interface SettingsGroupMeta {
  key: SettingsGroup
  /** One line under the group heading on the Settings home grid. */
  description: string
  icon: ComponentType<{ className?: string }>
  /** Accent for the group's icon tiles (a CSS color; mixed with the surface for light and dark). */
  accent: string
}

export interface SettingsNavItem {
  key: string
  label: string
  to: string
  ready: boolean
  module?: string
  group: SettingsGroup
  icon: ComponentType<{ className?: string }>
  /** One line shown on the Settings home card, in search results and as the item tooltip. */
  description: string
  /** Hidden from members who can't use the page at all. */
  permission?: Permission
}

export const settingsGroupMeta: SettingsGroupMeta[] = [
  { key: 'Account', description: 'Your profile, sign-in and personal preferences', icon: UserRound, accent: '#7c3aed' },
  { key: 'Workspace & team', description: 'Company details, people and roles', icon: Building2, accent: '#4f46e5' },
  { key: 'Plan & billing', description: 'Your plan, usage limits and invoices', icon: CreditCard, accent: '#d97706' },
  { key: 'Sales setup', description: 'Pipelines, lead rules, fields and templates', icon: SquareKanban, accent: '#059669' },
  { key: 'Lead capture', description: 'Forms and routing for new enquiries', icon: FileInput, accent: '#0284c7' },
  { key: 'Integrations', description: 'Google, Gmail and Facebook connections', icon: PlugZap, accent: '#db2777' },
  { key: 'Data', description: 'Imports and exports', icon: ArrowDownUp, accent: '#475569' },
]

export const settingsGroups: SettingsGroup[] = settingsGroupMeta.map((g) => g.key)

export const settingsNav: SettingsNavItem[] = [
  { key: 'profile', label: 'Profile', to: '/app/settings/profile', ready: true, group: 'Account', icon: UserRound, description: 'Name, photo, email and phone' },
  { key: 'security', label: 'Security', to: '/app/settings/security', ready: true, group: 'Account', icon: ShieldCheck, description: 'Password, two-factor and sessions' },
  { key: 'notifications', label: 'Notifications', to: '/app/settings/notifications', ready: true, group: 'Account', icon: Bell, description: 'What you hear about, and where' },
  { key: 'availability', label: 'Availability', to: '/app/settings/availability', ready: true, group: 'Account', icon: CalendarOff, description: 'Out-of-office for new enquiries' },
  { key: 'workspace', label: 'General', to: '/app/settings/workspace', ready: true, group: 'Workspace & team', icon: Building2, description: 'Company identity, region and business details' },
  { key: 'team', label: 'Team & roles', to: '/app/settings/team', ready: true, group: 'Workspace & team', icon: UsersRound, description: 'Invite people, roles and sales teams' },
  { key: 'plan', label: 'Plan & usage', to: '/app/settings/plan', ready: true, group: 'Plan & billing', icon: Gauge, description: 'Your plan, limits and seats' },
  { key: 'billing', label: 'Billing', to: '/app/settings/billing', ready: false, module: 'M16', group: 'Plan & billing', icon: CreditCard, description: 'Invoices and payment method' },
  { key: 'pipelines', label: 'Pipelines', to: '/app/settings/pipelines', ready: true, group: 'Sales setup', icon: SquareKanban, description: 'Deal stages and probabilities' },
  { key: 'lead-settings', label: 'Lead settings', to: '/app/settings/leads', ready: true, group: 'Sales setup', icon: Inbox, description: 'Sources, scoring weights and lost reasons' },
  { key: 'custom-fields', label: 'Custom fields', to: '/app/settings/custom-fields', ready: true, group: 'Sales setup', icon: TextCursorInput, description: 'Extra fields on records' },
  { key: 'tags', label: 'Tags', to: '/app/settings/tags', ready: true, group: 'Sales setup', icon: Tag, description: 'Labels to organise records' },
  { key: 'templates', label: 'Templates', to: '/app/templates', ready: true, group: 'Sales setup', icon: LayoutTemplate, description: 'Personal and team email, WhatsApp and SMS templates' },
  { key: 'forms', label: 'Web forms', to: '/app/settings/forms', ready: true, group: 'Lead capture', icon: FileInput, description: 'Embeddable enquiry forms' },
  { key: 'assignment', label: 'Assignment rules', to: '/app/settings/assignment', ready: true, group: 'Lead capture', icon: Shuffle, description: 'Who gets each new lead' },
  { key: 'google', label: 'Google connections', to: '/app/settings/google', ready: true, group: 'Integrations', icon: PlugZap, description: 'Your Calendar, Drive and Sheets permission preferences' },
  { key: 'gmail', label: 'Email settings', to: '/app/settings/gmail', ready: true, group: 'Integrations', icon: Inbox, description: 'Connect and manage your work Gmail' },
  { key: 'google-team', label: 'Team & Google', to: '/app/settings/google-team', ready: true, group: 'Integrations', icon: PlugZap, permission: 'google.connections.manage', description: 'Team Google connections and service preferences' },
  { key: 'team-email', label: 'Team & Email', to: '/app/settings/team-email', ready: true, group: 'Integrations', icon: Inbox, permission: 'email.connections.manage', description: 'Team Gmail connections and email preferences' },
  { key: 'facebook', label: 'Facebook Lead Ads', to: '/app/settings/facebook', ready: true, group: 'Integrations', icon: Facebook, description: 'Bring in leads from Facebook forms' },
  { key: 'data', label: 'Import & export', to: '/app/settings/data', ready: true, group: 'Data', icon: ArrowDownUp, description: 'Import history and your exports' },
]
