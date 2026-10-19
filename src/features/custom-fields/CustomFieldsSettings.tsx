import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { emitAppEvent } from '../../lib/appEvents'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { ApiError } from '../../services/http'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { SettingsSection } from '../../components/app/SettingsSection'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/app/States'
import { createCustomField, deleteCustomField, reorderCustomFields, updateCustomField } from '../crm/api'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldOption, CustomFieldType } from '../crm/types'

const ENTITIES: { value: CustomFieldEntity; label: string }[] = [
  { value: 'contact', label: 'Contacts' },
  { value: 'company', label: 'Companies' },
  { value: 'lead', label: 'Leads' },
  { value: 'deal', label: 'Deals' },
]

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  currency: 'Amount (₹)',
  date: 'Date',
  datetime: 'Date & time',
  select: 'Dropdown',
  multiselect: 'Multi-select',
  checkbox: 'Yes / no',
  url: 'Web address',
  email: 'Email',
  phone: 'Phone',
  user: 'Team member',
}

const toKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'f_$1')
    .slice(0, 40)

function FieldDialog({ entityType, field, onClose }: { entityType: CustomFieldEntity; field: CustomFieldDefinition | null; onClose: () => void }) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState(field?.label ?? '')
  const [key, setKey] = useState(field?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(Boolean(field))
  const [type, setType] = useState<CustomFieldType>(field?.type ?? 'text')
  const [options, setOptions] = useState<CustomFieldOption[]>(field?.options ?? [])
  const [newOption, setNewOption] = useState('')
  const [required, setRequired] = useState(field?.required ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hasOptions = type === 'select' || type === 'multiselect'

  async function save() {
    setBusy(true)
    setErrors({})
    setError(null)
    try {
      const body = { label: label.trim(), type, required, ...(hasOptions && { options }) }
      if (field) await updateCustomField(field.id, body)
      else await createCustomField({ entityType, key: key || toKey(label), ...body })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).customFields(entityType) })
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setError(err instanceof ApiError ? err.message : 'Couldn’t save the field')
    } finally {
      setBusy(false)
    }
  }

  function addOption() {
    const text = newOption.trim()
    if (!text || options.some((o) => o.label.toLowerCase() === text.toLowerCase())) return
    setOptions([...options, { value: toKey(text) || `option_${options.length + 1}`, label: text }])
    setNewOption('')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={field ? `Edit “${field.label}”` : 'New custom field'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!label.trim() || (hasOptions && !options.length)}>
            {field ? 'Save' : 'Create field'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="Label" error={errors.label}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              autoFocus
              value={label}
              maxLength={60}
              onChange={(e) => {
                setLabel(e.target.value)
                if (!keyTouched) setKey(toKey(e.target.value))
              }}
              placeholder="e.g. GST type"
            />
          )}
        </Field>
        <Field label="Key" error={errors.key} hint={field ? 'The key can’t be changed — imports and the API use it.' : 'Used by imports and the API. Can’t be changed later.'}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              value={key}
              disabled={Boolean(field)}
              className="font-mono"
              onChange={(e) => {
                setKeyTouched(true)
                setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              }}
            />
          )}
        </Field>
        <Field label="Type" error={errors.type} hint={field ? 'Can only change while no record has a value.' : undefined}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} invalid={invalid} aria-describedby={describedBy} value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
              {Object.entries(fieldTypeLabels).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {hasOptions && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-zinc-800">Options</legend>
            <ul className="space-y-1.5">
              {options.map((o, i) => (
                <li key={o.value} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-sm">
                  <input
                    value={o.label}
                    aria-label={`Option ${i + 1}`}
                    onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className="min-w-0 flex-1 bg-transparent focus:outline-none"
                  />
                  <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:text-red-600" aria-label={`Remove ${o.label}`}>
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addOption()
                  }
                }}
                placeholder="Add an option"
                aria-label="New option"
              />
              <Button type="button" variant="secondary" onClick={addOption}>
                Add
              </Button>
            </div>
            {errors.options && <p className="mt-1 text-sm text-red-600">{errors.options}</p>}
            {field && <p className="mt-1.5 text-xs text-zinc-500">Removing an option keeps it on records that already use it.</p>}
          </fieldset>
        )}
        <Checkbox label="Required" description="Records can’t be saved without it (web forms and imports skip this)." checked={required} onChange={(e) => setRequired(e.target.checked)} />
      </div>
    </Dialog>
  )
}

/** Settings → Custom fields (M07): per record type, reorder, archive, plan limit meter. */
export default function CustomFieldsSettings() {
  useSeo({ title: 'Custom fields', noindex: true })
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const notify = useToast()
  const canManage = useCan('settings.customFields.manage')
  const [entityType, setEntityType] = useState<CustomFieldEntity>('contact')
  const defs = useCustomFieldDefs(entityType)
  const limit = useEntitlement('customFields').limit
  const [editing, setEditing] = useState<CustomFieldDefinition | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CustomFieldDefinition | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const fields = defs.data ?? []
  const used = fields.length
  const full = limit !== null && used >= limit
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).customFields(entityType) })

  async function move(ids: string[]) {
    queryClient.setQueryData(qk.org(orgId).customFields(entityType), ids.map((id) => fields.find((f) => f.id === id)!))
    try {
      await reorderCustomFields(entityType, ids)
    } finally {
      await refresh()
    }
  }

  const swap = (i: number, j: number) => {
    const ids = fields.map((f) => f.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    void move(ids)
  }

  async function toggleArchive(f: CustomFieldDefinition) {
    try {
      await updateCustomField(f.id, { archived: !f.archived })
      await refresh()
      notify({ title: f.archived ? `${f.label} restored` : `${f.label} archived`, description: f.archived ? undefined : 'Hidden from forms; values are kept.' })
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t update', description: err instanceof ApiError ? err.message : undefined })
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Custom fields"
        description="Extra details your team records — GST type, product interest, branch. They appear on forms, detail pages and list filters."
        actions={
          canManage && (
            <Button
              size="sm"
              onClick={() =>
                full ? emitAppEvent({ type: 'upgrade', reason: 'limit', resource: 'customFields', message: `Your plan includes ${limit} custom fields per record type. Upgrade to add more.` }) : setEditing('new')
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              New field
            </Button>
          )
        }
      >
        <SegmentedControl label="Record type" value={entityType} onChange={(v) => setEntityType(v as CustomFieldEntity)} options={ENTITIES} />
        {limit !== null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-600">
              <span>Fields for {ENTITIES.find((e) => e.value === entityType)?.label.toLowerCase()}</span>
              <span className="tabular-nums">
                {used} of {limit} (archived fields count)
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100" role="meter" aria-label="Custom fields used" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
              <div className={cn('h-full rounded-full', full ? 'bg-red-500' : used / limit >= 0.8 ? 'bg-amber-500' : 'bg-brand-500')} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="mt-5">
          {defs.isPending ? (
            <ListSkeleton rows={3} />
          ) : defs.isError ? (
            <ErrorState error={defs.error} onRetry={() => defs.refetch()} />
          ) : !fields.length ? (
            <EmptyState title="No custom fields yet" description="Add one to capture what matters to your business." className="py-10" />
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
              {fields.map((f, i) => (
                <li
                  key={f.id}
                  draggable={canManage}
                  onDragStart={() => setDragId(f.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragId || dragId === f.id) return
                    const ids = fields.map((x) => x.id).filter((x) => x !== dragId)
                    ids.splice(i, 0, dragId)
                    setDragId(null)
                    void move(ids)
                  }}
                  className={cn('flex items-center gap-3 px-3 py-2.5', f.archived && 'bg-zinc-50', dragId === f.id && 'opacity-50')}
                >
                  {canManage && <GripVertical className="size-4 shrink-0 cursor-grab text-zinc-300" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className={cn('flex flex-wrap items-center gap-2 text-sm font-medium', f.archived ? 'text-zinc-500' : 'text-zinc-900')}>
                      {f.label}
                      {f.required && <Badge tone="warning">Required</Badge>}
                      {f.archived && <Badge>Archived</Badge>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {fieldTypeLabels[f.type]} · <span className="font-mono">{f.key}</span>
                      {f.options?.length ? ` · ${f.options.length} options` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" disabled={i === 0} onClick={() => swap(i, i - 1)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30" aria-label={`Move ${f.label} up`}>
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" disabled={i === fields.length - 1} onClick={() => swap(i, i + 1)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30" aria-label={`Move ${f.label} down`}>
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setEditing(f)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label={`Edit ${f.label}`}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => toggleArchive(f)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label={f.archived ? `Restore ${f.label}` : `Archive ${f.label}`}>
                        {f.archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
                      </button>
                      <button type="button" onClick={() => setDeleting(f)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${f.label}`}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {entityType === 'deal' && <p className="mt-3 text-xs text-zinc-500">Deal fields appear once pipelines and deals are available.</p>}
      </SettingsSection>

      {editing && <FieldDialog entityType={entityType} field={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteCustomField(deleting!.id)
            await refresh()
            setDeleting(null)
            notify({ title: 'Field deleted' })
          } catch (err) {
            setDeleting(null)
            notify({ tone: 'error', title: 'Couldn’t delete', description: err instanceof ApiError ? err.message : undefined })
          }
        }}
        title={`Delete “${deleting?.label}”?`}
        description="Only fields no record uses can be deleted — this frees a slot in your plan. Archive a field to hide it but keep its values."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}
