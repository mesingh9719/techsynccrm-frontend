import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, AtSign, Bell, BellRing, Check, CheckCheck, ChevronRight, CircleAlert, Clock3, Download, FileCheck2, RefreshCw, Settings2, Trophy, UserRound, Users, X } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { Menu } from '../../components/app/Menu'
import { EmptyState, ErrorState, LoadMore, PageHeader, Skeleton } from '../../components/app/States'
import { relativeTime } from '../crm/format'
import { listNotifications, notificationKeys, readAllNotifications, readNotification, type Notification } from './api'
import { useNotificationCount } from './useNotificationStream'

function useInboxActions() {
  const { user } = useAuth()
  const keys = notificationKeys(user?.organization?.id ?? 'none', user?.id ?? 'none')
  const client = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  async function run(action: () => Promise<unknown>, url?: string, onDone?: () => void) {
    setBusy(true)
    try {
      await action()
      await client.invalidateQueries({ queryKey: keys.all })
      onDone?.()
      if (url) navigate(url.startsWith('/app') && !url.startsWith('//') ? url : '/app/notifications')
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t update notifications', description: err instanceof ApiError ? err.message : undefined })
    } finally { setBusy(false) }
  }
  return { keys, busy, run, go: navigate }
}

function notificationAppearance(type: string) {
  if (type === 'import_finished' || type === 'export_finished') return { icon: type === 'import_finished' ? FileCheck2 : Download, label: type === 'import_finished' ? 'Import' : 'Export', tone: 'success' }
  if (type.startsWith('lead_') || type === 'new_unassigned_lead') return { icon: UserRound, label: 'Lead activity', tone: 'brand' }
  if (type === 'mention') return { icon: AtSign, label: 'Mention', tone: 'brand' }
  if (type.startsWith('task_') || type === 'trial_ending' || type === 'deal_rotting') return { icon: Clock3, label: type === 'trial_ending' ? 'Workspace' : type === 'deal_rotting' ? 'Deal activity' : 'Task', tone: 'warning' }
  if (type === 'deal_won') return { icon: Trophy, label: 'Deal won', tone: 'success' }
  if (type === 'member_joined') return { icon: Users, label: 'Team', tone: 'brand' }
  return { icon: Bell, label: type === 'deal_assigned' ? 'Deal activity' : 'Workspace', tone: 'neutral' }
}

function NotificationRows({ items, busy, onOpen, compact = false }: { items: Notification[]; busy: boolean; onOpen: (item: Notification) => void; compact?: boolean }) {
  const { user } = useAuth()
  const { organization } = useOrg()
  const tz = user?.timezone || organization?.timezone || 'Asia/Kolkata'
  const [openedAt] = useState(() => new Date())
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = date.format(openedAt)
  const groups = [
    { title: 'Today', items: items.filter((i) => date.format(new Date(i.createdAt)) === today) },
    { title: 'Earlier', items: items.filter((i) => date.format(new Date(i.createdAt)) !== today) },
  ].filter((g) => g.items.length)
  return <>{groups.map((group) => <div key={group.title} role={compact ? 'group' : undefined} aria-label={group.title}>
    <p className="notification-group-label">{group.title}</p>
    <ul className="notification-list" role={compact ? 'none' : undefined}>
      {group.items.map((item) => {
        const { icon: Icon, label, tone } = notificationAppearance(item.type)
        const unread = !item.readAt
        return <li key={item.id} role={compact ? 'none' : undefined}>
          <button type="button" role={compact ? 'menuitem' : undefined} disabled={busy} aria-disabled={busy || undefined} tabIndex={compact ? -1 : undefined} onClick={() => onOpen(item)} className={cn('notification-row', unread && 'notification-row-unread')}>
            <span className="notification-type-icon" data-tone={tone}><Icon className="size-[18px]" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm leading-5 text-ink', unread ? 'font-semibold' : 'font-medium')}>{item.title}{item.groupCount > 1 && <span className="notification-group-count">×{item.groupCount}</span>}</span>
              {item.body && <span className="mt-1 block line-clamp-2 break-words text-xs leading-5 text-muted">{item.body}</span>}
              <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4 text-muted"><span>{label}</span><span aria-hidden="true">·</span><time dateTime={item.createdAt} title={new Intl.DateTimeFormat(undefined, { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}>{relativeTime(item.createdAt)}</time></span>
            </span>
            <span className="notification-row-trailing">{unread ? <span className="size-1.5 rounded-full bg-brand-600" aria-label="Unread" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}</span>
          </button>
        </li>
      })}
    </ul>
  </div>)}</>
}

function NotificationPreviewLoading() {
  return <div role="status" className="space-y-1 p-3"><span className="sr-only">Loading notifications</span>{[0, 1, 2].map((item) => <div key={item} className="flex gap-3 rounded-xl p-3"><Skeleton className="size-10 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-4/5" /><Skeleton className="h-3 w-3/5" /><Skeleton className="mt-3 h-2.5 w-1/3" /></div></div>)}</div>
}

export function NotificationBell() {
  const { keys, busy, run, go } = useInboxActions()
  const count = useNotificationCount()
  const n = count.data?.unreadCount ?? 0
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(false)
  const preview = useQuery({ queryKey: [...keys.preview, { unread }], queryFn: () => listNotifications({ limit: 10, unread }), enabled: open, refetchOnWindowFocus: true })
  return <Menu align="end" onOpenChange={setOpen} className="notification-popover" trigger={(props) => <button {...props} type="button" className={cn('icon-button relative', open && 'bg-brand-50 text-brand-700')} aria-label={`Notifications${n ? `, ${n} unread` : ''}`}><Bell className="size-5" aria-hidden="true" />{n > 0 && <span className="notification-bell-count">{n > 99 ? '99+' : n}</span>}</button>}>
    {(close) => <>
      <div className="notification-panel-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BellRing className="size-[19px]" aria-hidden="true" /></span>
          <div className="min-w-0"><p className="text-base font-semibold tracking-tight text-ink">Notifications</p><p className="mt-0.5 text-xs text-muted">{count.isPending ? 'Your workspace activity' : count.isError ? 'Your workspace activity' : n ? `You have ${n} unread ${n === 1 ? 'update' : 'updates'}` : 'You’re all caught up'}</p></div>
        </div>
        <button type="button" role="menuitem" tabIndex={-1} onClick={close} className="notification-icon-action" aria-label="Close notifications"><X className="size-4" aria-hidden="true" /></button>
      </div>
      <div className="notification-toolbar">
        <div role="group" aria-label="Filter notifications" className="notification-filters">
          {[false, true].map((value) => <button key={String(value)} type="button" role="menuitemradio" aria-checked={unread === value} tabIndex={-1} onClick={() => setUnread(value)} className="notification-filter">{value ? 'Unread' : 'All'}{value && n > 0 && <span className="notification-filter-count">{n > 99 ? '99+' : n}</span>}</button>)}
        </div>
        <button type="button" role="menuitem" disabled={busy || !n} aria-disabled={busy || !n || undefined} tabIndex={-1} onClick={() => void run(readAllNotifications)} className="notification-mark-read">{busy ? <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> : <CheckCheck className="size-3.5" aria-hidden="true" />}<span>{busy ? 'Updating…' : 'Mark all read'}</span></button>
      </div>
      <div className="notification-scroll" aria-busy={preview.isFetching || busy}>
        {preview.isPending ? <NotificationPreviewLoading /> : preview.isError ? <div className="notification-feedback" role="alert"><span className="notification-feedback-icon"><CircleAlert className="size-6" aria-hidden="true" /></span><p className="mt-4 text-sm font-semibold text-ink">Couldn’t load notifications</p><p className="mt-1 text-xs leading-5 text-muted">Please try again to see your latest updates.</p><button type="button" role="menuitem" tabIndex={-1} onClick={() => void preview.refetch()} className="notification-retry"><RefreshCw className="size-3.5" aria-hidden="true" />Try again</button></div> : !preview.data.items.length ? <div className="notification-feedback" role="status"><span className="notification-feedback-icon"><Check className="size-6" aria-hidden="true" /></span><p className="mt-4 text-sm font-semibold text-ink">You’re all caught up!</p><p className="mt-1 max-w-56 text-xs leading-5 text-muted">{unread ? 'No unread updates. You’re up to date with your workspace.' : 'New assignments, reminders and workspace updates will appear here.'}</p></div> : <NotificationRows compact items={preview.data.items} busy={busy} onOpen={(item) => void run(() => readNotification(item.id), item.url ?? '/app/notifications', close)} />}
      </div>
      <div className="notification-panel-footer">
        <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); go('/app/notifications') }} className="notification-view-all">View all notifications<ArrowRight className="size-4" aria-hidden="true" /></button>
        <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); go('/app/settings/notifications') }} className="notification-icon-action" aria-label="Notification settings" title="Notification settings"><Settings2 className="size-4" aria-hidden="true" /></button>
      </div>
    </>}
  </Menu>
}

export default function NotificationsPage() {
  useSeo({ title: 'Notifications', noindex: true })
  const { keys, busy, run } = useInboxActions()
  const [unread, setUnread] = useState(false)
  const count = useNotificationCount()
  const list = useInfiniteQuery({ queryKey: keys.list(unread), queryFn: ({ pageParam }) => listNotifications({ unread, cursor: pageParam, limit: 30 }), initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.nextCursor ?? undefined })
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  return <div className="app-page max-w-6xl"><PageHeader title="Notifications" description="Assignments, mentions and reminders for this workspace." actions={<Button variant="secondary" onClick={() => void run(readAllNotifications)} loading={busy} disabled={!count.data?.unreadCount}><CheckCheck className="size-4" />Mark all read</Button>} /><div className="mt-5 flex items-center justify-between"><div role="group" aria-label="Filter notifications" className="flex gap-2">{[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={unread === value} onClick={() => setUnread(value)} className={cn('rounded-lg px-3 py-2 text-sm', unread === value ? 'bg-zinc-900 text-white' : 'text-muted hover:bg-zinc-100')}>{value ? `Unread (${count.data?.unreadCount ?? 0})` : 'All'}</button>)}</div><Link to="/app/settings/notifications" className="text-sm text-brand-700 hover:underline">Preferences</Link></div><div className="mt-4 overflow-hidden rounded-card bg-surface ring-1 ring-line">{list.isPending ? <Skeleton className="m-4 h-40" /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !items.length ? <EmptyState icon={Bell} title="You’re all caught up" description={unread ? 'No unread notifications in this workspace.' : 'Your workspace updates will appear here.'} /> : <NotificationRows items={items} busy={busy} onOpen={(item) => void run(() => readNotification(item.id), item.url ?? '/app/notifications')} />}</div><LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onLoadMore={() => list.fetchNextPage()} /></div>
}
