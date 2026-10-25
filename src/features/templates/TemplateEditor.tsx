import { useRef, useState } from 'react'
import { Copy, FileText } from 'lucide-react'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { ApiError } from '../../services/http'
import { VariablePanel } from './VariablePanel'
import { useVariableCatalogue, type VariableDefinition } from './variables'
import { RichEmailEditor, type RichEmailEditorHandle } from '../email/RichEmailEditor'
import { textEmailHtml } from '../email/content'
import { TemplatePreview } from './TemplatePreview'
import { channels, categories, fieldLabels, htmlText, templateErrors } from './content'
import { createTemplate, updateTemplate, type Template, type TemplateInput } from './api'

const blank: TemplateInput = { name: '', channel: 'email', category: 'general', subject: '', bodyHtml: '', shared: false }
export function TemplateEditor({ template, initial, canShare, emailEnabled, onClose, onSaved, onConflict }: { template?: Template; initial?: TemplateInput; canShare: boolean; emailEnabled: boolean; onClose: () => void; onSaved: () => Promise<unknown>; onConflict?: () => Promise<unknown> }) {
  const [values, setValues] = useState<TemplateInput>(() => {
    const t = template || initial || blank
    return { name: t.name, channel: t.channel, category: t.category, subject: t.subject, bodyHtml: t.bodyHtml, shared: t.shared, variables: t.variables || [], recordType: t.recordType || 'any' }
  })
  const [plainBody, setPlainBody] = useState(() => htmlText(values.bodyHtml))
  const [editorSeed, setEditorSeed] = useState(values.bodyHtml)
  const catalogue = useVariableCatalogue(values.recordType || 'any')
  const allLabels = { ...fieldLabels, ...Object.fromEntries((catalogue.data || []).map((d) => [d.key, d.label])), ...Object.fromEntries((values.variables || []).map((d) => [d.key, d.label])) }
  const errorRef = useRef<HTMLDivElement>(null)
  const richRef = useRef<RichEmailEditorHandle>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const subjectRef = useRef<HTMLInputElement>(null), bodyRef = useRef<HTMLTextAreaElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState(''), [conflict, setConflict] = useState(false), [busy, setBusy] = useState(false)
  const guard = useUnsavedChanges(values, onClose, busy)
  const set = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) => { setValues((v) => ({ ...v, [key]: value })); setErrors((previous) => { const next = { ...previous }; delete next[key]; return next }); setError('') }
  async function save(asCopy = false) {
    const issues = templateErrors(values, Object.keys(allLabels)); setErrors(issues); setError('')
    if (Object.keys(issues).length) return
    setBusy(true)
    try {
      if (template && !asCopy) { const { channel: _channel, ...input } = values; await updateTemplate(template, input) }
      else await createTemplate({ ...values, ...(asCopy && { name: `${values.name.slice(0, 113)} (copy)`, shared: false }) })
      guard.markSaved(); await onSaved()
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fields); setConflict(err.code === 'STALE_UPDATE'); if (err.code === 'STALE_UPDATE') await onConflict?.() }
      setError(err instanceof ApiError && Object.keys(err.fields).length ? Object.values(err.fields).join(' ') : err instanceof Error ? err.message : 'Couldn’t save your template. Try again.')
      requestAnimationFrame(() => { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus() })
    } finally { setBusy(false) }
  }
  function insert(field: string, target: 'subject' | 'body') {
    if (target === 'body' && values.channel === 'email') { richRef.current?.insert(`{{${field}}}`); return }
    const control = target === 'subject' ? subjectRef.current : bodyRef.current
    const text = target === 'subject' ? values.subject : plainBody
    const start = control?.selectionStart ?? text.length, end = control?.selectionEnd ?? start, token = `{{${field}}}`
    const next = text.slice(0, start) + token + text.slice(end)
    if (target === 'subject') set('subject', next); else { setPlainBody(next); set('bodyHtml', textEmailHtml(next)) }
    requestAnimationFrame(() => { control?.focus(); control?.setSelectionRange(start + token.length, start + token.length) })
  }
  return <><Dialog open onClose={guard.requestClose} title={template ? 'Edit template' : 'Create template'} description="Write once. Make every conversation feel personal." icon={FileText} size="xl" busy={busy} footer={<><Button variant="secondary" disabled={busy} onClick={guard.requestClose}>Cancel</Button>{conflict && <Button variant="secondary" loading={busy} onClick={() => save(true)}><Copy className="size-4" />Save as personal copy</Button>}<Button type="submit" form="template-editor" loading={busy} disabled={(values.channel === 'email' && !emailEnabled) || conflict}>Save template</Button></>}>
    <div className="template-editor-grid">
      <form id="template-editor" className="min-w-0 space-y-5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <fieldset disabled={busy} className="space-y-5">
          <Field label="Template name" required error={errors.name} hint="Use a name your team will recognize, such as Proposal follow-up.">{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoFocus maxLength={120} required value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. A friendly first response" />}</Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Channel">{({ id }) => <Select id={id} value={values.channel} disabled={Boolean(template)} onChange={(e) => { setPlainBody(htmlText(values.bodyHtml)); setEditorSeed(values.bodyHtml); setValues((v) => ({ ...v, channel: e.target.value as TemplateInput['channel'], subject: e.target.value === 'email' ? v.subject : '' })) }}>{Object.entries(channels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>}</Field><Field label="Category">{({ id }) => <Select id={id} value={values.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>}</Field></div>
          <Field label="Recipient context" hint="Namespaced fields must match the selected record type. Changing context may require replacing existing references.">{({ id }) => <Select id={id} value={values.recordType || 'any'} onChange={(e) => set('recordType', e.target.value as 'any' | 'lead' | 'contact')}><option value="any">Leads and contacts · shared fields</option><option value="lead">Leads</option><option value="contact">Contacts and their primary company</option></Select>}</Field>
          {values.channel === 'email' && <Field label="Subject" required error={errors.subject}>{({ id, invalid, describedBy }) => <><Input ref={subjectRef} id={id} aria-describedby={describedBy} invalid={invalid} required maxLength={998} value={values.subject} onChange={(e) => set('subject', e.target.value)} placeholder="A clear, personal subject line" /><select aria-label="Insert subject field" value="" className="mt-2 rounded border border-line bg-surface p-1.5 text-xs text-muted" onChange={(e) => { if (e.target.value) insert(e.target.value, 'subject') }}><option value="">Insert subject field…</option>{Object.entries(allLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></>}</Field>}
          <div><p className="mb-2 text-sm font-medium text-ink">Message <span className="text-danger">*</span></p>{values.channel === 'email' ? <RichEmailEditor initialHtml={editorSeed} onChange={(html) => set('bodyHtml', html)} label="Template message" disabled={busy} fields={allLabels} ref={richRef} key={editorVersion} /> : <><Textarea ref={bodyRef} aria-label="Template message" aria-invalid={Boolean(errors.bodyHtml)} className="min-h-56" value={plainBody} onChange={(e) => { setPlainBody(e.target.value); set('bodyHtml', textEmailHtml(e.target.value)) }} /><select aria-label="Insert message field" value="" className="mt-2 rounded border border-line bg-surface p-1.5 text-xs text-muted" onChange={(e) => { if (e.target.value) insert(e.target.value, 'body') }}><option value="">Insert field…</option>{Object.entries(allLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><p className="mt-2 text-xs text-muted">{htmlText(values.bodyHtml).length.toLocaleString()} / {values.channel === 'sms' ? '1,600 characters · long messages may use multiple SMS segments' : '4,096 characters'}</p></>}{errors.bodyHtml && <p role="alert" className="mt-2 text-sm text-red-600">{errors.bodyHtml}</p>}<p className="mt-2 text-xs leading-5 text-muted">Fields fill from the recipient and workspace. Missing values must be completed before sending.</p></div>
          {catalogue.isPending && <p role="status" className="text-xs text-muted">Loading CRM variable definitions…</p>}
          {catalogue.isError && <FormAlert>Couldn’t load CRM variable definitions. <button type="button" className="underline" onClick={() => catalogue.refetch()}>Try again</button></FormAlert>}
          <VariablePanel definitions={values.variables || []} catalogue={catalogue.data || []} subject={values.subject} bodyHtml={values.bodyHtml} disabled={busy} onChange={(defs) => set('variables', defs)} onInsert={insert} onRename={(oldKey, definition: VariableDefinition) => {
            const replace = (text: string) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (token, key: string) => key === oldKey ? '{{' + definition.key + '}}' : token)
            const bodyHtml = replace(values.bodyHtml)
            setValues((v) => ({ ...v, subject: replace(v.subject), bodyHtml, variables: (v.variables || []).map((d) => d.key === oldKey ? definition : d) }))
            setEditorSeed(bodyHtml); setEditorVersion((v) => v + 1); setPlainBody(htmlText(bodyHtml))
          }} />
          <Field label="Visibility" hint={values.shared ? 'Everyone in this workspace can use this template. Owners and admins can edit it.' : 'Only you can see and use this template.'}>{({ id }) => <Select id={id} value={values.shared ? 'team' : 'personal'} onChange={(e) => set('shared', e.target.value === 'team')}><option value="personal">Personal · only me</option>{canShare && <option value="team">Team · everyone in this workspace</option>}</Select>}</Field>
        </fieldset>
        {values.channel === 'email' && !emailEnabled && <FormAlert>Email templates are included in Growth and above. You can create WhatsApp and SMS templates on your current plan.</FormAlert>}
        {error && <div ref={errorRef} tabIndex={-1}><FormAlert>{error}</FormAlert></div>}
        <p className="text-xs leading-5 text-muted">{values.channel === 'whatsapp' ? 'Quick replies open WhatsApp with a draft. These are not Meta-approved templates for automated business messaging.' : values.channel === 'sms' ? 'Quick replies open your SMS app with a draft. Review the message before sending.' : 'Available in the email composer for leads and contacts. Your email signature is added when sending.'}</p>
      </form>
      <TemplatePreview template={values} />
    </div>
  </Dialog>{guard.confirmation}</>
}
