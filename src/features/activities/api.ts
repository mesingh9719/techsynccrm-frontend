/** Timeline, activities and tasks API — /api/timeline, /api/activities, /api/tasks (M10). */
import { api } from '../../services/http'
import type { Activity, ActivityType, BulkResult, CallOutcome, RecordType, Task, TaskPriority, TaskRecurrence, TaskType, TaskView, TimelinePage } from '../crm/types'

export interface LogActivityInput {
  type: Exclude<ActivityType, 'system'>
  entityType: RecordType
  entityId: string
  subject?: string | null
  body?: string | null
  occurredAt?: string
  endAt?: string | null
  direction?: 'inbound' | 'outbound' | null
  outcome?: CallOutcome | null
  durationSeconds?: number | null
  location?: { text?: string } | null
  participantUserIds?: string[]
  participantContactIds?: string[]
}

export function getTimeline(params: { entityType: RecordType; entityId: string; types?: string; cursor?: string; limit?: number }) {
  return api<TimelinePage>('/timeline', { query: params })
}

export function logActivity(values: LogActivityInput) {
  return api<{ activity: Activity }>('/activities', { method: 'POST', body: values }).then((d) => d.activity)
}

export function updateActivity(id: string, values: Partial<Omit<LogActivityInput, 'type' | 'entityType' | 'entityId'>>) {
  return api<{ activity: Activity }>(`/activities/${id}`, { method: 'PATCH', body: values }).then((d) => d.activity)
}

export function deleteActivity(id: string) {
  return api<void>(`/activities/${id}`, { method: 'DELETE' })
}

export function pinActivity(id: string, pinned: boolean) {
  return api<{ activity: Activity }>(`/activities/${id}/pin`, { method: 'POST', body: { pinned } }).then((d) => d.activity)
}

// ---------- Tasks ----------

export interface TaskInput {
  title?: string
  description?: string | null
  type?: TaskType
  priority?: TaskPriority
  dueAt?: string | null
  dueDate?: string | null
  reminderOffsetMinutes?: number | null
  recurrence?: TaskRecurrence | null
  entityType?: RecordType | null
  entityId?: string | null
  assigneeId?: string
}

export type TaskCounts = Record<'today' | 'overdue' | 'upcoming' | 'completed', number>

export function listTasks(params: { view?: TaskView; assigneeId?: string; entityType?: RecordType; entityId?: string; q?: string; counts?: boolean; cursor?: string; limit?: number }) {
  return api<{ items: Task[]; nextCursor: string | null; counts?: TaskCounts }>('/tasks', { query: params })
}

export function getTaskSummary() {
  return api<{ today: number; overdue: number; tasks: Task[] }>('/tasks/summary')
}

export function createTask(values: TaskInput & { title: string }) {
  return api<{ task: Task }>('/tasks', { method: 'POST', body: values }).then((d) => d.task)
}

export function updateTask(id: string, values: TaskInput) {
  return api<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: values }).then((d) => d.task)
}

export function deleteTask(id: string) {
  return api<void>(`/tasks/${id}`, { method: 'DELETE' })
}

export function completeTask(id: string, logActivity?: { outcome?: CallOutcome; notes?: string; durationSeconds?: number }) {
  return api<{ task: Task }>(`/tasks/${id}/complete`, { method: 'POST', body: logActivity ? { logActivity } : {} }).then((d) => d.task)
}

export function reopenTask(id: string) {
  return api<{ task: Task }>(`/tasks/${id}/reopen`, { method: 'POST' }).then((d) => d.task)
}

export function cancelTask(id: string) {
  return api<{ task: Task }>(`/tasks/${id}/cancel`, { method: 'POST' }).then((d) => d.task)
}

export function bulkTasks(values: { ids: string[]; action: 'complete' | 'reassign' | 'reschedule' | 'delete'; payload?: { assigneeId?: string; dueAt?: string; dueDate?: string } }) {
  return api<BulkResult>('/tasks/bulk', { method: 'POST', body: values })
}

export const outcomeLabels: Record<CallOutcome, string> = {
  connected: 'Connected',
  no_answer: 'No answer',
  busy: 'Busy',
  wrong_number: 'Wrong number',
  callback_requested: 'Asked to call back',
  voicemail: 'Left voicemail',
}

export const taskTypeLabels: Record<TaskType, string> = {
  todo: 'To-do',
  call: 'Call',
  meeting: 'Meeting',
  follow_up: 'Follow up',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

export const recordPath = (entityType: RecordType, entityId: string) => `/app/${{ lead: 'leads', contact: 'contacts', company: 'companies', deal: 'deals' }[entityType]}/${entityId}`
