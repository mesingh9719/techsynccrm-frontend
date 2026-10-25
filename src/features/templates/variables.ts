import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import type { TemplateChannel, TemplateInput } from './api'

export type VariableType = 'text' | 'textarea' | 'number' | 'date' | 'url' | 'email' | 'checkbox'
export type VariableValues = Record<string, string | number | boolean | null>
export interface VariableDefinition {
  key: string; label: string; type: VariableType; required: boolean; defaultValue?: string | number | boolean
  helpText: string; placeholder: string; position: number; rules: { min?: number; max?: number; minLength?: number; maxLength?: number }
}
export interface VariableField extends VariableDefinition { source: 'system' | 'crm' | 'template'; value?: string | number | boolean | null; error?: string | null }
export interface RenderedTemplate { subject: string; bodyHtml: string; fields: VariableField[]; errors: Record<string, string>; valid: boolean; channel: TemplateChannel; templateId?: string; templateVersion?: number; renderHash?: string }
export interface RenderInput { entityType: 'lead' | 'contact'; entityId: string; to?: string; subject?: string; bodyHtml?: string; values?: VariableValues; expectedVersion?: number }
export const renderTemplate = (id: string, body: RenderInput, signal?: AbortSignal) => api<RenderedTemplate>(`/templates/${id}/render`, { method: 'POST', body, signal })
export function useVariableCatalogue(recordType = 'any') {
  const orgId = useOrgId()
  return useQuery({ queryKey: ['org', orgId, 'templates', 'variable-catalogue', recordType], queryFn: ({ signal }) => api<{ fields: VariableField[] }>('/templates/variables', { query: { recordType }, signal }).then((d) => d.fields) })
}

/** Completion values stay in this mounted form, outside shared query caches and storage. */
export function useTemplateRendering(input: RenderInput | (Pick<TemplateInput, 'subject' | 'bodyHtml' | 'channel' | 'variables' | 'recordType'> & { values: VariableValues }), id?: string, enabled = true) {
  const orgId = useOrgId(), [retry, setRetry] = useState(0)
  const signature = JSON.stringify({ input, id, orgId, retry })
  const identity = `${orgId}:${id || 'example'}`
  const [state, setState] = useState<{ signature: string; identity?: string; result?: RenderedTemplate; error?: string }>({ signature: '' })
  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    const timer = window.setTimeout(() => {
      const body = JSON.parse(signature).input
      const request = id ? renderTemplate(id, body, abort.signal) : api<RenderedTemplate>('/templates/preview', { method: 'POST', body, signal: abort.signal })
      void request.then((result) => { if (!abort.signal.aborted) setState({ signature, identity, result }) }).catch((error) => { if (!abort.signal.aborted) setState({ signature, identity, error: error instanceof ApiError && Object.keys(error.fields).length ? Object.values(error.fields).join(' ') : error instanceof Error ? error.message : 'Couldn’t render this template. Try again.' }) })
    }, 200)
    return () => { window.clearTimeout(timer); abort.abort() }
  }, [signature, id, identity, enabled])
  return { result: state.identity === identity && enabled ? state.result : undefined, error: state.signature === signature && enabled ? state.error : undefined, pending: enabled && state.signature !== signature, retry: () => setRetry((v) => v + 1) }
}

export const normalizeVariableKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
export function variableExample(field: Pick<VariableDefinition, 'type' | 'label' | 'required' | 'defaultValue'>): string | number | boolean {
  if (field.defaultValue !== undefined && field.defaultValue !== '') return field.defaultValue
  if (field.required === false) return ''
  return ({ url: 'https://example.com/meet', email: 'asha@example.com', date: '2026-11-10', number: 100, checkbox: true, textarea: 'Example details', text: `Sample ${field.label}` })[field.type] ?? `Sample ${field.label}`
}
