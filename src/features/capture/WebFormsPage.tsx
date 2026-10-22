import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileInput, LoaderCircle, PencilLine, Plus, Share2, Trash2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth } from '../../lib/useAuth'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { relativeTime } from '../crm/format'
import { captureKeys, captureLive, makeCaptureApi } from './api'
import { EmbedPanel } from './EmbedPanel'
import type { WebForm } from './types'

type Status = 'live' | 'draft' | 'preview'
const STATUS: Record<Status, { label: string; pill: string; dot: string }> = {
  live: { label: 'Live', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-100', dot: 'bg-emerald-500' },
  draft: { label: 'Draft', pill: 'bg-amber-50 text-amber-800 ring-amber-100', dot: 'bg-amber-500' },
  preview: { label: 'Preview', pill: 'bg-surface-subtle text-muted ring-line', dot: 'bg-zinc-400' },
}
const statusOf = (form: WebForm): Status => (!captureLive ? 'preview' : form.isActive ? 'live' : 'draft')

function FormCard({
  form,
  copying,
  onShare,
  onDuplicate,
  onDelete,
}: {
  form: WebForm
  copying: boolean
  onShare: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const status = statusOf(form)
  const fields = form.fields.filter((field) => !field.hidden).length
  const editUrl = `/app/settings/forms/${form.id}`
  const stats = [
    { label: 'Views', value: form.views.toLocaleString('en-IN') },
    { label: 'Enquiries', value: form.submissions.toLocaleString('en-IN') },
    { label: 'Conversion', value: form.views ? `${Math.round((form.submissions / form.views) * 100)}%` : '—' },
  ]
  return (
    <article className="surface flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', status === 'live' ? 'bg-brand-50 text-brand-700' : 'bg-surface-subtle text-muted')}>
          <FileInput className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Link to={editUrl} className="block truncate text-base font-semibold text-ink hover:text-brand-700">
            {form.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            {fields} {fields === 1 ? 'field' : 'fields'} · Edited {relativeTime(form.updatedAt)}
          </p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', STATUS[status].pill)}>
          <span className={cn('size-1.5 rounded-full', STATUS[status].dot)} aria-hidden="true" />
          {STATUS[status].label}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-lg bg-surface-subtle/70 py-3">
        {stats.map((s) => (
          <div key={s.label} className="px-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-ink tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {status === 'draft' && <p className="mt-3 text-xs text-amber-800">Not collecting enquiries yet. Open the form and publish it when you’re ready.</p>}

      <div className="mt-auto flex items-center gap-2 pt-5">
        <Button variant="secondary" to={editUrl}>
          <PencilLine className="size-4" aria-hidden="true" />
          Edit
        </Button>
        <Button variant="secondary" onClick={onShare} aria-label={`Share ${form.name}: link and website code`}>
          <Share2 className="size-4" aria-hidden="true" />
          Share
        </Button>
        <div className="ml-auto flex items-center">
          <button type="button" className="icon-button" onClick={onDuplicate} disabled={copying} aria-label={`Duplicate ${form.name}`} title="Duplicate">
            {copying ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          </button>
          <button type="button" className="icon-button hover:bg-red-50! hover:text-danger!" onClick={onDelete} aria-label={`Delete ${form.name}`} title="Delete">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function WebFormsPage() {
  const { user } = useAuth(),
    allowed = useCan('settings.forms.manage'),
    limit = useEntitlement('webForms'),
    notify = useToast(),
    client = useQueryClient()
  const scope = `${user?.organization?.id}:${user?.id}`,
    service = makeCaptureApi(scope)
  const query = useQuery({ queryKey: [...captureKeys(scope), 'forms'], queryFn: service.listForms, enabled: allowed })
  const [removing, setRemoving] = useState<WebForm | null>(null),
    [error, setError] = useState(''),
    [copying, setCopying] = useState<string | null>(null),
    [sharing, setSharing] = useState<WebForm | null>(null)

  async function duplicate(form: WebForm) {
    setCopying(form.id)
    try {
      const now = new Date().toISOString()
      const copy = await service.saveForm({ ...structuredClone(form), id: crypto.randomUUID(), key: crypto.randomUUID().replaceAll('-', '').slice(0, 22), name: `${form.name} (copy)`.slice(0, 100), isActive: false, views: 0, submissions: 0, createdAt: now, updatedAt: now }, true)
      await client.invalidateQueries({ queryKey: captureKeys(scope) })
      notify({ title: 'Form duplicated', description: `“${copy.name}” is saved as a draft.` })
    } catch (err) {
      notify({ tone: 'error', title: 'Couldn’t duplicate', description: err instanceof Error ? err.message : undefined })
    } finally {
      setCopying(null)
    }
  }

  if (!allowed)
    return (
      <EmptyState
        title="Web forms are managed by your workspace admin"
        description="Ask an owner or admin to create and connect a form."
      />
    )

  const forms = query.data ?? []
  const live = forms.filter((f) => f.isActive).length
  const enquiries = forms.reduce((sum, f) => sum + f.submissions, 0)
  return (
    <div className="space-y-5">
      <PageHeader
        title="Web forms"
        description="Build enquiry forms and manage how customers reach your team."
        actions={
          <Button to="/app/settings/forms/new">
            <Plus className="size-4" />
            Create form
          </Button>
        }
      />
      {!captureLive && (
        <PreviewNotice>
          Build and test forms in this browser. Publishing, live submissions and auto-replies need the live capture
          service.
        </PreviewNotice>
      )}
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !forms.length ? (
        <EmptyState
          icon={FileInput}
          title="Your next lead is a form away"
          description="Choose the questions you need, preview the form, then publish when live capture is available."
          action={
            <Button to="/app/settings/forms/new">
              <Plus className="size-4" />
              Build your first form
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
            <span>
              <span className="font-semibold text-ink tabular-nums">{forms.length}</span> {forms.length === 1 ? 'form' : 'forms'}
            </span>
            {captureLive && (
              <span>
                <span className="font-semibold text-ink tabular-nums">{live}</span> live
                {limit.limit !== null && <> of {limit.limit} allowed on your plan</>}
              </span>
            )}
            <span>
              <span className="font-semibold text-ink tabular-nums">{enquiries.toLocaleString('en-IN')}</span> {enquiries === 1 ? 'enquiry' : 'enquiries'} received
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                copying={copying === form.id}
                onShare={() => setSharing(form)}
                onDuplicate={() => duplicate(form)}
                onDelete={() => {
                  setError('')
                  setRemoving(form)
                }}
              />
            ))}
            <Link
              to="/app/settings/forms/new"
              className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line p-5 text-center text-muted transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-line">
                <Plus className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium">New form</span>
              <span className="text-xs">Choose your fields and preview the form</span>
            </Link>
          </div>
        </>
      )}
      <Dialog
        open={Boolean(sharing)}
        onClose={() => setSharing(null)}
        title={`Share “${sharing?.name ?? 'form'}”`}
        description="Send the link to customers, or add the form to your website."
        size="lg"
      >
        {sharing && <EmbedPanel form={sharing} scope={scope} />}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? 'form'}?`}
        description="The form will stop accepting new enquiries. Existing CRM leads are kept."
        confirmLabel="Delete form"
        tone="danger"
        error={error}
        onConfirm={async () => {
          try {
            await service.deleteForm(removing!.id)
            await client.invalidateQueries({ queryKey: captureKeys(scope) })
            setRemoving(null)
            notify({ title: 'Form deleted' })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Couldn’t delete form.')
          }
        }}
      />
    </div>
  )
}
