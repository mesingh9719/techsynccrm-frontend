import { useState } from 'react'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { MessagePreview } from './TemplatePreview'
import { VariableInputs } from './VariableInputs'
import { useTemplateRendering, type VariableValues } from './variables'
import { htmlText } from './content'

export function PrepareMessageDialog({ templateId, version, name, channel, entityId, onClose, onReady }: { templateId: string; version?: number; name: string; channel: 'whatsapp' | 'sms'; entityId: string; onClose: () => void; onReady: (body: string) => void }) {
  const [values, setValues] = useState<VariableValues>({})
  const rendering = useTemplateRendering({ entityType: 'lead', entityId, values, expectedVersion: version }, templateId)
  return <Dialog open onClose={onClose} title={`Prepare ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} message`} description={name} size="lg" dirty={Object.keys(values).length > 0} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={rendering.pending || !rendering.result?.valid || Boolean(rendering.error)} onClick={() => { if (rendering.result?.valid) onReady(htmlText(rendering.result.bodyHtml)) }}>Open {channel === 'whatsapp' ? 'WhatsApp' : 'SMS app'}</Button></>}><div className="space-y-5"><p className="text-xs leading-5 text-muted">Fill any missing details and review the message. These values are used once and do not change the shared template or CRM record.</p>{rendering.pending && <p role="status" className="text-sm text-muted">Preparing message…</p>}{rendering.error && <FormAlert>{rendering.error} <button type="button" className="underline" onClick={rendering.retry}>Retry</button></FormAlert>}{rendering.result && <><VariableInputs fields={rendering.result.fields} values={values} onChange={setValues} />{!rendering.result.valid && <FormAlert>{Object.values(rendering.result.errors).join(' ')}</FormAlert>}<MessagePreview channel={channel} name={name} subject="" bodyHtml={rendering.result.bodyHtml} /></>}</div></Dialog>
}
