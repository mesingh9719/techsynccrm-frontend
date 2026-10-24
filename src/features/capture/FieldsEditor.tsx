import { useState } from 'react'
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  AtSign,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Copy,
  EyeOff,
  GripVertical,
  Hash,
  Heading,
  IndianRupee,
  ListChecks,
  ListFilter,
  Phone,
  Pilcrow,
  Plus,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { CustomFieldDefinition } from '../crm/types'
import type { FormField, FormFieldType } from './types'
import { LEAD_TARGETS, PALETTE, TYPE_LABEL, blockKey, isChoice, isStatic, keyLabel, questionKey } from './formConfig'

const ICONS: Record<FormFieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  email: AtSign,
  tel: Phone,
  number: Hash,
  currency: IndianRupee,
  date: Calendar,
  select: ListFilter,
  radio: CircleDot,
  checkboxes: ListChecks,
  checkbox: CheckSquare,
  hidden: EyeOff,
  heading: Heading,
  paragraph: Pilcrow,
}
const URL_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ref']

/** Custom field definitions that a form can save into, as form field types. */
function customType(def: CustomFieldDefinition): FormFieldType {
  return def.type === 'phone'
    ? 'tel'
    : def.type === 'multiselect'
      ? 'checkboxes'
      : (['currency', 'email', 'textarea', 'number', 'date', 'select', 'checkbox'] as string[]).includes(def.type)
        ? (def.type as FormFieldType)
        : 'text'
}

function OptionsEditor({ field, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  const options = field.options ?? []
  const set = (next: typeof options) => onChange({ options: next })
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Choices</legend>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Choice ${i + 1}`}
              value={o.label}
              maxLength={100}
              onChange={(e) =>
                set(options.map((x, j) => (j === i ? { label: e.target.value, value: e.target.value.trim().slice(0, 100) || `option-${i + 1}` } : x)))
              }
            />
            <button type="button" className="icon-button" disabled={options.length <= 1} onClick={() => set(options.filter((_, j) => j !== i))} aria-label={`Remove choice ${o.label || i + 1}`}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
        onClick={() => set([...options, { label: `Option ${options.length + 1}`, value: `option-${options.length + 1}-${Date.now() % 1000}` }])}
        disabled={options.length >= 50}
      >
        <Plus className="size-4" />
        Add a choice
      </button>
    </fieldset>
  )
}

function FieldCard({
  field,
  index,
  count,
  open,
  usedKeys,
  customDefs,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  drag,
}: {
  field: FormField
  index: number
  count: number
  open: boolean
  usedKeys: Set<string>
  customDefs: CustomFieldDefinition[]
  onToggle: () => void
  onChange: (patch: Partial<FormField>) => void
  onMove: (to: number) => void
  onDuplicate: () => void
  onRemove: () => void
  drag: { start: () => void; drop: () => void }
}) {
  const Icon = ICONS[field.type],
    staticBlock = isStatic(field)
  const targets = [
    ...LEAD_TARGETS.filter((t) => t.types.includes(field.type)).map((t) => ({ key: t.key, label: t.label })),
    ...customDefs.filter((d) => customType(d) === field.type).map((d) => ({ key: `cf.${d.key}`, label: `${d.label} (custom field)` })),
  ]
  const summary = staticBlock ? field.label || field.helpText || 'Text' : field.label || 'Untitled field'
  return (
    <article
      draggable={!open}
      onDragStart={drag.start}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        drag.drop()
      }}
      className={cn('rounded-xl border bg-surface transition-shadow', open ? 'border-brand-300 shadow-card' : 'border-line hover:border-zinc-300')}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted" aria-hidden="true" />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{summary}</span>
            <span className="block truncate text-xs text-muted">
              {TYPE_LABEL[field.type]}
              {field.required && ' · Required'}
              {field.width === 'half' && ' · Half width'}
              {keyLabel(field.key) && ` · Saves to ${keyLabel(field.key)}`}
              {field.key.startsWith('cf.') && ' · Custom field'}
            </span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        <button type="button" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move ${summary} up`} className="icon-button disabled:opacity-30">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Move ${summary} down`} className="icon-button disabled:opacity-30">
          <ArrowDown className="size-4" />
        </button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-line px-4 pt-4 pb-4">
          {field.type === 'paragraph' ? (
            <Field label="Text to show">
              {({ id }) => <Textarea id={id} rows={3} value={field.helpText ?? ''} maxLength={2000} onChange={(e) => onChange({ helpText: e.target.value })} />}
            </Field>
          ) : (
            <Field label={field.type === 'heading' ? 'Section title' : field.type === 'hidden' ? 'Name (only your team sees it)' : field.type === 'checkbox' ? 'Text next to the tick box' : 'Question'}>
              {({ id }) =>
                field.type === 'checkbox' ? (
                  <Textarea id={id} rows={2} value={field.label} maxLength={200} onChange={(e) => onChange({ label: e.target.value })} />
                ) : (
                  <Input id={id} value={field.label} maxLength={200} onChange={(e) => onChange({ label: e.target.value })} />
                )
              }
            </Field>
          )}
          {isChoice(field) && <OptionsEditor field={field} onChange={onChange} />}
          {['text', 'textarea', 'email', 'tel', 'number', 'currency', 'select'].includes(field.type) && (
            <Field label={field.type === 'select' ? 'Text before a choice is made' : 'Example text inside the box'} optional>
              {({ id }) => <Input id={id} value={field.placeholder} maxLength={150} placeholder={field.type === 'select' ? 'Choose an option' : ''} onChange={(e) => onChange({ placeholder: e.target.value })} />}
            </Field>
          )}
          {field.type === 'hidden' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Value to send" hint="Sent with every enquiry.">
                {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={field.defaultValue ?? ''} maxLength={200} onChange={(e) => onChange({ defaultValue: e.target.value })} />}
              </Field>
              <Field label="Or read it from the page link" optional hint="e.g. utm_campaign from ?utm_campaign=diwali">
                {({ id, describedBy }) => (
                  <>
                    <Input id={id} aria-describedby={describedBy} list={`${id}-params`} value={field.urlParam ?? ''} maxLength={60} onChange={(e) => onChange({ urlParam: e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '') })} />
                    <datalist id={`${id}-params`}>
                      {URL_PARAMS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
            </div>
          ) : (
            !staticBlock && (
              <Field label="Help text" optional hint="Shown in small print under the field.">
                {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={field.helpText ?? ''} maxLength={500} onChange={(e) => onChange({ helpText: e.target.value })} />}
              </Field>
            )
          )}
          {!staticBlock && (
            <Field label="Save the answer to" hint="Pick a CRM field, or keep it in the enquiry notes.">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={field.key.startsWith('q_') ? '' : field.key}
                  onChange={(e) => onChange({ key: e.target.value || questionKey() })}
                >
                  <option value="">Enquiry notes</option>
                  {targets.map((t) => (
                    <option key={t.key} value={t.key} disabled={t.key !== field.key && usedKeys.has(t.key)}>
                      {t.label}
                      {t.key !== field.key && usedKeys.has(t.key) ? ' (already used)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {!staticBlock && field.type !== 'hidden' && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Checkbox label="Required" checked={field.required} onChange={(e) => onChange({ required: e.target.checked })} />
              <div className="flex items-center gap-2 text-sm text-ink">
                Width
                <SegmentedControl
                  size="sm"
                  label="Field width"
                  value={field.width ?? 'full'}
                  onChange={(width) => onChange({ width })}
                  options={[
                    { value: 'full', label: 'Full' },
                    { value: 'half', label: 'Half' },
                  ]}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-line pt-3">
            <button type="button" onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-surface-subtle hover:text-ink">
              <Copy className="size-3.5" />
              Duplicate
            </button>
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-red-50 hover:text-danger">
              <Trash2 className="size-3.5" />
              Remove
            </button>
            <button type="button" onClick={onToggle} className="ml-auto text-xs font-medium text-brand-700 hover:text-brand-800">
              Done
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export function FieldsEditor({
  fields,
  customDefs,
  onChange,
}: {
  fields: FormField[]
  customDefs: CustomFieldDefinition[]
  onChange: (fields: FormField[]) => void
}) {
  const [open, setOpen] = useState<string | null>(null),
    [drag, setDrag] = useState<number | null>(null)
  const usedKeys = new Set(fields.map((f) => f.key))
  function move(from: number, to: number) {
    if (to < 0 || to >= fields.length || from === to) return
    const next = [...fields]
    next.splice(to, 0, ...next.splice(from, 1))
    onChange(next)
  }
  function add(field: FormField) {
    onChange([...fields, field])
    setOpen(field.key)
  }
  const quick = [
    ...LEAD_TARGETS.filter((t) => !usedKeys.has(t.key) && t.key !== 'sourceDetail').map((t) => ({
      key: t.key,
      label: t.label,
      make: (): FormField => ({
        key: t.key,
        type: t.types[0],
        label: t.label === 'Name' ? 'Your name' : t.label,
        required: false,
        placeholder: '',
        helpText: '',
        width: 'full',
      }),
    })),
    ...customDefs
      .filter((d) => !d.archived && !usedKeys.has(`cf.${d.key}`))
      .map((d) => ({
        key: `cf.${d.key}`,
        label: d.label,
        make: (): FormField => ({
          key: `cf.${d.key}`,
          type: customType(d),
          label: d.label,
          required: d.required,
          placeholder: '',
          helpText: '',
          width: 'full',
          options: d.options?.map((o) => ({ label: o.label, value: o.value })) ?? (['select', 'checkboxes'].includes(customType(d)) ? [] : undefined),
        }),
      })),
  ]
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {fields.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Your form is empty. Add a field below.</p>}
        {fields.map((f, index) => (
          <FieldCard
            key={`${index}:${f.key}`}
            field={f}
            index={index}
            count={fields.length}
            open={open === f.key}
            usedKeys={usedKeys}
            customDefs={customDefs.filter((d) => !d.archived)}
            onToggle={() => setOpen(open === f.key ? null : f.key)}
            onChange={(patch) => {
              onChange(fields.map((x, i) => (i === index ? { ...x, ...patch } : x)))
              if (patch.key) setOpen(patch.key)
            }}
            onMove={(to) => move(index, to)}
            onDuplicate={() => {
              const copy = { ...f, key: isStatic(f) ? blockKey() : questionKey(), label: f.label ? `${f.label} (copy)`.slice(0, 200) : f.label }
              onChange([...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)])
              setOpen(copy.key)
            }}
            onRemove={() => onChange(fields.filter((_, i) => i !== index))}
            drag={{
              start: () => setDrag(index),
              drop: () => {
                if (drag !== null) move(drag, index)
                setDrag(null)
              },
            }}
          />
        ))}
      </div>
      <section aria-labelledby="add-field-heading">
        <h3 id="add-field-heading" className="mb-3 text-sm font-semibold text-ink">
          Add a field
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PALETTE.map((p) => {
            const Icon = ICONS[p.type]
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => {
                  const made = p.make()
                  add(p.type === 'hidden' && usedKeys.has(made.key) ? { ...made, key: questionKey() } : made)
                }}
                className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{p.label}</span>
                  <span className="block text-xs text-muted">{p.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        {quick.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted">Quick add a CRM field</p>
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => add(q.make())}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:border-brand-300 hover:text-brand-700"
                >
                  <Plus className="size-3" />
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
