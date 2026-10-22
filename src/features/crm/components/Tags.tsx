import { useFloatingPanel } from '../../../components/app/useFloatingPanel'
import { Skeleton } from '../../../components/app/States'
import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Tag as TagIcon, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { qk } from '../../../lib/queryKeys'
import { useCan } from '../../../lib/useOrg'
import { ApiError } from '../../../services/http'
import { createTag } from '../api'
import { tagColorClasses, tagColors } from '../format'
import { useOrgId, useTags } from '../hooks'
import type { Tag } from '../types'

export function TagChip({ tag, onRemove }: { tag: Pick<Tag, 'name' | 'color'>; onRemove?: () => void }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', tagColorClasses[tag.color] ?? tagColorClasses.zinc)}>
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 rounded-full p-1 hover:bg-black/5" aria-label={`Remove tag ${tag.name}`}>
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

/** Read-only tag list; shows "+N" after `max`. */
export function TagChips({ tags, max = 3, className }: { tags: Tag[]; max?: number; className?: string }) {
  if (!tags.length) return null
  const shown = tags.slice(0, max)
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {shown.map((t) => (
        <TagChip key={t.id} tag={t} />
      ))}
      {tags.length > max && <span className="text-xs text-muted">+{tags.length - max}</span>}
    </span>
  )
}

/**
 * Multi-select of workspace tags with search; members who can create records can add a new tag by
 * typing its name. `value` is the selected tag ids.
 */
export function TagPicker({ value, onChange, id, label = 'Tags' }: { value: string[]; onChange: (ids: string[]) => void; id?: string; label?: string }) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const tags = useTags()
  const canCreate = useCan('contacts.create')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const panelRef = useFloatingPanel<HTMLDivElement>(open, rootRef, { focusSelector: 'input' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const all = tags.data ?? []
  const selected = all.filter((t) => value.includes(t.id))
  const term = q.trim().toLowerCase()
  const options = all.filter((t) => !term || t.name.toLowerCase().includes(term))
  const exact = all.some((t) => t.name.toLowerCase() === term)

  const toggle = (tagId: string) => onChange(value.includes(tagId) ? value.filter((v) => v !== tagId) : [...value, tagId].slice(0, 20))

  async function add() {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const tag = await createTag({ name: q.trim(), color: tagColors[all.length % tagColors.length] })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).tags })
      onChange([...value, tag.id].slice(0, 20))
      setQ('')
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t create the tag')
    } finally { setCreating(false) }
  }

  return (
    <div ref={rootRef} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-surface px-3 py-2">
        {selected.map((t) => (
          <TagChip key={t.id} tag={t} onRemove={() => toggle(t.id)} />
        ))}
        <button
          type="button"
          id={id}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted hover:bg-zinc-100 hover:text-ink"
        >
          <TagIcon className="size-4" aria-hidden="true" />
          {selected.length ? 'Edit' : `Add ${label.toLowerCase()}`}
        </button>
      </div>
      {open && (
        <div ref={panelRef} popover="manual" id={listId} className="crm-popover menu-surface">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); document.getElementById(id ?? '')?.focus() }
              if (e.key === 'Enter') {
                e.preventDefault()
                if (term && !exact && canCreate) void add()
              }
            }}
            placeholder="Search or create a tag…"
            aria-label="Search tags"
            className="h-10 w-full rounded-lg border border-line px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <ul className="mt-1 max-h-56 overflow-y-auto" role="listbox" aria-multiselectable="true" aria-label={label}>
            {tags.isPending && <li><Skeleton className="h-20" /></li>}
            {tags.isError && <li role="alert" className="p-3 text-sm text-danger">Couldn’t load tags. <button type="button" className="underline" onClick={() => void tags.refetch()}>Retry</button></li>}
            {options.map((t) => {
              const on = value.includes(t.id)
              return (
                <li key={t.id} role="option" aria-selected={on}>
                  <button type="button" onClick={() => toggle(t.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-subtle">
                    <TagChip tag={t} />
                    {on && <Check className="size-4 text-brand-700" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
            {!tags.isError && !tags.isPending && !options.length && !term && <li className="px-2 py-2 text-sm text-muted">No tags yet.</li>}
          </ul>
          {term && !exact && canCreate && (
            <button type="button" onClick={add} disabled={creating} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-brand-700 hover:bg-brand-50">
              <Plus className="size-4" aria-hidden="true" />
              Create “{q.trim()}”
            </button>
          )}
          {error && <p className="mt-1 px-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
