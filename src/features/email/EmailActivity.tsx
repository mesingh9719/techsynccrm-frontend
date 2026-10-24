import { useId, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ExternalLink, Mail, Paperclip, Reply } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Notice } from '../../components/ui/Signal'
import { Skeleton } from '../../components/app/States'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { emailKey, emailMessages, type EmailDraft, type EmailRecord } from './api'
import { DeliveryBadge } from './DeliveryBadge'
import { EmailComposer } from './EmailComposer'
import { formatEmailBytes } from './presentation'
import './email.css'

export function EmailActivity({ threadId, entityType, entityId, canReply = true }: { threadId: string; entityType: string; entityId: string; canReply?: boolean }) {
  const orgId = useOrgId(), { user } = useAuth(), canSend = useCan('email.send'), id = useId()
  const [open, setOpen] = useState(false), [reply, setReply] = useState<{ record: EmailRecord; draft: EmailDraft } | null>(null)
  const query = useInfiniteQuery({ queryKey: [...emailKey(orgId), 'thread', user?.id, threadId], queryFn: ({ pageParam }) => emailMessages(threadId, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: open, refetchInterval: open ? 30000 : false })
  return <div className="email-conversation">
    <button type="button" className="email-conversation-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}><span className="inline-flex items-center gap-2"><Mail className="size-3.5" aria-hidden="true" />{open ? 'Hide email conversation' : 'View email conversation'}</span><ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
    {open && <div id={id} className="email-conversation-messages">
      {query.isPending && <div aria-label="Loading conversation"><Skeleton className="h-32 rounded-xl" /></div>}
      {query.isError && <Notice tone="danger" title="Couldn’t load this conversation" actions={<Button size="sm" variant="secondary" onClick={() => query.refetch()}>Try again</Button>}>Your emails are safe. Check your connection and try again.</Notice>}
      {query.isSuccess && query.data.pages.every((page) => !page.items.length) && <Notice title="No messages to display">This conversation may have been removed or reached its retention limit.</Notice>}
      {query.data?.pages.flatMap((page) => page.items).map((message) => {
        const content = message.content, inbound = message.direction === 'inbound', Icon = inbound ? ArrowDownLeft : ArrowUpRight
        return <article key={message.id} className="email-message">
          <header className="email-message-header"><span className="mail-direction" data-inbound={inbound}><Icon className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="break-words text-sm font-semibold text-ink">{content?.subject || 'Email content removed'}</p><DeliveryBadge status={message.status} /></div><p className="mt-1 break-all text-[11px] leading-5 text-muted">{content ? `${content.from} → ${content.to.join(', ')}` : inbound ? 'Incoming email' : 'Outgoing email'}</p><time className="mt-1 block text-[10px] text-muted" dateTime={message.occurredAt}>{new Date(message.occurredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div></header>
          {content ? <><div className="email-message-content">{content.html ? <div className="email-body break-words" dangerouslySetInnerHTML={{ __html: content.html }} /> : <p className="whitespace-pre-wrap break-words">{content.text}</p>}{content.attachments?.length > 0 && <div className="mt-5 space-y-2 border-t border-line pt-3">{content.attachments.map((file, index) => <p key={`${file.name}:${index}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3 py-2 text-xs text-muted"><Paperclip className="size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0">{formatEmailBytes(file.size)}</span></p>)}<p className="text-[11px] text-muted">Incoming attachments stay in Gmail.</p></div>}</div>
          <footer className="email-message-footer"><a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-brand-700">Open Gmail<ExternalLink className="size-3" aria-hidden="true" /></a>{canSend && canReply && (entityType === 'lead' || entityType === 'contact') && <Button variant="secondary" size="sm" onClick={() => {
            const to = inbound ? content.from : content.to[0]
            if (!to) return
            setReply({ record: { entityType, entityId, name: to, emails: [{ value: to }] }, draft: { to, subject: /^re:/i.test(content.subject) ? content.subject : `Re: ${content.subject}`, replyToMessageId: message.id } })
          }}><Reply className="size-3.5" aria-hidden="true" />Reply with Gmail</Button>}</footer></> : <div className="p-4"><Notice title="This message’s content is no longer available">It was deleted or reached the retention limit.</Notice></div>}
        </article>
      })}
      {query.hasNextPage && <Button size="sm" variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load older emails</Button>}
    </div>}
    {reply && <EmailComposer record={reply.record} draft={reply.draft} onClose={() => setReply(null)} />}
  </div>
}
