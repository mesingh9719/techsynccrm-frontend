import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { emailKey, emailMessages, type EmailDraft, type EmailRecord } from './api'
import { emailStatusLabel } from './content'
import { EmailComposer } from './EmailComposer'

export function EmailActivity({ threadId, entityType, entityId }: { threadId: string; entityType: string; entityId: string }) {
  const orgId = useOrgId(), canSend = useCan('email.send')
  const [open, setOpen] = useState(false), [reply, setReply] = useState<{ record: EmailRecord; draft: EmailDraft } | null>(null)
  const query = useInfiniteQuery({ queryKey: [...emailKey(orgId), 'thread', threadId], queryFn: ({ pageParam }) => emailMessages(threadId, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: open, refetchInterval: open ? 30000 : false })
  return <div className="mt-2 space-y-3">
    <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide email conversation' : 'View email conversation'}</Button>
    {open && <div className="space-y-4">
      {query.isPending && <p className="text-sm text-muted">Loading conversation…</p>}
      {query.isError && <p role="alert" className="text-sm text-danger">Couldn’t load email. <button type="button" className="underline" onClick={() => query.refetch()}>Try again</button></p>}
      {query.data?.pages.flatMap((page) => page.items).map((message) => {
        const content = message.content
        return <article key={message.id} className="space-y-2 rounded-lg border border-line p-3 text-sm">
          <p className="font-medium">{content?.subject ?? 'Email content removed'}</p>
          <p className="text-xs text-muted">{emailStatusLabel[message.status] ?? message.status} · {new Date(message.occurredAt).toLocaleString('en-IN')}</p>
          {content ? <><p className="break-all text-xs text-muted">{content.from} → {content.to.join(', ')}</p><div className="email-body break-words" dangerouslySetInnerHTML={{ __html: content.html }} />{content.attachments?.map((file, i) => <p key={i} className="text-xs text-muted">Attachment: {file.name} · {Math.ceil(file.size / 1024)} KB · open in Gmail</p>)}
          {canSend && (entityType === 'lead' || entityType === 'contact') && <Button variant="secondary" size="sm" onClick={() => {
            const to = message.direction === 'inbound' ? content.from : content.to[0]
            setReply({ record: { entityType, entityId, name: to, emails: [{ value: to }] }, draft: { to, subject: /^re:/i.test(content.subject) ? content.subject : `Re: ${content.subject}`, replyToMessageId: message.id } })
          }}>Reply with Gmail</Button>}</> : <p className="text-xs text-muted">Content was deleted or reached the retention limit.</p>}
        </article>
      })}
      {query.hasNextPage && <Button size="sm" variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load older emails</Button>}
    </div>}
    {reply && <EmailComposer record={reply.record} draft={reply.draft} onClose={() => setReply(null)} />}
  </div>
}
