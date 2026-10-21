import { useState } from 'react'
import { Bookmark, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Form'
import { useToast } from '../ui/Toast'
import { ConfirmDialog, Dialog } from './Dialog'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './Menu'

type View = { id: string; name: string; filters: Record<string, string> }

/** Browser-local views for modules without a saved-view API. Never presented as team-shared. */
export function LocalViews({ module, filters, onApply }: { module: string; filters: Record<string, string | undefined>; onApply: (filters: Record<string, string>) => void }) {
  const { user } = useAuth()
  const storageKey = `techsync:views:v1:${user?.organization?.id}:${user?.id}:${module}`
  return <ViewMenu key={storageKey} storageKey={storageKey} filters={filters} onApply={onApply} />
}
function ViewMenu({ storageKey, filters, onApply }: { storageKey: string; filters: Record<string, string | undefined>; onApply: (filters: Record<string, string>) => void }) {
  const [views, setViews] = useState<View[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      return Array.isArray(stored) ? stored.filter((view): view is View => typeof view?.id === 'string' && typeof view?.name === 'string' && view.filters && typeof view.filters === 'object' && !Array.isArray(view.filters) && Object.values(view.filters).every((value) => typeof value === 'string')).slice(0, 20) : []
    } catch { return [] }
  })
  const notify = useToast()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<View | null>(null)
  function persist(next: View[]) {
    setViews(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) }
    catch { notify({ title: 'View applied for this session', description: 'Browser storage is unavailable.' }) }
  }
  return <>
    <Menu align="end" trigger={(props) => <Button {...props} variant="secondary"><Bookmark className="size-4" />Views</Button>}>
      {(close) => <><MenuLabel>Saved in this browser</MenuLabel>{!views.length && <p className="px-3 py-2 text-xs text-muted">Save filters you use often.</p>}{views.map((view) => <div key={view.id} className="flex items-center"><MenuItem onSelect={() => { onApply(view.filters); close() }}>{view.name}</MenuItem><button type="button" role="menuitem" tabIndex={-1} className="icon-button" aria-label={`Delete ${view.name} view`} onClick={() => { close(); setRemoving(view) }}><Trash2 className="size-4" /></button></div>)}<MenuSeparator /><MenuItem disabled={views.length >= 20} icon={<Plus className="size-4" />} onSelect={() => { close(); setName(''); setError(''); setSaving(true) }}>Save current view</MenuItem></>}
    </Menu>
    <Dialog open={saving} onClose={() => setSaving(false)} title="Save this view" description="Saved for your account and workspace in this browser." footer={<><Button variant="secondary" onClick={() => setSaving(false)}>Cancel</Button><Button disabled={!name.trim()} onClick={() => {
      if (views.some((view) => view.name.toLowerCase() === name.trim().toLowerCase())) { setError('Choose a different name for this view.'); return }
      persist([...views, { id: crypto.randomUUID(), name: name.trim(), filters: Object.fromEntries(Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1]))) }]); setSaving(false)
    }}>Save view</Button></>}>
      <Field label="View name" required error={error}>{({ id, invalid, describedBy }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoFocus maxLength={60} value={name} onChange={(event) => { setName(event.target.value); setError('') }} placeholder="e.g. Active Meta campaigns" />}</Field>
    </Dialog>
    <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} title="Delete saved view?" description={`This removes “${removing?.name ?? ''}” from this browser. Your records are kept.`} confirmLabel="Delete view" tone="danger" onConfirm={() => { persist(views.filter((view) => view.id !== removing?.id)); setRemoving(null) }} />
  </>
}
