import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkPlus, ChevronDown, Trash2, Users } from 'lucide-react'
import { qk } from '../../../lib/queryKeys'
import { useCan } from '../../../lib/useOrg'
import { ApiError } from '../../../services/http'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
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
export function SavedViewsMenu({
  entityType,
  current,
  onApply,
  columns,
  onColumnsChange,
}: {
  entityType: SavedView['entityType']
  current: Record<string, string>
  columns?: string[]
  onColumnsChange?: (columns: string[]) => void
  onApply: (filters: Record<string, string>) => void
}) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const notify = useToast()
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
      await createSavedView({ entityType, name: name.trim(), filters: current, columns, isShared: shared })
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
          <button
            {...props}
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-surface px-3 text-sm text-ink hover:border-zinc-400"
          >
            <Bookmark className="size-4 text-muted" aria-hidden="true" />
            <span className="max-w-32 truncate">{active?.name ?? 'Views'}</span>
            <ChevronDown className="size-4 text-muted" aria-hidden="true" />
          </button>
        )}
      >
        {(close) => (
          <>
            {views.isPending && (
              <p role="status" className="px-3 py-2 text-xs text-muted">
                Loading views…
              </p>
            )}
            {views.isError && (
              <div role="alert" className="p-2 text-sm text-red-700">
                Couldn’t load saved views.{' '}
                <button onClick={() => views.refetch()} className="underline">
                  Retry
                </button>
              </div>
            )}
            {team.length > 0 && <MenuLabel>Shared with the team</MenuLabel>}
            {team.map((v) => (
              <MenuItem
                key={v.id}
                icon={<Users className="size-4" />}
                onSelect={() => {
                  onApply(v.filters)
                  if (v.columns?.length) onColumnsChange?.(v.columns)
                  close()
                }}
              >
                {v.name}
              </MenuItem>
            ))}
            {mine.length > 0 && <MenuLabel>Your views</MenuLabel>}
            {mine.map((v) => (
              <div key={v.id} className="flex items-center">
                <MenuItem
                  icon={<Bookmark className="size-4" />}
                  onSelect={() => {
                    onApply(v.filters)
                    if (v.columns?.length) onColumnsChange?.(v.columns)
                    close()
                  }}
                >
                  {v.name}
                </MenuItem>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="rounded-md p-2 text-muted hover:bg-zinc-100 hover:text-danger"
                  aria-label={`Delete view ${v.name}`}
                  onClick={async () => {
                    try {
                      await deleteSavedView(v.id)
                      await refresh()
                    } catch (err) {
                      notify({ title: err instanceof Error ? err.message : 'Couldn’t delete view', tone: 'error' })
                    }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {(team.length > 0 || mine.length > 0) && <MenuSeparator />}
            <MenuItem
              icon={<BookmarkPlus className="size-4" />}
              onSelect={() => {
                setError(null)
                setSaving(true)
                close()
              }}
            >
              Save current filters…
            </MenuItem>
          </>
        )}
      </Menu>
      <Dialog
        open={saving}
        onClose={() => setSaving(false)}
        title="Save view"
        description="Saves your filters, sort and visible columns for next time."
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
        <Field label="Name">
          {({ id }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Hot IndiaMART leads"
              autoFocus
            />
          )}
        </Field>
        {canShare && (
          <Checkbox
            className="mt-4"
            label="Share with everyone in the workspace"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
        )}
        {error && (
          <div className="mt-4">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
      </Dialog>
    </>
  )
}
