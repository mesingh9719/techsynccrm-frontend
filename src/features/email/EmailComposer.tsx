import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Send } from 'lucide-react'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input, Select } from '../../components/ui/Form'
import { useAuth } from '../../lib/useAuth'
import { qk } from '../../lib/queryKeys'
import { ApiError } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import { listFiles } from '../files/api'
import { emailKey, emailTemplates, getEmail, sendEmail, type EmailDraft, type EmailMessage, type EmailRecord, type SendEmail } from './api'
import { emailStatusLabel, previewMerge, textEmailHtml } from './content'
import { ConnectGmail } from './ConnectGmail'
import { RichEmailEditor } from './RichEmailEditor'
import { useGmail } from './useGmail'

export function EmailComposer({ record, draft = {}, onClose }: { record: EmailRecord; draft?: EmailDraft; onClose: () => void }) {
  const orgId = useOrgId(), { user } = useAuth()
  return <Composer key={`${orgId}:${user?.id}:${record.entityType}:${record.entityId}`} record={record} draft={draft} onClose={onClose} />
}
function Composer({ record, draft, onClose }: { record: EmailRecord; draft: EmailDraft; onClose: () => void }) {
  const orgId = useOrgId(), { user } = useAuth(), client = useQueryClient(), gmail = useGmail()
  const [to, setTo] = useState(draft.to ?? (record.emails.find((e) => e.primary) ?? record.emails[0])?.value ?? '')
  const [subject, setSubject] = useState(draft.subject ?? ''), [bodyHtml, setBody] = useState(draft.bodyHtml ?? textEmailHtml(draft.body))
  const [seed, setSeed] = useState({ html: bodyHtml, version: 0 }), [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState<EmailMessage | null>(null)
  // Preserve the exact request and key after an uncertain HTTP response. Retrying cannot enqueue a second send.
  const snapshot = useRef<{ input: SendEmail; key: string } | null>(null)
  const [locked, setLocked] = useState(false)
  const account = gmail.data?.account, ready = gmail.data?.enabled && gmail.data.entitled && account && ['connected', 'syncing', 'delayed'].includes(account.status)
  const templates = useQuery({ queryKey: [...emailKey(orgId), 'templates'], queryFn: emailTemplates, enabled: Boolean(ready) })
  const files = useQuery({ queryKey: [...emailKey(orgId), 'files', record.entityType, record.entityId], queryFn: () => listFiles(record), enabled: Boolean(ready) })
  const fields = { firstName: record.firstName ?? record.name.split(' ')[0], lastName: record.lastName, name: record.name, company: record.company, owner: user?.fullName, workspace: user?.organization?.name }
  const mergedSubject = previewMerge(subject, fields), mergedBody = previewMerge(bodyHtml, fields, true)
  const missing = [...new Set([...mergedSubject.missing, ...mergedBody.missing])]
  const status = message?.status
  const finished = Boolean(status && !['queued', 'sending'].includes(status))
  const messageId = message?.id
  useEffect(() => {
    if (!messageId || finished) return
    let cancelled = false
    const interval = window.setInterval(() => {
      void getEmail(messageId).then((row) => {
        if (cancelled) return
        setMessage(row)
        if (!['queued', 'sending'].includes(row.status)) {
          void client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })
          void client.invalidateQueries({ queryKey: qk.org(orgId).leads.all })
          void client.invalidateQueries({ queryKey: qk.org(orgId).contacts.all })
        }
      }).catch(() => { /* The durable queue owns delivery; a lost browser connection must not retry the send. */ })
    }, 2000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [messageId, finished, client, orgId])
  async function send() {
    if (busy || message) return
    setError(null); setBusy(true)
    const retrying = snapshot.current !== null
    snapshot.current ??= { key: crypto.randomUUID(), input: { entityType: record.entityType, entityId: record.entityId, to, subject: mergedSubject.value, bodyHtml: mergedBody.value, attachmentFileIds: attachmentIds, ...(draft.replyToMessageId && { replyToMessageId: draft.replyToMessageId }) } }
    setLocked(true)
    try { setMessage(await sendEmail(snapshot.current.input, snapshot.current.key)) }
    catch (err) {
      if (!retrying && err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) { snapshot.current = null; setLocked(false) }
      setError(err instanceof Error ? err.message : 'The request could not be confirmed. Retry this same request to check its status.')
    } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} title={draft.replyToMessageId ? 'Reply with Gmail' : 'Email lead or contact'} icon={Mail} variant="drawer" size="lg" busy={busy} dirty={!locked && Boolean(subject || bodyHtml !== '<p></p>')} footer={<><Button variant="secondary" onClick={onClose}>{message ? 'Close' : 'Cancel'}</Button>{ready && !message && <Button loading={busy} disabled={!to || !subject.trim() || missing.length > 0 || !bodyHtml.replace(/<[^>]*>/g, '').trim()} onClick={send}><Send className="size-4" />{locked ? 'Check / retry same request' : 'Send with Gmail'}</Button>}</>}>
    <div className="space-y-4">
      {gmail.isPending && <p className="text-sm text-muted">Checking your Gmail connection…</p>}
      {gmail.isError && <FormAlert>Couldn’t load Gmail. <button type="button" onClick={() => gmail.refetch()} className="underline">Try again</button></FormAlert>}
      {gmail.data && !ready && <ConnectGmail state={gmail.data} returnTo={window.location.pathname} />}
      {!ready && <Button variant="secondary" href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft.body ?? '')}`}>Open email app</Button>}
      {account && <p className="text-sm text-muted">From <strong className="text-ink">{account.email}</strong> · shared on {record.name}’s record</p>}
      {message ? <div role="status" className="space-y-3 rounded-lg bg-surface-subtle p-4"><p className="font-medium">{emailStatusLabel[message.status] ?? message.status}</p><p className="text-sm text-muted">{status === 'provider_accepted' ? 'Gmail accepted this message. Delivery and reading are not confirmed.' : status === 'unknown' ? 'Gmail may have accepted this message. Check Sent in Gmail before starting another email. TechSync will reconcile it without resending.' : status === 'queued' || status === 'sending' ? 'You can close this panel. TechSync will keep processing the message.' : 'Check the connection and recipient before starting another email.'}</p><a href="https://mail.google.com/mail/u/0/#sent" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline">Open Gmail Sent</a></div> : <>
        <label className="block text-sm font-medium">To<Select aria-label="To" value={to} disabled={locked} onChange={(e) => setTo(e.target.value)}>{record.emails.map((email) => <option key={email.value} value={email.value}>{email.value}</option>)}</Select></label>
        {ready && <label className="block text-sm font-medium">Template<Select aria-label="Email template" value="" disabled={locked} onChange={(e) => { const template = templates.data?.find((t) => t.id === e.target.value); if (template) { setSubject(template.subject); setBody(template.bodyHtml); setSeed((s) => ({ html: template.bodyHtml, version: s.version + 1 })) } }}><option value="">Choose a personal or team template</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}{template.shared ? ' · Team' : ''}</option>)}</Select></label>}
        <label className="block text-sm font-medium">Subject<Input aria-label="Subject" value={subject} disabled={locked} maxLength={998} onChange={(e) => setSubject(e.target.value)} /></label>
        <RichEmailEditor key={seed.version} initialHtml={seed.html} onChange={setBody} disabled={locked} />
        {account?.signatureHtml && <div className="text-sm"><p className="mb-2 text-xs text-muted">Your signature is added automatically</p><div className="email-body" dangerouslySetInnerHTML={{ __html: account.signatureHtml }} /></div>}
        {missing.length > 0 && <FormAlert>Fill or remove these merge fields before sending: {missing.join(', ')}.</FormAlert>}
        {(/\{\{/.test(subject) || /\{\{/.test(bodyHtml)) && <div className="rounded-lg border border-line p-3 text-sm"><p className="font-medium">Preview: {mergedSubject.value}</p><div className="email-body mt-2" dangerouslySetInnerHTML={{ __html: mergedBody.value }} /></div>}
        {ready && <fieldset disabled={locked} className="space-y-2"><legend className="mb-2 text-sm font-medium">CRM attachments · up to 3 files / 10 MB</legend>{files.data?.filter((file) => file.status === 'ready' && !file.deletedAt).map((file) => <label key={file.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={attachmentIds.includes(file.id)} disabled={!attachmentIds.includes(file.id) && (attachmentIds.length >= 3 || file.size + (files.data ?? []).filter((f) => attachmentIds.includes(f.id)).reduce((sum, f) => sum + f.size, 0) > 10 * 1024 ** 2)} onChange={(e) => setAttachmentIds((ids) => e.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id))} />{file.name} <span className="text-muted">({Math.ceil(file.size / 1024)} KB)</span></label>)}{files.isError && <p className="text-sm text-danger">Couldn’t load attachments.</p>}<p className="text-xs text-muted">Upload files in the record’s Attachments section first. Incoming attachment names are shown; their files stay in Gmail.</p></fieldset>}
      </>}
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  </Dialog>
}
