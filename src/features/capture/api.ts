/** Live lead capture and routing. Every saved change is persisted by the tenant API. */
import { api, ApiError } from '../../services/http'
import type { AssignmentRule, AssignmentTest, OutOfOffice, Submission, WebForm, WorkingHours } from './types'
import { normalizeForm } from './formConfig'

// Retained for UI capability checks. Browser-only preview persistence is retired.
export const captureLive = true
export const assignmentLive = true
export const captureKeys = (scope: string) => ['org', scope.split(':')[0], 'capture', scope] as const

export function makeCaptureApi(_scope: string) {
  return {
    listForms: () => api<{ forms: WebForm[] }>('/forms').then((d) => d.forms.map(normalizeForm)),
    getForm: (id: string) => api<{ form: WebForm }>(`/forms/${id}`).then((d) => normalizeForm(d.form)),
    saveForm: (form: WebForm, isNew: boolean) => api<{ form: WebForm }>(isNew ? '/forms' : `/forms/${form.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      body: { name: form.name, fields: form.fields, settings: form.settings, sourceId: form.settings.sourceId, isActive: form.isActive },
    }).then((d) => normalizeForm(d.form)),
    deleteForm: (id: string) => api<void>(`/forms/${id}`, { method: 'DELETE' }),
    submissions: (id: string) => api<{ items: Submission[] }>(`/forms/${id}/submissions`).then((d) => d.items),
    embedCode: (id: string) => api<{ script: string; iframe: string; hostedUrl: string }>(`/forms/${id}/embed-code`),
    listRules: () => api<{ rules: AssignmentRule[] }>('/assignment-rules').then((d) => d.rules),
    saveRule: (rule: AssignmentRule, isNew: boolean) => api<{ rule: AssignmentRule }>(isNew ? '/assignment-rules' : `/assignment-rules/${rule.id}`, { method: isNew ? 'POST' : 'PATCH', body: rule }).then((d) => d.rule),
    deleteRule: (id: string) => api<void>(`/assignment-rules/${id}`, { method: 'DELETE' }),
    orderRules: (ids: string[]) => api('/assignment-rules/order', { method: 'PATCH', body: { ids } }),
    getHours: () => api<WorkingHours>('/working-hours'),
    saveHours: (hours: WorkingHours) => api<WorkingHours>('/working-hours', { method: 'PUT', body: hours }),
    listAbsences: () => api<{ items: OutOfOffice[] }>('/users/me/out-of-office').then((d) => d.items),
    addAbsence: (values: Omit<OutOfOffice, 'id'>) => api<{ outOfOffice: OutOfOffice }>('/users/me/out-of-office', { method: 'POST', body: values }).then((d) => d.outOfOffice),
    deleteAbsence: (id: string) => api<void>(`/users/me/out-of-office/${id}`, { method: 'DELETE' }),
    test: (leadSample: Record<string, string>) => api<AssignmentTest>('/assignment-rules/test', { method: 'POST', body: { leadSample } }),
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
