/** Live lead capture and routing. Every saved change is persisted by the tenant API. */
import { api, ApiError } from '../../services/http'
import type { AssignmentRule, AssignmentTest, OutOfOffice, Submission, WebForm, WorkingHours } from './types'
import { normalizeForm } from './formConfig'

// Retained for UI capability checks. Rollout switches return errors; they never enable previews.
export const captureLive = true
export const assignmentLive = true
const captureEnabled = import.meta.env.VITE_CRM_CAPTURE_API !== 'false'
const assignmentEnabled = import.meta.env.VITE_CRM_ASSIGNMENT_API !== 'false'
export const captureKeys = (scope: string) => ['org', scope.split(':')[0], 'capture', scope] as const

const captureApi = <T>(path: string, options?: Parameters<typeof api>[1]) => captureEnabled
  ? api<T>(path, options)
  : Promise.reject(new ApiError('Lead source settings are temporarily unavailable.', 503, 'FEATURE_DISABLED'))
const assignmentApi = <T>(path: string, options?: Parameters<typeof api>[1]) => assignmentEnabled
  ? api<T>(path, options)
  : Promise.reject(new ApiError('Assignment settings are temporarily unavailable.', 503, 'FEATURE_DISABLED'))

export function makeCaptureApi(_scope: string) {
  return {
    listForms: () => captureApi<{ forms: WebForm[] }>('/forms').then((d) => d.forms.map(normalizeForm)),
    getForm: (id: string) => captureApi<{ form: WebForm }>(`/forms/${id}`).then((d) => normalizeForm(d.form)),
    saveForm: (form: WebForm, isNew: boolean) => captureApi<{ form: WebForm }>(isNew ? '/forms' : `/forms/${form.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      body: { name: form.name, fields: form.fields, settings: form.settings, sourceId: form.settings.sourceId, isActive: form.isActive },
    }).then((d) => normalizeForm(d.form)),
    deleteForm: (id: string) => captureApi<void>(`/forms/${id}`, { method: 'DELETE' }),
    submissions: (id: string) => captureApi<{ items: Submission[] }>(`/forms/${id}/submissions`).then((d) => d.items),
    embedCode: (id: string) => captureApi<{ script: string; iframe: string; hostedUrl: string }>(`/forms/${id}/embed-code`),
    listRules: () => assignmentApi<{ rules: AssignmentRule[] }>('/assignment-rules').then((d) => d.rules),
    saveRule: (rule: AssignmentRule, isNew: boolean) => assignmentApi<{ rule: AssignmentRule }>(isNew ? '/assignment-rules' : `/assignment-rules/${rule.id}`, { method: isNew ? 'POST' : 'PATCH', body: rule }).then((d) => d.rule),
    deleteRule: (id: string) => assignmentApi<void>(`/assignment-rules/${id}`, { method: 'DELETE' }),
    orderRules: (ids: string[]) => assignmentApi('/assignment-rules/order', { method: 'PATCH', body: { ids } }),
    getHours: () => assignmentApi<WorkingHours>('/working-hours'),
    saveHours: (hours: WorkingHours) => assignmentApi<WorkingHours>('/working-hours', { method: 'PUT', body: hours }),
    listAbsences: () => assignmentApi<{ items: OutOfOffice[] }>('/users/me/out-of-office').then((d) => d.items),
    addAbsence: (values: Omit<OutOfOffice, 'id'>) => assignmentApi<{ outOfOffice: OutOfOffice }>('/users/me/out-of-office', { method: 'POST', body: values }).then((d) => d.outOfOffice),
    deleteAbsence: (id: string) => assignmentApi<void>(`/users/me/out-of-office/${id}`, { method: 'DELETE' }),
    test: (leadSample: Record<string, string>) => assignmentApi<AssignmentTest>('/assignment-rules/test', { method: 'POST', body: { leadSample } }),
  }
}

/** The most useful message for a failed save: the first field error when the server sent them. */
export function errorText(err: unknown, fallback: string) {
  if (err instanceof ApiError) return Object.values(err.fields)[0] ?? err.message
  return err instanceof Error ? err.message : fallback
}

export function getPublicForm(key: string) {
  return api<WebForm>(`/public/forms/${encodeURIComponent(key)}`, { anonymous: true, retryOnExpiry: false }).then(
    normalizeForm,
  )
}
export function recordFormView(key: string) {
  return api(`/public/forms/${encodeURIComponent(key)}/view`, { method: 'POST', anonymous: true, retryOnExpiry: false })
}
export function submitPublicForm(key: string, body: Record<string, unknown>) {
  return api<{ ok: true; message?: string; redirectUrl?: string }>(`/public/forms/${encodeURIComponent(key)}/submit`, {
    method: 'POST',
    body,
    anonymous: true,
    retryOnExpiry: false,
  })
}
