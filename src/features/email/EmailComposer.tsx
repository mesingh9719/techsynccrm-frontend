import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Mail, Paperclip, Send, ShieldCheck } from 'lucide-react'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { DeliveryBadge } from './DeliveryBadge'
import { deliveryTone, formatEmailBytes } from './presentation'
import './email.css'
import { useAuth } from '../../lib/useAuth'
import { qk } from '../../lib/queryKeys'
import { ApiError } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import { listFiles } from '../files/api'
import { emailKey, emailTemplates, getEmail, sendEmail, type EmailDraft, type EmailMessage, type EmailRecord, type SendEmail } from './api'
import { previewMerge, textEmailHtml } from './content'
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
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [seed, setSeed] = useState({ html: bodyHtml, version: 0 }), [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState<EmailMessage | null>(null)
  // Preserve the exact request and key after an uncertain HTTP response. Retrying cannot enqueue a second send.
  const snapshot = useRef<{ input: SendEmail; key: string } | null>(null)
  const [locked, setLocked] = useState(false)
  const account = gmail.data?.account, ready = gmail.data?.enabled && gmail.data.entitled && account && ['connected', 'syncing', 'delayed'].includes(account.status)
  const templates = useQuery({ queryKey: [...emailKey(orgId), 'templates', user?.id], queryFn: emailTemplates, enabled: Boolean(ready) })
  const files = useQuery({ queryKey: [...emailKey(orgId), 'files', user?.id, record.entityType, record.entityId], queryFn: () => listFiles(record), enabled: Boolean(ready) })
  const availableFiles = files.data?.filter((file) => file.status === 'ready' && !file.deletedAt) ?? []
  const totalBytes = availableFiles.filter((file) => attachmentIds.includes(file.id)).reduce((total, file) => total + file.size, 0)
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
          void client.invalidateQueries({ queryKey: [...emailKey(orgId), 'threads'] })
          void client.invalidateQueries({ queryKey: [...emailKey(orgId), 'thread'] })
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
    try {
      setMessage(await sendEmail(snapshot.current.input, snapshot.current.key))
      void client.invalidateQueries({ queryKey: [...emailKey(orgId), 'threads'] })
      void client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })
    }
    catch (err) {
      if (!retrying && err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) { snapshot.current = null; setLocked(false) }
      setError(err instanceof Error ? err.message : 'The request could not be confirmed. Retry this same request to check its status.')
    } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} title={draft.replyToMessageId ? 'Reply with Gmail' : `Email ${record.name}`} icon={Mail} variant="drawer" size="lg" busy={busy} dirty={!locked && Boolean(subject || bodyHtml.replace(/<[^>]*>/g, '').trim() || attachmentIds.length)} footer={<><Button variant="secondary" onClick={onClose}>{message ? 'Close' : 'Cancel'}</Button>{ready && !message && <Button loading={busy} disabled={!to || !subject.trim() || missing.length > 0 || !bodyHtml.replace(/<[^>]*>/g, '').trim()} onClick={send}><Send className="size-4" aria-hidden="true" />{locked ? 'Check / retry same request' : 'Send with Gmail'}</Button>}</>}>
    <div className="space-y-5">
      {gmail.isPending && <p role="status" className="text-sm text-muted">Checking your Gmail connection…</p>}
      {gmail.isError && <Notice tone="danger" title="Couldn’t load Gmail" actions={<Button size="sm" variant="secondary" onClick={() => gmail.refetch()}>Try again</Button>}>Check your connection and try again.</Notice>}
      {gmail.data && !ready && <ConnectGmail state={gmail.data} returnTo={window.location.pathname} />}
      {!ready && <Button variant="secondary" href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft.body ?? '')}`}>Open email app</Button>}
      {ready && account && <div className="email-composer-context"><span className="email-icon-tile"><Mail className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-[11px] text-muted">Sending from your work Gmail</p><p className="mt-1 break-all text-sm font-semibold text-ink">{account.email}</p></div><StatusChip tone="success" icon={ShieldCheck}>Connected</StatusChip><p className="w-full text-xs leading-5 text-muted">This conversation will be shared on {record.name}’s CRM record.</p></div>}
      {message ? <Notice tone={deliveryTone(message.status)} icon={CheckCheck} title="Email status"><div className="mb-3"><DeliveryBadge status={message.status} /></div><p>{status === 'provider_accepted' ? 'Gmail accepted this message. Delivery and reading are not confirmed.' : status === 'unknown' ? 'Gmail may have accepted this message. Check Sent in Gmail before starting another email. TechSync will reconcile it without resending.' : status === 'queued' || status === 'sending' ? 'You can close this panel. TechSync will keep processing the message.' : 'Check the connection and recipient before starting another email.'}</p><a href="https://mail.google.com/mail/u/0/#sent" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium underline">Open Gmail Sent</a></Notice> : <>
        <label className="block text-sm font-medium">To<Select aria-label="To" value={to} disabled={locked} onChange={(e) => setTo(e.target.value)}>{record.emails.map((email) => <option key={email.value} value={email.value}>{email.value}</option>)}</Select></label>
        {ready && <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3"><label className="block text-xs font-semibold text-violet-900">Start with a template<Select aria-label="Email template" value={selectedTemplate} disabled={locked || templates.isPending} onChange={(e) => { setSelectedTemplate(e.target.value); const template = templates.data?.find((t) => t.id === e.target.value); if (template) { setSubject(template.subject); setBody(template.bodyHtml); setSeed((s) => ({ html: template.bodyHtml, version: s.version + 1 })) } }}><option value="">{templates.isPending ? 'Loading templates…' : 'Write your own or choose a template'}</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}{template.shared ? ' · Team' : ''}</option>)}</Select></label>{templates.isError ? <p className="mt-2 text-xs text-red-700">Templates couldn’t load. <button type="button" className="font-medium underline" onClick={() => templates.refetch()}>Retry templates</button></p> : <p className="mt-2 text-xs text-violet-800">{selectedTemplate ? 'Personalize the draft below before sending. Selecting another template replaces this draft.' : 'A template fills the subject and message. You can edit both.'}</p>}</div>}
        <label className="block text-sm font-medium">Subject<Input aria-label="Subject" placeholder="A clear subject makes a good first impression" value={subject} disabled={locked} maxLength={998} onChange={(e) => setSubject(e.target.value)} /></label>
        <div><p className="mb-2 text-sm font-medium">Message</p><RichEmailEditor key={seed.version} initialHtml={seed.html} onChange={setBody} disabled={locked} /></div>
        {account?.signatureHtml && <div className="signature-preview text-sm"><p className="mb-2 text-xs font-medium text-muted">Your signature · added automatically</p><div className="email-body" dangerouslySetInnerHTML={{ __html: account.signatureHtml }} /></div>}
        {missing.length > 0 && <Notice tone="warning" title="Complete the missing details">Fill or remove these merge fields before sending: {missing.join(', ')}.</Notice>}
        {(/\{\{/.test(subject) || /\{\{/.test(bodyHtml)) && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm"><p className="mb-2 text-xs font-semibold text-sky-800">Personalized preview</p><p className="font-medium">{mergedSubject.value}</p><div className="email-body mt-2" dangerouslySetInnerHTML={{ __html: mergedBody.value }} /></div>}
        {ready && <fieldset disabled={locked} className="space-y-2"><legend className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium"><span className="inline-flex items-center gap-2"><Paperclip className="size-4 text-muted" aria-hidden="true" />CRM attachments</span><StatusChip tone={attachmentIds.length ? 'violet' : 'neutral'}>{attachmentIds.length}/3 files · {formatEmailBytes(totalBytes)}/10 MB</StatusChip></legend>{files.isPending && <p className="text-xs text-muted">Loading available files…</p>}{availableFiles.map((file) => <label key={file.id} className="email-attachment-option"><input type="checkbox" checked={attachmentIds.includes(file.id)} disabled={!attachmentIds.includes(file.id) && (attachmentIds.length >= 3 || file.size + totalBytes > 10 * 1024 ** 2)} onChange={(e) => setAttachmentIds((ids) => e.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id))} /><Paperclip className="size-3.5 shrink-0 text-muted" aria-hidden="true" /><span className="min-w-0 flex-1 break-all">{file.name}</span><span className="shrink-0 text-muted">{formatEmailBytes(file.size)}</span></label>)}{files.isSuccess && !availableFiles.length && <p className="rounded-lg bg-surface-subtle p-3 text-xs text-muted">No files are ready to attach to this email.</p>}{files.isError && <Notice tone="warning" title="Attachments couldn’t load" actions={<Button variant="secondary" size="sm" onClick={() => files.refetch()}>Retry attachments</Button>}>You can still send without attachments.</Notice>}<p className="text-xs leading-5 text-muted">Upload files in the record’s Attachments section first. Choose up to 3 files, with a combined size of 10 MB.</p></fieldset>}
      </>}
      {error && <Notice tone="danger" title={locked ? 'We couldn’t confirm your request' : 'Email could not be sent'}>{error}{locked && <p className="mt-2">Your draft is locked to prevent a duplicate email. Use “Check / retry same request” to safely check it.</p>}</Notice>}
    </div>
  </Dialog>
}
