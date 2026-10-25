import { useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { FormAlert, Input, Select } from '../../components/ui/Form'
import { channels, fieldLabels, htmlText, sampleFields } from './content'
import { escapeEmailHtml } from '../email/content'
import { useTemplateRendering, useVariableCatalogue, variableExample, type VariableValues } from './variables'
import type { TemplateChannel, TemplateInput } from './api'

/** Shared sandbox for example previews and final, server-rendered recipient previews. */
export function MessagePreview({ channel = 'email', name = '', subject, bodyHtml, recipient = 'your recipient' }: { channel?: TemplateChannel; name?: string; subject: string; bodyHtml: string; recipient?: string }) {
  const [mobile, setMobile] = useState(false)
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:14px/1.8 system-ui,sans-serif;color:#27272a;margin:24px;overflow-wrap:anywhere}p{margin:0 0 16px}a{color:#6d28d9}ul,ol{padding-left:20px}</style></head><body>${channel === 'email' ? bodyHtml : `<p style="white-space:pre-wrap">${escapeEmailHtml(htmlText(bodyHtml))}</p>`}</body></html>`
  return <div className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">{channel === 'email' ? 'Email preview' : 'Message preview'}</p><div className="flex rounded-lg border border-line bg-surface p-1" role="group" aria-label="Preview size">{[{ small: false, label: 'Desktop preview', icon: Monitor }, { small: true, label: 'Mobile preview', icon: Smartphone }].map(({ small, label, icon: Icon }) => <button key={label} type="button" aria-label={label} aria-pressed={mobile === small} className={`rounded p-2 ${mobile === small ? 'bg-brand-50 text-brand-700' : 'text-muted'}`} onClick={() => setMobile(small)}><Icon className="size-4" /></button>)}</div></div>
    <div className={`template-message mx-auto overflow-hidden rounded-xl border border-line bg-white shadow-card ${mobile ? 'max-w-[320px]' : 'w-full'}`}><div className="border-b border-zinc-100 px-5 py-4"><span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">{channels[channel]} preview</span><p className="mt-1 text-sm font-semibold break-words text-zinc-800">{channel === 'email' ? subject || 'Your subject goes here' : name || 'Your message'}</p><p className="mt-1 text-xs text-zinc-500">To {recipient}</p></div><iframe title="Rendered template message" sandbox="" referrerPolicy="no-referrer" srcDoc={document} className="h-80 w-full border-0 bg-white" /></div>
  </div>
}

export function TemplatePreview({ template }: { template: TemplateInput }) {
  const catalogue = useVariableCatalogue(template.recordType || 'any'), [examples, setExamples] = useState<VariableValues>({})
  const definitions = template.variables || []
  const fields = [...(catalogue.data || Object.entries(fieldLabels).map(([key, label]) => ({ key, label, type: 'text' as const, required: true }))), ...definitions]
  const samples: VariableValues = { ...sampleFields }
  for (const field of fields) samples[field.key] = sampleFields[field.key] ?? ({ 'user.name': 'Priya', 'user.email': 'priya@example.com', 'workspace.name': 'TechSync', 'lead.first_name': 'Asha', 'contact.first_name': 'Asha', 'lead.last_name': 'Shah', 'contact.last_name': 'Shah', 'lead.name': 'Asha Shah', 'contact.name': 'Asha Shah', 'lead.email': 'asha@example.com', 'contact.email': 'asha@example.com', 'lead.company': 'Acme Industries', 'company.name': 'Acme Industries' } as VariableValues)[field.key] ?? variableExample(field)
  const values = { ...samples, ...examples }
  const rendering = useTemplateRendering({ subject: template.subject, bodyHtml: template.bodyHtml, channel: template.channel, recordType: template.recordType || 'any', variables: definitions, values })
  const result = rendering.result
  return <section className="template-preview space-y-4" aria-label="Template preview">
    <div><p className="text-sm font-semibold text-ink">Live preview</p><p className="mt-1 text-xs text-muted">Example data · nothing will be sent</p></div>
    {rendering.pending && <p role="status" className="text-xs text-muted">Updating preview…</p>}
    {rendering.error && <FormAlert>{rendering.error} <button type="button" className="underline" onClick={rendering.retry}>Retry preview</button></FormAlert>}
    {result && Object.keys(result.errors).length > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{Object.values(result.errors).join(' ')}</p>}
    <MessagePreview channel={template.channel} name={template.name} subject={result?.subject || ''} bodyHtml={result?.bodyHtml || ''} recipient={String(values.name || 'your recipient')} />
    <details className="rounded-lg border border-line bg-surface p-3"><summary className="cursor-pointer text-xs font-medium text-ink">Try different example data</summary><div className="mt-3 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">{fields.map((field) => <label key={field.key} className="text-xs text-muted">{field.label}{field.type === 'checkbox' ? <Select aria-label={`Example ${field.label.toLowerCase()}`} value={String(values[field.key] ?? '')} onChange={(e) => setExamples({ ...examples, [field.key]: e.target.value === '' ? '' : e.target.value === 'true' })}><option value="">Empty</option><option value="true">Yes</option><option value="false">No</option></Select> : <Input className="mt-1" aria-label={`Example ${field.label.toLowerCase()}`} type={field.type === 'date' ? 'date' : 'text'} value={String(values[field.key] ?? '')} onChange={(e) => setExamples({ ...examples, [field.key]: e.target.value })} />}</label>)}</div></details>
  </section>
}
