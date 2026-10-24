import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Inbox, Mail, Plus, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { emailKey, emailThreads, type EmailDraft, type EmailRecord } from './api'
import { ConnectionBadge } from './ConnectionBadge'
import { DeliveryBadge } from './DeliveryBadge'
import { EmailActivity } from './EmailActivity'
import { emailDate, mailboxStatus } from './presentation'
import { useGmail } from './useGmail'
import './email.css'

export function RecordEmailPanel({ record, enabled, onCompose, blockedReason }: { record: EmailRecord; enabled: boolean; onCompose: (draft: EmailDraft) => void; blockedReason?: string }) {
  const orgId = useOrgId(), { user } = useAuth(), canSend = useCan('email.send'), gmail = useGmail()
  const query = useInfiniteQuery({ queryKey: [...emailKey(orgId), 'threads', user?.id, record.entityType, record.entityId], queryFn: ({ pageParam }) => emailThreads(record.entityType, record.entityId, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined, enabled, refetchInterval: enabled ? 30000 : false })
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [], state = gmail.data, connected = mailboxStatus(state?.account?.status) === 'CONNECTED'
  const mayCompose = canSend && record.emails.length > 0 && !blockedReason && state?.tenantEnabled !== false
  return <section className="email-card record-email-panel space-y-5" aria-label="Lead email conversations">
    <header className="record-email-heading"><div className="flex items-center gap-3"><span className="email-icon-tile"><Mail className="size-4" aria-hidden="true" /></span><div><h2 className="text-sm font-semibold text-ink">Email conversations</h2><p className="mt-1 text-xs text-muted">Follow every message, from first hello to follow-up.</p></div></div><div className="flex items-center gap-1"><button type="button" className="icon-button" aria-label="Refresh emails" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" /></button>{mayCompose && <Button size="sm" onClick={() => onCompose({})}><Plus className="size-4" aria-hidden="true" />New email</Button>}</div></header>
    {canSend && state && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-2.5"><div className="flex min-w-0 items-center gap-2 text-xs text-muted"><Mail className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{connected ? state.account?.email : 'Your work mailbox'}</span></div><ConnectionBadge status={mailboxStatus(state.account?.status)} /></div>}
    {blockedReason ? <Notice tone="warning" title="Sending is unavailable for this lead">{blockedReason}</Notice> : state?.tenantEnabled === false ? <Notice tone="warning" title="Email connections are paused">Your administrator has turned off email connections for this workspace.</Notice> : canSend && !record.emails.length ? <Notice title="Add an email address first">Add this lead’s email address in Details to start a conversation.</Notice> : canSend && state && !connected ? <Notice title="Connect your work Gmail" actions={<Button size="sm" variant="secondary" to="/app/settings/gmail">Open Email settings<ArrowUpRight className="size-3.5" aria-hidden="true" /></Button>}>Send from your own address. Existing conversations remain available below.</Notice> : null}
    {query.isPending && !enabled ? <p className="text-sm text-muted">Email history is unavailable for this record.</p> : query.isPending ? <div className="space-y-3" aria-label="Loading emails"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState icon={Inbox} title="Your next conversation starts here" description="Emails linked to this lead will appear here, with replies and delivery status in one place." action={mayCompose ? <Button size="sm" variant="secondary" onClick={() => onCompose({})}><Mail className="size-4" aria-hidden="true" />Write your first email</Button> : undefined} /> : <div className="space-y-3">{rows.map((thread) => {
      const content = thread.latest?.content, inbound = thread.latest?.direction === 'inbound', Icon = inbound ? ArrowDownLeft : ArrowUpRight
      return <article key={thread.id} className="mail-thread-card"><div className="mail-thread-summary"><div className="flex items-start gap-3"><span className="mail-direction" data-inbound={inbound}><Icon className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2"><h3 className="min-w-0 break-words text-sm font-semibold text-ink">{content?.subject || (content ? 'No subject' : 'Email content unavailable')}</h3><time className="shrink-0 text-[11px] text-muted" dateTime={thread.lastMessageAt}>{emailDate(thread.lastMessageAt)}</time></div><p className="mt-1 truncate text-xs text-muted">{content ? inbound ? `From ${content.from}` : `To ${content.to.join(', ')}` : 'Content was removed or reached its retention limit.'}</p>{content?.text && <p className="mt-3 line-clamp-2 whitespace-pre-line text-xs leading-6 text-muted">{content.text}</p>}<div className="mt-3 flex flex-wrap gap-2">{thread.latest && <DeliveryBadge status={thread.latest.status} />}<StatusChip tone="neutral" icon={Mail}>{thread.count} {thread.count === 1 ? 'message' : 'messages'}</StatusChip></div></div></div></div><EmailActivity threadId={thread.id} entityType={record.entityType} entityId={record.entityId} canReply={!blockedReason && state?.tenantEnabled !== false} /></article>
    })}</div>}
    {query.hasNextPage && <Button variant="secondary" size="sm" className="w-full" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load older conversations</Button>}
  </section>
}
