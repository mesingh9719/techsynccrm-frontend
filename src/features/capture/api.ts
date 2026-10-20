/** M14 contracts. Preview is explicit and never used as a fallback for a failed live request. */
import { api } from '../../services/http'
import type { AssignmentRule, AssignmentTest, OutOfOffice, Submission, WebForm, WorkingHours } from './types'

export const captureLive = import.meta.env.VITE_CRM_CAPTURE_API === 'true'
export const captureKeys = (scope: string) => ['org', scope.split(':')[0], 'capture', scope] as const
interface PreviewData {
  version: 1
  forms: WebForm[]
  rules: AssignmentRule[]
  hours: WorkingHours
  submissions: Submission[]
  absences?: OutOfOffice[]
}
const memory = new Map<string, PreviewData>()
function initial(): PreviewData {
  return {
    version: 1,
    forms: [],
    rules: [],
    hours: {
      timezone: 'Asia/Kolkata',
      days: [1, 2, 3, 4, 5, 6],
      start: '10:00',
      end: '19:00',
      fallbackOwnerId: null,
      firstResponseSlaMinutes: 30,
      slaAutoReassign: false,
    },
    submissions: [],
  }
}
function read(scope: string): PreviewData {
  const key = `techsync:capture-preview:v1:${scope}`
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null') as PreviewData | null
    if (
      data?.version === 1 &&
      Array.isArray(data.forms) &&
      Array.isArray(data.rules) &&
      data.hours &&
      Array.isArray(data.submissions)
    )
      return data
  } catch {
    /* Browser storage can be disabled. */
  }
  return memory.get(key) ?? initial()
}
function write(scope: string, data: PreviewData) {
  const key = `techsync:capture-preview:v1:${scope}`
  memory.set(key, data)
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* Kept for the lifetime of this tab. */
  }
}
export function makeCaptureApi(scope: string) {
  return {
    listForms: () =>
      captureLive ? api<{ forms: WebForm[] }>('/forms').then((d) => d.forms) : Promise.resolve(read(scope).forms),
    getForm: (id: string) =>
      captureLive
        ? api<{ form: WebForm }>(`/forms/${id}`).then((d) => d.form)
        : Promise.resolve(read(scope).forms.find((f) => f.id === id) ?? null),
    async saveForm(form: WebForm, isNew: boolean) {
      if (captureLive)
        return api<{ form: WebForm }>(isNew ? '/forms' : `/forms/${form.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          body: {
            name: form.name,
            fields: form.fields,
            settings: form.settings,
            sourceId: form.settings.sourceId,
            isActive: form.isActive,
          },
        }).then((d) => d.form)
      const data = read(scope),
        saved = { ...form, updatedAt: new Date().toISOString() }
      data.forms = [...data.forms.filter((f) => f.id !== form.id), saved]
      write(scope, data)
      return saved
    },
    async deleteForm(id: string) {
      if (captureLive) return api<void>(`/forms/${id}`, { method: 'DELETE' })
      const data = read(scope)
      data.forms = data.forms.filter((f) => f.id !== id)
      data.submissions = data.submissions.filter((s) => s.formId !== id)
      write(scope, data)
    },
    submissions: (id: string) =>
      captureLive
        ? api<{ items: Submission[] }>(`/forms/${id}/submissions`).then((d) => d.items)
        : Promise.resolve(read(scope).submissions.filter((s) => s.formId === id)),
    embedCode: (id: string) => api<{ script: string; iframe: string; hostedUrl: string }>(`/forms/${id}/embed-code`),
    listRules: () =>
      captureLive
        ? api<{ rules: AssignmentRule[] }>('/assignment-rules').then((d) => d.rules)
        : Promise.resolve(read(scope).rules.toSorted((a, b) => a.position - b.position)),
    async saveRule(rule: AssignmentRule, isNew: boolean) {
      if (captureLive)
        return api<{ rule: AssignmentRule }>(isNew ? '/assignment-rules' : `/assignment-rules/${rule.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          body: rule,
        }).then((d) => d.rule)
      const data = read(scope)
      data.rules = [...data.rules.filter((r) => r.id !== rule.id), rule]
      write(scope, data)
      return rule
    },
    async deleteRule(id: string) {
      if (captureLive) return api<void>(`/assignment-rules/${id}`, { method: 'DELETE' })
      const data = read(scope)
      data.rules = data.rules.filter((r) => r.id !== id)
      write(scope, data)
    },
    async orderRules(ids: string[]) {
      if (captureLive) return api('/assignment-rules/order', { method: 'PATCH', body: { ids } })
      const data = read(scope)
      data.rules = data.rules.map((r) => ({ ...r, position: ids.indexOf(r.id) }))
      write(scope, data)
    },
    getHours: () => (captureLive ? api<WorkingHours>('/working-hours') : Promise.resolve(read(scope).hours)),
    async saveHours(hours: WorkingHours) {
      if (captureLive) return api<WorkingHours>('/working-hours', { method: 'PUT', body: hours })
      const data = read(scope)
      data.hours = hours
      write(scope, data)
      return hours
    },
    listAbsences: () =>
      captureLive
        ? api<{ items: OutOfOffice[] }>('/users/me/out-of-office').then((d) => d.items)
        : Promise.resolve(read(scope).absences ?? []),
    async addAbsence(values: Omit<OutOfOffice, 'id'>) {
      if (captureLive)
        return api<{ outOfOffice: OutOfOffice }>('/users/me/out-of-office', { method: 'POST', body: values }).then(
          (d) => d.outOfOffice,
        )
      const data = read(scope),
        absence = { ...values, id: crypto.randomUUID() }
      data.absences = [...(data.absences ?? []), absence]
      write(scope, data)
      return absence
    },
    async deleteAbsence(id: string) {
      if (captureLive) return api<void>(`/users/me/out-of-office/${id}`, { method: 'DELETE' })
      const data = read(scope)
      data.absences = (data.absences ?? []).filter((a) => a.id !== id)
      write(scope, data)
    },
    async test(leadSample: Record<string, string>): Promise<AssignmentTest> {
      if (captureLive) return api<AssignmentTest>('/assignment-rules/test', { method: 'POST', body: { leadSample } })
      const data = read(scope),
        rule = data.rules
          .toSorted((a, b) => a.position - b.position)
          .find(
            (r) =>
              r.isActive &&
              r.memberIds.length &&
              r.conditions.every((c) => {
                const actual = String(leadSample[c.field] ?? '').toLowerCase(),
                  expected = c.value.toLowerCase()
                return c.operator === 'contains'
                  ? actual.includes(expected)
                  : c.operator === 'starts_with'
                    ? actual.startsWith(expected)
                    : c.operator === 'gte'
                      ? actual !== '' && Number(actual) >= Number(expected)
                      : c.operator === 'lte'
                        ? actual !== '' && Number(actual) <= Number(expected)
                        : actual === expected
              }),
          )
      return {
        ruleId: rule?.id ?? null,
        ruleName: rule?.name ?? null,
        ownerId: rule?.memberIds[(rule.lastAssignedIndex + 1) % rule.memberIds.length] ?? data.hours.fallbackOwnerId,
        preview: true,
        explanation: rule
          ? 'Conditions match. This preview suggests the next configured member without advancing the rotation. Live eligibility, load, hours and daily caps require the assignment service.'
          : 'No active rule matches. The fallback owner is suggested; otherwise the lead remains unassigned.',
      }
    },
  }
}

export function getPublicForm(key: string) {
  return api<WebForm>(`/public/forms/${encodeURIComponent(key)}`, { anonymous: true, retryOnExpiry: false })
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
