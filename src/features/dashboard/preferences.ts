import { isLeadChartType, type LeadChartType } from './funnel'

export const KPI_OPTIONS = [
  { id: 'total', label: 'Total leads', description: 'Leads received, excluding junk', access: 'leads' },
  { id: 'new', label: 'New enquiries', description: 'Leads awaiting a first response', access: 'leads' },
  { id: 'qualified', label: 'Qualified leads', description: 'Prospects ready for the next step', access: 'leads' },
  { id: 'contacted', label: 'Contacted leads', description: 'Conversations in progress', access: 'leads' },
  { id: 'converted', label: 'Converted leads', description: 'Leads converted into contacts', access: 'leads' },
  { id: 'conversion', label: 'Conversion rate', description: 'Converted leads as a share of total', access: 'leads' },
  { id: 'lost', label: 'Lost leads', description: 'Enquiries marked as lost', access: 'leads' },
  { id: 'pipeline', label: 'Open pipeline', description: 'Current value of open deals', access: 'deals' },
  { id: 'revenue', label: 'Revenue won', description: 'All-time value of won deals', access: 'deals' },
  { id: 'campaignLeads', label: 'Campaign leads', description: 'All-time attributed leads', access: 'campaigns' },
  { id: 'cpl', label: 'Cost per lead', description: 'Recorded campaign spend per lead', access: 'campaigns' },
  { id: 'overdue', label: 'Overdue follow-ups', description: 'Your tasks that need attention', access: 'tasks' },
] as const

export const WIDGET_OPTIONS = [
  { id: 'trend', label: 'Revenue trend', description: 'Won revenue by month from live reporting', access: 'reports' },
  { id: 'sources', label: 'Lead sources', description: 'New leads by source from live reporting', access: 'reports' },
  { id: 'funnel', label: 'Lead funnel', description: 'A flowing view of your lead statuses', access: 'leads' },
  { id: 'attention', label: 'Needs attention', description: 'New enquiries waiting for outreach', access: 'leads' },
  { id: 'tasks', label: 'My day', description: 'Today’s tasks and overdue follow-ups', access: 'tasks' },
  { id: 'pipeline', label: 'Sales pipeline', description: 'Deal value and volume by stage', access: 'deals' },
  {
    id: 'breakdown',
    label: 'Lead breakdown',
    description: 'Status distribution for the selected period',
    access: 'leads',
  },
  {
    id: 'campaigns',
    label: 'Campaign performance',
    description: 'Spend, leads and conversion by campaign',
    access: 'campaigns',
  },
  { id: 'team', label: 'Team directory', description: 'Your workspace members and roles', access: 'team' },
  { id: 'updates', label: 'Recent updates', description: 'Assignments, reminders and notifications', access: 'all' },
  { id: 'setup', label: 'Workspace setup', description: 'Your remaining onboarding steps', access: 'all' },
] as const

export type KpiId = (typeof KPI_OPTIONS)[number]['id']
export type WidgetId = (typeof WIDGET_OPTIONS)[number]['id']
export type DashboardAccess = (typeof WIDGET_OPTIONS)[number]['access']
export interface DashboardPreferences {
  version: 1
  kpis: KpiId[]
  widgets: WidgetId[]
  leadChartType: LeadChartType
}

export function defaultPreferences(): DashboardPreferences {
  return {
    version: 1,
    kpis: ['total', 'qualified', 'conversion', 'pipeline'],
    widgets: ['funnel', 'trend', 'sources', 'attention', 'tasks', 'pipeline', 'breakdown', 'updates', 'setup'],
    leadChartType: 'flow',
  }
}

export function dashboardStorageKey(orgId: string, userId: string) {
  return `techsync:dashboard:v1:${encodeURIComponent(orgId)}:${encodeURIComponent(userId)}`
}

export function parsePreferences(raw: string | null): DashboardPreferences {
  if (!raw) return defaultPreferences()
  try {
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !Array.isArray(value.kpis) || !Array.isArray(value.widgets)) return defaultPreferences()
    return {
      version: 1,
      leadChartType: isLeadChartType(value.leadChartType) ? value.leadChartType : 'flow',
      kpis: [...new Set<KpiId>(value.kpis.filter((id: unknown) => KPI_OPTIONS.some((option) => option.id === id)))],
      widgets: [
        ...new Set<WidgetId>(value.widgets.filter((id: unknown) => WIDGET_OPTIONS.some((option) => option.id === id))),
      ],
    }
  } catch {
    return defaultPreferences()
  }
}

export function readPreferences(key: string): DashboardPreferences {
  try {
    return parsePreferences(localStorage.getItem(key))
  } catch {
    return defaultPreferences()
  }
}

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = [...items]
  const target = index + direction
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
