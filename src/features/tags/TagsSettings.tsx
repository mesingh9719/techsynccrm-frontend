import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Tags, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/app/Dialog'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { useCan } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { useOrgId, useTags } from '../crm/hooks'
import { createTag, deleteTag, updateTag } from '../crm/api'
import { tagColors } from '../crm/format'
import { TagChip } from '../crm/components/Tags'
import type { Tag, TagColor } from '../crm/types'

function TagRow({ tag, editable, refresh }: { tag: Tag; editable: boolean; refresh: () => Promise<unknown> }) {
  const [name, setName] = useState(tag.name),
    [color, setColor] = useState(tag.color),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [removing, setRemoving] = useState(false)
  const notify = useToast()
  return (
    <div className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <TagChip tag={{ ...tag, name, color }} />
        <Input
          aria-label={`Name of tag ${tag.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!editable}
          maxLength={40}
          className="h-10! min-w-32 flex-1 sm:max-w-60"
        />
        <Select
          aria-label={`Color of tag ${tag.name}`}
          value={color}
          onChange={(e) => setColor(e.target.value as TagColor)}
          disabled={!editable}
          className="h-10! text-sm"
        >
          {tagColors.map((c) => (
            <option key={c} value={c}>
              {c === 'brand' ? 'Cobalt' : c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">{tag.usage ?? 0} records</span>
        {editable && (
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              disabled={!name.trim() || (name === tag.name && color === tag.color)}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await updateTag(tag.id, { name: name.trim(), color })
                  await refresh()
                  notify({ title: 'Tag updated' })
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Couldn’t save tag.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Save className="size-4" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setError('')
                setRemoving(true)
              }}
              aria-label={`Delete tag ${tag.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <ConfirmDialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Delete ${tag.name}?`}
        description="This removes the tag from every record. The records themselves are kept."
        confirmLabel="Delete tag"
        tone="danger"
        error={error}
        onConfirm={async () => {
          try {
            await deleteTag(tag.id)
            await refresh()
            setRemoving(false)
            notify({ title: 'Tag deleted' })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Couldn’t delete tag.')
          }
        }}
      />
    </div>
  )
}
export default function TagsSettings() {
  const query = useTags(),
    orgId = useOrgId(),
    client = useQueryClient(),
    editable = useCan('settings.workspace.manage'),
    notify = useToast()
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const refresh = () => client.invalidateQueries({ queryKey: qk.org(orgId).tags })
  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await createTag({ name: name.trim(), color: 'brand' })
      await refresh()
      setName('')
      notify({ title: 'Tag created' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t create tag.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Tags" description="Simple labels to organize leads, contacts, companies and deals." />
      {editable && (
        <form onSubmit={add} className="surface flex flex-wrap items-end gap-3 p-4">
          <Field label="New tag" className="min-w-48 flex-1">
            {({ id }) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Priority, Event enquiry, Returning customer"
              />
            )}
          </Field>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            <Plus className="size-4" />
            Create tag
          </Button>
        </form>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={Tags}
          title="A little organization goes a long way"
          description={
            editable
              ? 'Create your first tag using the field above, then apply it to records individually or in bulk.'
              : 'Your team’s tags will appear here.'
          }
        />
      ) : (
        <div className="space-y-3">
          {query.data.map((tag) => (
            <TagRow key={`${tag.id}:${tag.name}:${tag.color}`} tag={tag} editable={editable} refresh={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}
