import { useFloatingPanel } from '../../components/app/useFloatingPanel'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Mail, MapPin, MessageCircle, MoreHorizontal, NotebookPen, Pencil, Phone, Pin, PinOff, Sparkles, Trash2, Users } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan } from '../../lib/useOrg'
import { useAuth } from '../../lib/useAuth'
import { ApiError } from '../../services/http'
import { memberOptions } from '../../services/team'
import { Avatar } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Menu, MenuItem } from '../../components/app/Menu'
import { ErrorState, LoadMore, Skeleton } from '../../components/app/States'
import { relativeTime } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import type { Activity, ActivityType, CallOutcome, RecordType } from '../crm/types'
import { TaskFormDialog } from '../tasks/TaskFormDialog'
import { deleteActivity, getTimeline, logActivity, outcomeLabels, pinActivity, updateActivity } from './api'
import { EmailActivity } from '../email/EmailActivity'
import { Markdown } from './Markdown'

type Composer = 'note' | 'call' | 'meeting' | 'site_visit' | 'whatsapp' | 'email' | 'sms' | 'task'

const FILTERS: { key: string; label: string; types?: ActivityType[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'notes', label: 'Notes', types: ['note'] },
  { key: 'calls', label: 'Calls', types: ['call'] },
  { key: 'meetings', label: 'Meetings & visits', types: ['meeting', 'site_visit'] },
  { key: 'messages', label: 'Messages', types: ['whatsapp', 'email', 'sms'] },
  { key: 'system', label: 'Updates', types: ['system'] },
]

const ICONS: Record<ActivityType, typeof Phone> = {
  note: NotebookPen,
  call: Phone,
  meeting: Users,
  site_visit: MapPin,
  whatsapp: MessageCircle,
  email: Mail,
  sms: MessageCircle,
  system: Sparkles,
}

const typeLabel: Record<ActivityType, string> = { note: 'Note', call: 'Call', meeting: 'Meeting', site_visit: 'Site visit', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', system: 'Update' }

const pad = (n: number) => String(n).padStart(2, '0')
const localNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Textarea with @mention autocomplete: typing "@ra" offers members; picking inserts @[Name](id). */
function MentionTextarea({ value, onChange, placeholder, id, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string; rows?: number }) {
  const orgId = useOrgId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const members = useQuery({ queryKey: qk.org(orgId).memberOptions(query ?? ''), queryFn: () => memberOptions(query || undefined), enabled: query !== null })
  const items = (members.data ?? []).slice(0, 6)
  const listId = useId()
  const panel = useFloatingPanel<HTMLUListElement>(query !== null && items.length > 0, ref)

  function detect(text: string, caret: number) {
    const m = /(^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(text.slice(0, caret))
    setQuery(m ? m[2] : null)
    setActive(0)
  }

  function insert(member: { userId: string; fullName: string }) {
    const el = ref.current!
    const caret = el.selectionStart
    const before = value.slice(0, caret).replace(/@([\p{L}\p{N}._-]{0,30})$/u, '')
    const token = `@[${member.fullName}](${member.userId}) `
    const next = before + token + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(before.length + token.length, before.length + token.length)
    })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (query === null || !items.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insert(items[active])
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQuery(null) }
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          detect(e.target.value, e.target.selectionStart)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        maxLength={10_000}
        aria-label={id ? undefined : 'Note'}
        aria-controls={query !== null ? listId : undefined}
        aria-activedescendant={query !== null && items[active] ? `${listId}-${items[active].userId}` : undefined}
        aria-autocomplete="list"
      />
      {query !== null && items.length > 0 && (
        <ul ref={panel} popover="manual" id={listId} role="listbox" aria-label="Mention a teammate" className="crm-popover menu-surface">
          {items.map((m, i) => (
            <li key={m.userId} id={`${listId}-${m.userId}`} role="option" aria-selected={i === active} onPointerDown={(e) => e.preventDefault()} onClick={() => insert(m)} className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm', i === active && 'bg-surface-subtle')}>
              <Avatar name={m.fullName} size="xs" />
              <span className="truncate">{m.fullName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ComposerForm({ kind, entityType, entityId, onDone, initialBody = '' }: { kind: Exclude<Composer, 'task'>; entityType: RecordType; entityId: string; onDone: (activity: Activity, followUp: boolean) => void; initialBody?: string }) {
  const [body, setBody] = useState(initialBody)
  const [subject, setSubject] = useState('')
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound')
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [minutes, setMinutes] = useState('')
  const [when, setWhen] = useState(localNow())
  const [location, setLocation] = useState('')
  const [followUp, setFollowUp] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guard = useUnsavedChanges({ body, subject, minutes, location }, () => {}, busy)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const activity = await logActivity({
        type: kind,
        entityType,
        entityId,
        body: body.trim() || null,
        ...(kind !== 'note' && { occurredAt: new Date(when).toISOString() }),
        ...(['call', 'whatsapp', 'email', 'sms'].includes(kind) && { direction }),
        ...(kind === 'call' && { outcome, durationSeconds: minutes ? Math.round(Number(minutes) * 60) : null }),
        ...((kind === 'meeting' || kind === 'site_visit') && { subject: subject.trim() || null, location: location.trim() ? { text: location.trim() } : null }),
      })
      setBody('')
      setSubject('')
      setMinutes('')
      setLocation('')
      setWhen(localNow())
      guard.markSaved({ body: '', subject: '', minutes: '', location: '' })
      onDone(activity, kind === 'call' && outcome === 'callback_requested' && followUp)
    } catch (err) {
      if (!handleGlobalApiError(err)) setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {guard.confirmation}
      {kind === 'call' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Select aria-label="Direction" value={direction} onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound')} className="h-10! text-sm">
            <option value="outbound">I called them</option>
            <option value="inbound">They called</option>
          </Select>
          <Select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)} className="h-10! text-sm">
            {Object.entries(outcomeLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Input aria-label="Duration in minutes" type="number" min={0} placeholder="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-10! text-sm" />
        </div>
      )}
      {['whatsapp', 'email', 'sms'].includes(kind) && (
        <Select aria-label="Message direction" value={direction} onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound')}>
          <option value="outbound">I sent it</option>
          <option value="inbound">They sent it</option>
        </Select>
      )}
      {(kind === 'meeting' || kind === 'site_visit') && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label="Subject" placeholder={kind === 'meeting' ? 'Meeting about…' : 'Visit purpose'} value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10! text-sm" />
          <Input aria-label="Location" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="h-10! text-sm" />
        </div>
      )}
      {kind === 'note' ? (
        <MentionTextarea value={body} onChange={setBody} placeholder="Write a note… Use @ to mention a teammate, **bold**, - lists" />
      ) : (
        <Textarea aria-label="Notes" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened? What was agreed?" maxLength={10_000} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {kind !== 'note' && <Input aria-label="When" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-10! w-auto text-sm" />}
          {kind === 'call' && outcome === 'callback_requested' && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="size-4 rounded border-line text-brand-700" />
              Create a follow-up task
            </label>
          )}
        </div>
        <Button size="sm" onClick={submit} loading={busy} disabled={kind === 'note' && !body.trim()}>
          {kind === 'note' ? 'Add note' : 'Log it'}
        </Button>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  )
}

function ActivityEntry({ activity, canPin, onChanged, entityType, entityId }: { activity: Activity; canPin: boolean; onChanged: () => void; entityType: string; entityId: string }) {
  const { user } = useAuth()
  const canLog = useCan('tasks.create')
  const canManage = useCan('settings.workspace.manage')
  const notify = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(activity.body ?? '')
  const Icon = ICONS[activity.type]
  const system = activity.type === 'system'
  const isAuthor = Boolean(user?.id) && activity.actorId === user?.id
  const isMine = canLog && isAuthor && activity.canEditNow
  const canDelete = activity.meta?.provider !== 'gmail' && canLog && (isAuthor || canManage)

  async function run(fn: () => Promise<unknown>, title?: string) {
    try {
      await fn()
      onChanged()
      if (title) notify({ title })
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t update', description: err instanceof ApiError ? err.message : undefined })
    }
  }

  const meta = [
    activity.type === 'call' && activity.direction && (activity.direction === 'outbound' ? 'Outgoing' : 'Incoming'),
    activity.outcome && outcomeLabels[activity.outcome],
    activity.durationSeconds ? `${Math.round(activity.durationSeconds / 60)} min` : null,
    activity.location?.text,
  ].filter(Boolean)

  return (
    <li className="relative flex gap-3 pb-5 pl-1">
      <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface', system ? 'bg-surface-subtle text-muted' : activity.type === 'note' ? 'bg-amber-50 text-amber-700  ' : 'bg-brand-50 text-brand-700  ')}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className={cn('min-w-0 flex-1', !system && 'rounded-xl bg-surface p-3 ring-1 ring-line text-ink', activity.isPinned && 'ring-amber-300 ')}>
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', system ? 'text-muted' : 'text-ink')}>
            {system ? (
              <>
                {activity.subject}
                {activity.actor && <span className="text-muted"> · {activity.actor.fullName}</span>}
              </>
            ) : (
              <>
                <span className="font-medium">{activity.actor?.fullName ?? 'Someone'}</span>
                <span className="text-muted"> · {typeLabel[activity.type]}</span>
                {activity.subject && <span className="text-ink"> — {activity.subject}</span>}
              </>
            )}
            {activity.isPinned && <Pin className="ml-2 inline size-3 text-warning" aria-label="Pinned" />}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <time dateTime={activity.occurredAt} title={new Date(activity.occurredAt).toLocaleString('en-IN')} className="text-xs text-muted">
              {relativeTime(activity.occurredAt)}
            </time>
            {!system && (canPin || isMine || canDelete) && (
              <Menu
                align="end"
                trigger={(props) => (
                  <button {...props} type="button" className="rounded p-1 text-muted hover:bg-surface-subtle hover:text-ink" aria-label="Entry actions">
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    {canPin && (
                      <MenuItem
                        icon={activity.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                        onSelect={() => {
                          close()
                          void run(() => pinActivity(activity.id, !activity.isPinned))
                        }}
                      >
                        {activity.isPinned ? 'Unpin' : 'Pin to top'}
                      </MenuItem>
                    )}
                    {isMine && (
                      <MenuItem
                        icon={<Pencil className="size-4" />}
                        onSelect={() => {
                          close()
                          setEditing(true)
                        }}
                      >
                        Edit
                      </MenuItem>
                    )}
                    {canDelete && <MenuItem
                      tone="danger"
                      icon={<Trash2 className="size-4" />}
                      onSelect={() => {
                        close()
                        void run(() => deleteActivity(activity.id), 'Deleted')
                      }}
                    >
                      Delete
                    </MenuItem>}
                  </>
                )}
              </Menu>
            )}
          </div>
        </div>
        {meta.length > 0 && <p className="mt-1 text-xs text-muted">{meta.join(' · ')}</p>}
        {editing ? (
          <div className="mt-2 space-y-2">
            <MentionTextarea value={text} onChange={setText} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  run(async () => {
                    await updateActivity(activity.id, { body: text })
                    setEditing(false)
                  }, 'Saved')
                }
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          activity.body && <Markdown text={activity.body} className="mt-2 space-y-1 text-sm text-ink" />
        )}
        {activity.meta?.provider === 'gmail' && typeof activity.meta.threadId === 'string' && <EmailActivity threadId={activity.meta.threadId} entityType={entityType} entityId={entityId} />}
        {activity.editedAt && !editing && <p className="mt-1 text-xs text-muted">Edited</p>}
      </div>
    </li>
  )
}

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(d)
}

/**
 * Timeline for a lead, contact, company or deal: composer (note, call, meeting, site visit, task),
 * filters, pinned entries on top, newest first grouped by day, system updates in a muted style.
 */
export type TimelineDraft = { kind: Exclude<Composer, 'task'>; body?: string; nonce: number }

export function Timeline({ entityType, entityId, recordName, canPin = false, notesOnly = false, draft, actions }: {
  notesOnly?: boolean; entityType: RecordType; entityId: string; recordName?: string; canPin?: boolean
  /** Extra controls in the card header (e.g. note templates). */
  actions?: ReactNode
  /** Switch the composer to a kind and optionally prefill it (e.g. from a template); bump `nonce` to re-apply. */
  draft?: TimelineDraft | null
}) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const canLog = useCan('tasks.create')
  const [composer, setComposer] = useState<Composer>(draft?.kind ?? 'note')
  const [appliedDraft, setAppliedDraft] = useState(draft?.nonce)
  // Prefilled text per composer kind; a form remounts only when it receives a new prefill.
  const [seeds, setSeeds] = useState<Partial<Record<Composer, { nonce: number; body: string }>>>(() =>
    draft?.body !== undefined ? { [draft.kind]: { nonce: draft.nonce, body: draft.body } } : {},
  )
  if (draft && draft.nonce !== appliedDraft) {
    setAppliedDraft(draft.nonce)
    setComposer(draft.kind)
    if (draft.body !== undefined) setSeeds((s) => ({ ...s, [draft.kind]: { nonce: draft.nonce, body: draft.body! } }))
  }
  const [filter, setFilter] = useState(notesOnly ? 'notes' : 'all')
  const [taskDefaults, setTaskDefaults] = useState<{ title: string; type: 'call' } | null>(null)
  const [taskOpen, setTaskOpen] = useState(false)
  const types = FILTERS.find((f) => f.key === filter)?.types
  const key = [...qk.org(orgId).timeline(entityType, entityId), filter]
  const timeline = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => getTimeline({ entityType, entityId, types: types?.join(','), cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: entityType === 'lead' || entityType === 'contact' ? 60000 : false,
  })
  const pinned = timeline.data?.pages[0]?.pinned ?? []
  const items = useMemo(() => timeline.data?.pages.flatMap((p) => p.items) ?? [], [timeline.data])
  const pinnedIds = new Set(pinned.map((a) => a.id))
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk.org(orgId).timeline(entityType, entityId) })
    // Logging touches last activity, lead status and score on the record pages.
    void queryClient.invalidateQueries({ queryKey: [...qk.org(orgId).all, `${entityType === 'company' ? 'companies' : `${entityType}s`}`] })
  }

  const groups: { label: string; items: Activity[] }[] = []
  for (const a of items) {
    if (pinnedIds.has(a.id)) continue
    const label = dayLabel(a.occurredAt)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1)!.items.push(a)
  }

  const tabs: { key: Composer; label: string; icon: typeof Phone }[] = [
    { key: 'note', label: 'Note', icon: NotebookPen },
    { key: 'call', label: 'Log call', icon: Phone },
    { key: 'meeting', label: 'Meeting', icon: Users },
    { key: 'site_visit', label: 'Site visit', icon: MapPin },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { key: 'email', label: 'Log email', icon: Mail },
    { key: 'sms', label: 'SMS', icon: MessageCircle },
    { key: 'task', label: 'Task', icon: CalendarClock },
  ]

  return (
    <section className="rounded-card bg-surface p-5 shadow-card ring-1 ring-line text-ink" aria-label="Timeline">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{notesOnly ? 'Notes' : 'Activity timeline'}</h2>
        {actions}
      </div>
      {canLog && (
        <div className="mt-4 rounded-xl bg-surface-subtle p-3 ring-1 ring-line">
          <div role="group" aria-label="Add to timeline" className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
            {tabs.filter((item) => !notesOnly || item.key === 'note').map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={composer === t.key}
                onClick={() => (t.key === 'task' ? setTaskOpen(true) : setComposer(t.key))}
                className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors', composer === t.key && t.key !== 'task' ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-muted hover:text-ink')}
              >
                <t.icon className="size-4" aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
          {tabs.filter((item): item is typeof item & { key: Exclude<Composer, 'task'> } => item.key !== 'task' && (!notesOnly || item.key === 'note')).map((item) => (
            <div key={item.key} data-composer={item.key} hidden={composer !== item.key}>
            <ComposerForm
              key={seeds[item.key]?.nonce ?? 'base'}
              initialBody={seeds[item.key]?.body}
              kind={item.key}
              entityType={entityType}
              entityId={entityId}
              onDone={(_a, followUp) => {
                refresh()
                if (followUp) {
                  setTaskDefaults({ title: `Call back ${recordName ?? ''}`.trim(), type: 'call' })
                  setTaskOpen(true)
                }
              }}
            />
            </div>
          ))}
        </div>
      )}

      <div className="no-scrollbar -mx-1 mt-4 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filter timeline">
        {FILTERS.filter((item) => !notesOnly || item.key === 'notes').map((f) => (
          <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={cn('h-8 shrink-0 rounded-md px-3 text-xs font-medium transition-colors', filter === f.key ? 'bg-ink text-surface' : 'text-muted hover:bg-surface-subtle hover:text-ink')}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {timeline.isPending ? (
          <Skeleton className="h-32" />
        ) : timeline.isError ? (
          <ErrorState error={timeline.error} onRetry={() => timeline.refetch()} />
        ) : !items.length && !pinned.length ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nothing here yet. Log a call or add a note to start the history.</p>
        ) : (
          <>
            {pinned.length > 0 && (
              <ul className="mb-2 space-y-0">
                {pinned.map((a) => (
                  <ActivityEntry key={`p${a.id}`} activity={a} canPin={canPin} onChanged={refresh} entityType={entityType} entityId={entityId} />
                ))}
              </ul>
            )}
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-2 text-xs font-medium text-muted">{g.label}</p>
                <ul className="relative before:absolute before:top-2 before:bottom-4 before:left-[17px] before:w-px before:bg-line">
                  {g.items.map((a) => (
                    <ActivityEntry key={a.id} activity={a} canPin={canPin} onChanged={refresh} entityType={entityType} entityId={entityId} />
                  ))}
                </ul>
              </div>
            ))}
            <LoadMore hasMore={Boolean(timeline.hasNextPage)} loading={timeline.isFetchingNextPage} onLoadMore={() => timeline.fetchNextPage()} />
          </>
        )}
      </div>
      {taskOpen && (
        <TaskFormDialog
          record={{ entityType, entityId, name: recordName }}
          defaults={taskDefaults ?? undefined}
          onClose={() => {
            setTaskOpen(false)
            setTaskDefaults(null)
          }}
        />
      )}
    </section>
  )
}

