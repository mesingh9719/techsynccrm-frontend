import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, Code2, ExternalLink, GripVertical, Save, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { Tabs } from '../../components/ui/Tabs'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { useCustomFieldDefs } from '../crm/hooks'
import { useLeadSources } from '../leads/api'
import { captureKeys, captureLive, makeCaptureApi } from './api'
import {
  defaultFields,
  defaultSettings,
  type FormField,
  type FormFieldType,
  type FormSettings,
  type WebForm,
} from './types'
import { FormRenderer } from './FormRenderer'

const coreFields: FormField[] = [
  ...defaultFields,
  { key: 'lastName', label: 'Last name', type: 'text', required: false, placeholder: '' },
  { key: 'companyName', label: 'Company', type: 'text', required: false, placeholder: 'Your company' },
  { key: 'city', label: 'City', type: 'text', required: false, placeholder: '' },
  { key: 'stateCode', label: 'State code', type: 'text', required: false, placeholder: '' },
  { key: 'pincode', label: 'PIN code', type: 'text', required: false, placeholder: '' },
  { key: 'budgetMinor', label: 'Budget', type: 'number', required: false, placeholder: '' },
  {
    key: 'sourceDetail',
    label: 'Source detail',
    type: 'text',
    required: false,
    placeholder: '',
    hidden: true,
    defaultValue: 'Website enquiry',
  },
]
function fresh(): WebForm {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    key: crypto.randomUUID().replaceAll('-', '').slice(0, 22),
    name: 'Website enquiry',
    fields: defaultFields.map((f) => ({ ...f })),
    settings: { ...defaultSettings },
    isActive: false,
    views: 0,
    submissions: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function EmbedPanel({ form, scope }: { form: WebForm; scope: string }) {
  const service = makeCaptureApi(scope)
  const query = useQuery({
    queryKey: [...captureKeys(scope), 'embed', form.id],
    queryFn: () => service.embedCode(form.id),
    enabled: captureLive,
  })
  const hosted = new URL(`/f/${form.key}`, window.location.origin).href
  const examples = query.data ?? {
    script: `<script src="${window.location.origin}/embed.js" data-form="${form.key}"></script>`,
    iframe: `<iframe src="${hosted}?embed=1" title="Enquiry form" width="100%" height="720" style="border:0"></iframe>`,
    hostedUrl: hosted,
  }
  return (
    <div className="space-y-5">
      {!captureLive && (
        <PreviewNotice>
          These snippets show the publishing format. They will accept enquiries only after the live capture API is
          enabled.
        </PreviewNotice>
      )}
      {query.isPending && captureLive ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {[
            {
              label: 'Recommended · website script',
              value: examples.script,
              help: 'Paste before the closing body tag. The form resizes automatically.',
            },
            {
              label: 'Iframe embed',
              value: examples.iframe,
              help: 'Use this when your website builder supports embedded HTML.',
            },
            {
              label: 'Hosted form link',
              value: examples.hostedUrl,
              help: 'Share a standalone form with your customers.',
            },
          ].map((snippet) => (
            <div key={snippet.label}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-ink">{snippet.label}</h3>
                <CopyButton text={snippet.value} />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-surface-subtle p-4 text-xs leading-6 text-ink">
                <code>{snippet.value}</code>
              </pre>
              <p className="mt-2 text-xs text-muted">{snippet.help}</p>
            </div>
          ))}
        </>
      )}
      {captureLive && (
        <Button variant="secondary" href={hosted} target="_blank" rel="noreferrer">
          Open hosted form
          <ExternalLink className="size-4" />
        </Button>
      )}
    </div>
  )
}

function SettingsEditor({
  settings,
  onChange,
}: {
  settings: FormSettings
  onChange: (settings: FormSettings) => void
}) {
  const sources = useLeadSources()
  const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => onChange({ ...settings, [key]: value })
  return (
    <div className="space-y-5">
      <Field label="Form headline">
        {({ id }) => (
          <Input id={id} value={settings.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
        )}
      </Field>
      <Field label="Introduction">
        {({ id }) => (
          <Textarea
            id={id}
            value={settings.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={500}
            rows={2}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Button label">
          {({ id }) => (
            <Input
              id={id}
              value={settings.submitLabel}
              onChange={(e) => set('submitLabel', e.target.value)}
              maxLength={40}
            />
          )}
        </Field>
        <Field label="Brand color">
          {({ id }) => (
            <div className="flex items-center gap-3">
              <input
                type="color"
                id={id}
                value={settings.brandColor}
                onChange={(e) => set('brandColor', e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1"
              />
              <span className="font-mono text-xs text-muted">{settings.brandColor}</span>
            </div>
          )}
        </Field>
      </div>
      <Field label="Lead source">
        {({ id }) => (
          <Select id={id} value={settings.sourceId ?? ''} onChange={(e) => set('sourceId', e.target.value || null)}>
            <option value="">Website (default)</option>
            {sources.data
              ?.filter((s) => !s.archived)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Consent text" hint="Visitors must agree before submitting. This text is sent with the enquiry.">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            rows={3}
            value={settings.consentText}
            onChange={(e) => set('consentText', e.target.value)}
            maxLength={1000}
          />
        )}
      </Field>
      <Field label="Thank-you message">
        {({ id }) => (
          <Textarea
            id={id}
            rows={2}
            value={settings.thankYouMessage}
            onChange={(e) => set('thankYouMessage', e.target.value)}
            maxLength={1000}
          />
        )}
      </Field>
      <Field
        label="Redirect after submission"
        optional
        hint="Use an HTTPS address, or leave empty to show your thank-you message."
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            type="url"
            aria-describedby={describedBy}
            value={settings.redirectUrl}
            onChange={(e) => set('redirectUrl', e.target.value)}
            placeholder="https://yourwebsite.com/thank-you"
          />
        )}
      </Field>
      <Field label="Allowed embed domains" optional hint="One hostname per line. Leave empty to allow any website.">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            rows={2}
            value={settings.allowedDomains.join('\n')}
            onChange={(e) => set('allowedDomains', e.target.value.split('\n'))}
            placeholder="www.yourwebsite.com"
          />
        )}
      </Field>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={settings.autoReply}
          onChange={(e) => set('autoReply', e.target.checked)}
          className="mt-1 size-4 accent-brand-600"
        />
        <span>
          Send an email acknowledgement
          <span className="mt-1 block text-xs text-muted">
            Sent by the live capture service when an email is provided.
          </span>
        </span>
      </label>
      {settings.autoReply && (
        <Field label="Acknowledgement message">
          {({ id }) => (
            <Textarea
              id={id}
              value={settings.autoReplyTemplate}
              onChange={(e) => set('autoReplyTemplate', e.target.value)}
              rows={3}
            />
          )}
        </Field>
      )}
      <label className="flex items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={settings.notifyOwner}
          onChange={(e) => set('notifyOwner', e.target.checked)}
          className="size-4 accent-brand-600"
        />
        Notify the assigned owner
      </label>
    </div>
  )
}

function Builder({ initial, isNew, scope }: { initial: WebForm; isNew: boolean; scope: string }) {
  const [form, setForm] = useState(initial),
    [tab, setTab] = useState<'fields' | 'settings' | 'embed'>('fields'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [drag, setDrag] = useState<number | null>(null)
  const client = useQueryClient(),
    navigate = useNavigate(),
    notify = useToast(),
    service = makeCaptureApi(scope),
    defs = useCustomFieldDefs('lead')
  const guard = useUnsavedChanges(form, () => navigate('/app/settings/forms'), busy, dirty)
  function change(next: WebForm) {
    setForm(next)
    setDirty(true)
  }
  function field(index: number, patch: Partial<FormField>) {
    change({ ...form, fields: form.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) })
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= form.fields.length || from === to) return
    const fields = [...form.fields]
    fields.splice(to, 0, ...fields.splice(from, 1))
    change({ ...form, fields })
  }
  async function save() {
    setError('')
    if (
      !form.name.trim() ||
      !form.settings.title.trim() ||
      !form.settings.submitLabel.trim() ||
      !form.settings.consentText.trim()
    ) {
      setError('Add a name, headline, button label and consent message before saving.')
      return
    }
    if (!form.fields.some((f) => ['email', 'phone'].includes(f.key) && f.required && !f.hidden)) {
      setError('Make at least one visible email or phone field required so your team can follow up.')
      setTab('fields')
      return
    }
    if (form.fields.some((f) => !f.label.trim())) {
      setError('Every field needs a label.')
      return
    }
    if (form.settings.redirectUrl && !/^https:\/\//i.test(form.settings.redirectUrl)) {
      setError('Redirect addresses must start with https://.')
      setTab('settings')
      return
    }
    if (form.settings.allowedDomains.some((d) => d.trim() && !/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(d.trim()))) {
      setError('Enter hostnames such as www.example.com, without a protocol or path.')
      setTab('settings')
      return
    }
    setBusy(true)
    try {
      const saved = await service.saveForm(
        {
          ...form,
          name: form.name.trim(),
          settings: {
            ...form.settings,
            allowedDomains: form.settings.allowedDomains.map((d) => d.trim()).filter(Boolean),
          },
        },
        isNew,
      )
      await client.invalidateQueries({ queryKey: captureKeys(scope) })
      setForm(saved)
      setDirty(false)
      guard.markSaved(saved)
      notify({
        title: captureLive ? 'Form saved' : 'Form preview saved',
        description: captureLive ? undefined : 'Stored in this browser. No live form has been published.',
      })
      if (isNew) navigate(`/app/settings/forms/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save your form.')
    } finally {
      setBusy(false)
    }
  }
  const extras: FormField[] = (defs.data ?? [])
    .filter((d) => !d.archived)
    .map((d) => ({
      key: `cf.${d.key}`,
      label: d.label,
      required: d.required,
      placeholder: '',
      type: (['email', 'textarea', 'number', 'date', 'select', 'checkbox'].includes(d.type)
        ? d.type
        : d.type === 'phone'
          ? 'tel'
          : 'text') as FormFieldType,
      options: d.options?.map((o) => ({ label: o.label, value: o.value })),
    }))
  return (
    <div className="app-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/app/settings/forms" className="mb-3 inline-flex items-center gap-1 text-xs text-muted">
            <ArrowLeft className="size-4" />
            All web forms
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {isNew ? 'Build your first conversation' : form.name}
          </h1>
          <p className="mt-2 text-sm text-muted">Keep it short. Ask for what your team needs to get started.</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-amber-700" role="status">
              Unsaved changes
            </span>
          )}
          <Button loading={busy} onClick={save}>
            <Save className="size-4" />
            {captureLive ? 'Save form' : 'Save preview'}
          </Button>
        </div>
      </div>
      {!captureLive && (
        <PreviewNotice>
          Preview your form here. Publishing and automatic follow-up will be available when live capture is enabled.
        </PreviewNotice>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {guard.confirmation}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="surface p-5 sm:p-6">
          <Field label="Internal form name" hint="Only your team sees this name.">
            {({ id }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => change({ ...form, name: e.target.value })}
                maxLength={100}
              />
            )}
          </Field>
          <div className="my-6">
            <Tabs
              label="Form editor sections"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'fields', label: 'Fields' },
                { value: 'settings', label: 'Settings' },
                {
                  value: 'embed',
                  label: (
                    <span className="flex items-center gap-2">
                      <Code2 className="size-4" />
                      Embed & share
                    </span>
                  ),
                },
              ]}
            />
          </div>
          {tab === 'fields' ? (
            <div className="space-y-3">
              <p className="text-xs leading-5 text-muted">
                Drag to reorder, or use the arrow buttons. Make email or phone required.
              </p>
              {form.fields.map((f, index) => (
                <article
                  key={f.key}
                  draggable
                  onDragStart={() => setDrag(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (drag !== null) move(drag, index)
                    setDrag(null)
                  }}
                  className="rounded-xl border border-line bg-surface-subtle/70 p-3"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <GripVertical className="size-4 cursor-grab text-muted" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">
                      {f.key}
                      {f.hidden ? ' · hidden' : ''}
                    </span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={`Move ${f.label} up`}
                      className="rounded p-1 text-muted hover:bg-surface hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === form.fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Move ${f.label} down`}
                      className="rounded p-1 text-muted hover:bg-surface hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => change({ ...form, fields: form.fields.filter((_, i) => i !== index) })}
                      aria-label={`Remove ${f.label}`}
                      className="rounded p-1 text-muted hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <Input
                    aria-label={`Label for ${f.key}`}
                    value={f.label}
                    onChange={(e) => field(index, { label: e.target.value })}
                    className="h-10! text-sm"
                    maxLength={100}
                  />
                  {f.hidden ? (
                    <Input
                      aria-label={`Default value for ${f.key}`}
                      value={f.defaultValue ?? ''}
                      onChange={(e) => field(index, { defaultValue: e.target.value })}
                      placeholder="Hidden default value"
                      className="mt-2 h-10! text-sm"
                    />
                  ) : (
                    <Input
                      aria-label={`Placeholder for ${f.key}`}
                      value={f.placeholder}
                      onChange={(e) => field(index, { placeholder: e.target.value })}
                      placeholder="Placeholder (optional)"
                      className="mt-2 h-10! text-sm"
                    />
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={f.required}
                        disabled={f.hidden}
                        onChange={(e) => field(index, { required: e.target.checked })}
                        className="accent-brand-600"
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(f.hidden)}
                        onChange={(e) =>
                          field(index, { hidden: e.target.checked, required: e.target.checked ? false : f.required })
                        }
                        className="accent-brand-600"
                      />
                      Hidden field
                    </label>
                  </div>
                </article>
              ))}
              <Select
                aria-label="Add a form field"
                value=""
                onChange={(e) => {
                  const f = [...coreFields, ...extras].find((f) => f.key === e.target.value)
                  if (f) change({ ...form, fields: [...form.fields, { ...f }] })
                }}
              >
                <option value="">+ Add a field</option>
                {[...coreFields, ...extras]
                  .filter((f) => !form.fields.some((current) => current.key === f.key))
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                      {f.key.startsWith('cf.') ? ' (custom field)' : ''}
                    </option>
                  ))}
              </Select>
            </div>
          ) : tab === 'settings' ? (
            <>
              <SettingsEditor settings={form.settings} onChange={(settings) => change({ ...form, settings })} />
              {captureLive && (
                <label className="mt-6 flex items-center gap-3 border-t border-line pt-5 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => change({ ...form, isActive: e.target.checked })}
                    className="size-4 accent-brand-600"
                  />
                  Publish and accept submissions
                </label>
              )}
            </>
          ) : isNew || dirty ? (
            <EmptyState
              title="Save your form first"
              description="Save your latest changes before copying embed instructions."
              action={
                <Button onClick={save} loading={busy}>
                  <Save className="size-4" />
                  Save form
                </Button>
              }
            />
          ) : (
            <EmbedPanel form={form} scope={scope} />
          )}
        </section>
        <aside className="min-w-0 rounded-card border border-dashed border-line bg-surface-subtle/50 p-4 sm:p-6 xl:sticky xl:top-24">
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow">Live preview</p>
            <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs text-muted">
              No data is sent
            </span>
          </div>
          <FormRenderer key={form.key} form={form} preview />
          <p className="mt-4 text-center text-xs text-muted">Changes appear here as you edit.</p>
        </aside>
      </div>
    </div>
  )
}

export default function FormBuilderPage() {
  const { id } = useParams(),
    { user } = useAuth(),
    allowed = useCan('settings.workspace.manage'),
    isNew = id === 'new'
  const scope = `${user?.organization?.id}:${user?.id}`,
    service = makeCaptureApi(scope)
  const [initial] = useState(fresh)
  const query = useQuery({
    queryKey: [...captureKeys(scope), 'form', id],
    queryFn: () => service.getForm(id!),
    enabled: allowed && !isNew && Boolean(id),
  })
  if (!allowed)
    return (
      <EmptyState
        title="Form editing is available to owners and admins"
        action={<Button to="/app/integrations">Back to integrations</Button>}
      />
    )
  if (!isNew && query.isPending)
    return (
      <div className="app-page">
        <Skeleton className="h-96" />
      </div>
    )
  if (!isNew && query.isError)
    return (
      <div className="app-page">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    )
  if (!isNew && !query.data)
    return (
      <div className="app-page">
        <EmptyState
          title="Form not found"
          description="It may have been removed, or this preview belongs to a different browser."
          action={<Button to="/app/settings/forms">All web forms</Button>}
        />
      </div>
    )
  return <Builder key={`${scope}:${id}`} initial={isNew ? initial : query.data!} isNew={isNew} scope={scope} />
}
