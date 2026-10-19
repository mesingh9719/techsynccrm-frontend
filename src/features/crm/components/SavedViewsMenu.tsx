import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkPlus, ChevronDown, Trash2, Users } from 'lucide-react'
import { qk } from '../../../lib/queryKeys'
import { useCan } from '../../../lib/useOrg'
import { ApiError } from '../../../services/http'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input } from '../../../components/ui/Form'
import { Dialog } from '../../../components/app/Dialog'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../../../components/app/Menu'
import { createSavedView, deleteSavedView } from '../api'
import { useOrgId, useSavedViews } from '../hooks'
import type { SavedView } from '../types'

/**
 * "Views" dropdown for a list page: apply a saved filter set, save the current one, delete your
 * own. Admins can share a view with the workspace.
 */
export function SavedViewsMenu({ entityType, current, onApply }: { entityType: SavedView['entityType']; current: Record<string, string>; onApply: (filters: Record<string, string>) => void }) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const views = useSavedViews(entityType)
  const canShare = useCan('settings.workspace.manage')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).savedViews(entityType) })
  const active = (views.data ?? []).find((v) => JSON.stringify(v.filters) === JSON.stringify(current))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await createSavedView({ entityType, name: name.trim(), filters: current, isShared: shared })
      await refresh()
      setSaving(false)
      setName('')
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save the view')
    } finally {
      setBusy(false)
    }
  }

  const mine = (views.data ?? []).filter((v) => !v.isShared)
  const team = (views.data ?? []).filter((v) => v.isShared)

  return (
    <>
      <Menu
        align="end"
        trigger={(props) => (
          <button {...props} type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:border-zinc-400">
            <Bookmark className="size-4 text-zinc-400" aria-hidden="true" />
            <span className="max-w-32 truncate">{active?.name ?? 'Views'}</span>
            <ChevronDown className="size-3.5 text-zinc-400" aria-hidden="true" />
          </button>
        )}
      >
        {(close) => (
          <>
            {team.length > 0 && <MenuLabel>Shared with the team</MenuLabel>}
            {team.map((v) => (
              <MenuItem key={v.id} icon={<Users className="size-4" />} onSelect={() => {
                onApply(v.filters)
                close()
              }}>
                {v.name}
              </MenuItem>
            ))}
            {mine.length > 0 && <MenuLabel>Your views</MenuLabel>}
            {mine.map((v) => (
              <div key={v.id} className="flex items-center">
                <MenuItem icon={<Bookmark className="size-4" />} onSelect={() => {
                onApply(v.filters)
                close()
              }}>
                  {v.name}
                </MenuItem>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                  aria-label={`Delete view ${v.name}`}
                  onClick={async () => {
                    await deleteSavedView(v.id).catch(() => {})
                    await refresh()
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            {(team.length > 0 || mine.length > 0) && <MenuSeparator />}
            <MenuItem icon={<BookmarkPlus className="size-4" />} onSelect={() => {
                setSaving(true)
                close()
              }}>
              Save current filters…
            </MenuItem>
          </>
        )}
      </Menu>
      <Dialog
        open={saving}
        onClose={() => setSaving(false)}
        title="Save view"
        description="Saves the current filters and sort so you can come back to them in one click."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!name.trim()}>
              Save view
            </Button>
          </>
        }
      >
        <Field label="Name">{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Hot IndiaMART leads" autoFocus />}</Field>
        {canShare && <Checkbox className="mt-4" label="Share with everyone in the workspace" checked={shared} onChange={(e) => setShared(e.target.checked)} />}
        {error && (
          <div className="mt-4">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
      </Dialog>
    </>
  )
}
