import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Code2, FileText, Monitor, Save, Smartphone } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth } from '../../lib/useAuth'
import { useCan, useOrg } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { useCustomFieldDefs } from '../crm/hooks'
import { ApiError } from '../../services/http'
import { useLeadSources } from '../leads/api'
import { captureKeys, captureLive, makeCaptureApi } from './api'
import type { FormSettings, WebForm } from './types'
import { FormRenderer } from './FormRenderer'
import { EmbedPanel } from './EmbedPanel'
import { FieldsEditor } from './FieldsEditor'
import { DesignEditor } from './DesignEditor'
import { TEMPLATES, formFromTemplate, formPageStyle, formProblems, type FormTemplate } from './formConfig'

type Tab = 'fields' | 'design' | 'after' | 'settings' | 'embed'

function TemplatePicker({ onPick }: { onPick: (template: FormTemplate) => void }) {
  return (
    <div className="app-page space-y-6">
      <div>
        <Link to="/app/settings/forms" className="mb-3 inline-flex items-center gap-1 text-xs text-muted">
          <ArrowLeft className="size-4" />
          All web forms
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">What kind of form do you need?</h1>
        <p className="mt-2 text-sm text-muted">Pick a starting point. You can change every field, colour and word afterwards.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => {
          const fields = t.fields().filter((f) => !['heading', 'paragraph', 'hidden'].includes(f.type))
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="surface flex flex-col p-5 text-left transition-shadow hover:shadow-md focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-4 text-base font-semibold text-ink">{t.name}</span>
              <span className="mt-1 text-sm text-muted">{t.description}</span>
              <span className="mt-4 flex flex-wrap gap-1.5">
                {fields.slice(0, 5).map((f) => (
                  <span key={f.key} className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-muted">
                    {f.label}
                  </span>
                ))}
                {fields.length > 5 && <span className="px-1 text-xs text-muted">+{fields.length - 5} more</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AfterSubmitEditor({ settings, onChange }: { settings: FormSettings; onChange: (settings: FormSettings) => void }) {
  const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => onChange({ ...settings, [key]: value })
  const [redirect, setRedirect] = useState(Boolean(settings.redirectUrl))
  return (
    <div className="space-y-5">
      <Checkbox
        label="Ask visitors to agree before sending"
        description="Recommended. The wording is saved with every enquiry."
        checked={settings.consentEnabled}
        onChange={(e) => set('consentEnabled', e.target.checked)}
      />
      {settings.consentEnabled && (
        <Field label="Consent wording">
          {({ id }) => <Textarea id={id} rows={3} value={settings.consentText} onChange={(e) => set('consentText', e.target.value)} maxLength={1000} />}
        </Field>
      )}
      <div className="border-t border-line pt-5">
        <SegmentedControl
          label="After someone submits"
          size="sm"
          value={redirect ? 'redirect' : 'message'}
          onChange={(v) => {
            setRedirect(v === 'redirect')
            set('redirectUrl', v === 'redirect' ? settings.redirectUrl || 'https://' : '')
          }}
          options={[
            { value: 'message', label: 'Show a thank-you message' },
            { value: 'redirect', label: 'Go to another page' },
          ]}
        />
      </div>
      {redirect ? (
        <Field label="Page address" hint="Must start with https://, e.g. your own thank-you page.">
          {({ id, describedBy }) => (
            <Input id={id} type="url" aria-describedby={describedBy} value={settings.redirectUrl} onChange={(e) => set('redirectUrl', e.target.value)} placeholder="https://yourwebsite.com/thank-you" />
          )}
        </Field>
      ) : (
        <>
          <Field label="Thank-you title">{({ id }) => <Input id={id} value={settings.successTitle} onChange={(e) => set('successTitle', e.target.value)} maxLength={120} />}</Field>
          <Field label="Thank-you message">
            {({ id }) => <Textarea id={id} rows={3} value={settings.thankYouMessage} onChange={(e) => set('thankYouMessage', e.target.value)} maxLength={1000} />}
          </Field>
        </>
      )}
      <div className="space-y-4 border-t border-line pt-5">
        <Checkbox
          label="Email the visitor an acknowledgement"
          description="Sent by the live capture service when an email address is provided."
          checked={settings.autoReply}
          onChange={(e) => set('autoReply', e.target.checked)}
        />
        {settings.autoReply && (
          <Field label="Acknowledgement message">
            {({ id }) => <Textarea id={id} value={settings.autoReplyTemplate} onChange={(e) => set('autoReplyTemplate', e.target.value)} rows={3} maxLength={2000} />}
          </Field>
        )}
        <Checkbox label="Notify the assigned owner" checked={settings.notifyOwner} onChange={(e) => set('notifyOwner', e.target.checked)} />
      </div>
    </div>
  )
}

function SettingsEditor({ form, onChange }: { form: WebForm; onChange: (form: WebForm) => void }) {
  const sources = useLeadSources()
  const settings = form.settings,
    set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => onChange({ ...form, settings: { ...settings, [key]: value } })
  return (
    <div className="space-y-5">
      <Field label="Form name" hint="Only your team sees this name.">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} maxLength={100} />}
      </Field>
      <Field label="Lead source" hint="New leads from this form are tagged with this source.">
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={settings.sourceId ?? ''} onChange={(e) => set('sourceId', e.target.value || null)}>
            <option value="">Website (default)</option>
            {/* A source turned off after it was chosen stays selectable for this form only. */}
            {sources.data
              ?.filter((s) => !s.archived || s.id === settings.sourceId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.archived ? `${s.name} (turned off)` : s.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Websites allowed to show this form" optional hint="One per line, e.g. www.yourwebsite.com. Leave empty to allow any website.">
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
      {captureLive && (
        <div className="border-t border-line pt-5">
          <Checkbox
            label="Publish and accept submissions"
            description="Turn off to pause the form without deleting it."
            checked={form.isActive}
            onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
          />
        </div>
      )}
    </div>
  )
}

function Builder({ initial, isNew, scope }: { initial: WebForm; isNew: boolean; scope: string }) {
  const [form, setForm] = useState(initial),
    [tab, setTab] = useState<Tab>('fields'),
    [busy, setBusy] = useState(false),
    [problems, setProblems] = useState<string[]>([]),
    [dirty, setDirty] = useState(false),
    [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const client = useQueryClient(),
    navigate = useNavigate(),
    notify = useToast(),
    service = makeCaptureApi(scope),
    defs = useCustomFieldDefs('lead'),
    workspaceLogoUrl = useOrg().organization?.logoUrl ?? null
  const guard = useUnsavedChanges(form, () => navigate('/app/settings/forms'), busy, dirty)
  function change(next: WebForm) {
    setForm(next)
    setDirty(true)
    if (problems.length) setProblems(formProblems(next).map((p) => p.message))
  }
  async function save() {
    const found = formProblems(form)
    setProblems(found.map((p) => p.message))
    if (found.length) {
      setTab(found[0].tab)
      return
    }
    setBusy(true)
    try {
      const saved = await service.saveForm(
        {
          ...form,
          name: form.name.trim(),
          settings: { ...form.settings, allowedDomains: form.settings.allowedDomains.map((d) => d.trim()).filter(Boolean) },
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
      const fieldMessage = err instanceof ApiError ? Object.values(err.fields)[0] : undefined
      setProblems([fieldMessage ?? (err instanceof Error ? err.message : 'Couldn’t save your form.')])
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="app-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link to="/app/settings/forms" className="mb-3 inline-flex items-center gap-1 text-xs text-muted">
            <ArrowLeft className="size-4" />
            All web forms
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{form.name || 'Untitled form'}</h1>
          <p className="mt-2 text-sm text-muted">Edit on the left. Your form updates on the right as you type.</p>
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
      {problems.length > 0 && (
        <FormAlert>
          {problems.length === 1 ? (
            problems[0]
          ) : (
            <ul className="list-disc space-y-1 pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </FormAlert>
      )}
      {guard.confirmation}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="surface min-w-0 p-5 sm:p-6">
          <div className="mb-6 overflow-x-auto">
            <Tabs
              label="Form editor sections"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'fields', label: 'Fields' },
                { value: 'design', label: 'Design' },
                { value: 'after', label: 'After submit' },
                { value: 'settings', label: 'Settings' },
                {
                  value: 'embed',
                  label: (
                    <span className="flex items-center gap-2">
                      <Code2 className="size-4" />
                      Share
                    </span>
                  ),
                },
              ]}
            />
          </div>
          {tab === 'fields' ? (
            <FieldsEditor fields={form.fields} customDefs={defs.data ?? []} onChange={(fields) => change({ ...form, fields })} />
          ) : tab === 'design' ? (
            <DesignEditor settings={form.settings} workspaceLogoUrl={workspaceLogoUrl} onChange={(settings) => change({ ...form, settings })} />
          ) : tab === 'after' ? (
            <AfterSubmitEditor settings={form.settings} onChange={(settings) => change({ ...form, settings })} />
          ) : tab === 'settings' ? (
            <SettingsEditor form={form} onChange={change} />
          ) : isNew || dirty ? (
            <EmptyState
              title="Save your form first"
              description="Save your latest changes before copying the link or website code."
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
        <aside className="min-w-0 rounded-card border border-dashed border-line bg-surface-subtle/50 p-4 sm:p-5 xl:sticky xl:top-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Live preview</p>
            <SegmentedControl
              label="Preview size"
              size="sm"
              value={device}
              onChange={setDevice}
              options={[
                { value: 'desktop', label: <><Monitor className="size-4" aria-hidden="true" />Desktop</> },
                { value: 'mobile', label: <><Smartphone className="size-4" aria-hidden="true" />Phone</> },
              ]}
            />
          </div>
          <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto rounded-xl p-4 sm:p-6" style={formPageStyle(form.settings)}>
            <div className={cn('mx-auto transition-[max-width]', device === 'mobile' ? 'max-w-[360px]' : 'max-w-xl')}>
              <FormRenderer key={form.key} form={form} preview workspaceLogoUrl={workspaceLogoUrl} />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted">No data is sent from the preview.</p>
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
  const [initial, setInitial] = useState<WebForm | null>(null)
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
  if (isNew && !initial) return <TemplatePicker onPick={(t) => setInitial(formFromTemplate(t))} />
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
  return <Builder key={`${scope}:${id}:${initial?.id}`} initial={isNew ? initial! : query.data!} isNew={isNew} scope={scope} />
}
