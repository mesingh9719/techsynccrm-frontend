import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Settings } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { Menu, MenuItem } from '../../components/app/Menu'
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

function NotificationRows({ items, busy, onOpen, compact = false }: { items: Notification[]; busy: boolean; onOpen: (item: Notification) => void; compact?: boolean }) {
  const { user } = useAuth()
  const { organization } = useOrg()
  const tz = user?.timezone || organization?.timezone || 'Asia/Kolkata'
  const [today] = useState(() => new Date())
  const date = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
  const groups = [
    { title: 'Today', items: items.filter((i) => date(new Date(i.createdAt)) === date(today)) },
    { title: 'Earlier', items: items.filter((i) => date(new Date(i.createdAt)) !== date(today)) },
  ].filter((g) => g.items.length)
  return <>{groups.map((group) => <div key={group.title}>
    <p className="px-4 py-2 text-xs font-medium text-zinc-500">{group.title}</p>
    <ul className="divide-y divide-zinc-100" role={compact ? 'none' : undefined}>
      {group.items.map((item) => <li key={item.id} role={compact ? 'none' : undefined}>
        <button type="button" role={compact ? 'menuitem' : undefined} disabled={busy} aria-disabled={busy || undefined} tabIndex={compact ? -1 : undefined} onClick={() => onOpen(item)} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-60', !item.readAt && 'bg-brand-50/40')}>
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-brand-600')} aria-label={item.readAt ? 'Read' : 'Unread'} />
          <span className="min-w-0 flex-1"><span className={cn('block text-sm text-zinc-900', !item.readAt && 'font-medium')}>{item.title}{item.groupCount > 1 && <span className="ml-1 text-xs text-zinc-500">×{item.groupCount}</span>}</span>{item.body && <span className="mt-0.5 block truncate text-xs text-zinc-600">{item.body}</span>}<time dateTime={item.createdAt} className="mt-1 block text-xs text-zinc-400">{relativeTime(item.createdAt)}</time></span>
        </button>
      </li>)}
    </ul>
  </div>)}</>
}

export function NotificationBell() {
  const { keys, busy, run, go } = useInboxActions()
  const count = useNotificationCount()
  const n = count.data?.unreadCount ?? 0
  const [open, setOpen] = useState(false)
  const preview = useQuery({ queryKey: keys.preview, queryFn: () => listNotifications({ limit: 10 }), enabled: open, refetchOnWindowFocus: true })
  return <Menu align="end" onOpenChange={setOpen} className="w-[min(380px,calc(100vw-2rem))]" trigger={(props) => <button {...props} type="button" className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800" aria-label={`Notifications${n ? `, ${n} unread` : ''}`}><Bell className="size-5" aria-hidden="true" />{n > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white">{n > 99 ? '99+' : n}</span>}</button>}>
    {(close) => <><div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2"><p className="text-sm font-semibold">Notifications</p><button type="button" role="menuitem" disabled={busy || !n} aria-disabled={busy || !n || undefined} tabIndex={-1} onClick={() => void run(readAllNotifications)} className="text-xs text-brand-700 disabled:text-zinc-400">Mark all read</button></div><div className="max-h-96 overflow-y-auto">{preview.isPending ? <Skeleton className="m-4 h-24" /> : preview.isError ? <ErrorState error={preview.error} onRetry={() => preview.refetch()} /> : !preview.data.items.length ? <p className="p-6 text-sm text-zinc-500">You’re all caught up.</p> : <NotificationRows compact items={preview.data.items} busy={busy} onOpen={(item) => void run(() => readNotification(item.id), item.url ?? '/app/notifications', close)} />}</div><div className="border-t border-zinc-100"><MenuItem onSelect={() => { close(); go('/app/notifications') }}>View all notifications</MenuItem><MenuItem icon={<Settings className="size-4" />} onSelect={() => { close(); go('/app/settings/notifications') }}>Notification settings</MenuItem></div></>}
  </Menu>
}

export default function NotificationsPage() {
  useSeo({ title: 'Notifications', noindex: true })
  const { keys, busy, run } = useInboxActions()
  const [unread, setUnread] = useState(false)
  const count = useNotificationCount()
  const list = useInfiniteQuery({ queryKey: keys.list(unread), queryFn: ({ pageParam }) => listNotifications({ unread, cursor: pageParam, limit: 30 }), initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.nextCursor ?? undefined })
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><PageHeader title="Notifications" description="Assignments, mentions and reminders for this workspace." actions={<Button variant="secondary" onClick={() => void run(readAllNotifications)} loading={busy} disabled={!count.data?.unreadCount}><CheckCheck className="size-4" />Mark all read</Button>} /><div className="mt-5 flex items-center justify-between"><div role="group" aria-label="Filter notifications" className="flex gap-2">{[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={unread === value} onClick={() => setUnread(value)} className={cn('rounded-lg px-3 py-1.5 text-sm', unread === value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100')}>{value ? `Unread (${count.data?.unreadCount ?? 0})` : 'All'}</button>)}</div><Link to="/app/settings/notifications" className="text-sm text-brand-700 hover:underline">Preferences</Link></div><div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">{list.isPending ? <Skeleton className="m-4 h-40" /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !items.length ? <EmptyState icon={Bell} title="You’re all caught up" description={unread ? 'No unread notifications in this workspace.' : 'Your workspace updates will appear here.'} /> : <NotificationRows items={items} busy={busy} onOpen={(item) => void run(() => readNotification(item.id), item.url ?? '/app/notifications')} />}</div><LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onLoadMore={() => list.fetchNextPage()} /></div>
}
