import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, FileInput, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { ConfirmDialog } from '../../components/app/Dialog'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { captureKeys, captureLive, makeCaptureApi } from './api'
import type { WebForm } from './types'

export default function WebFormsPage() {
  const { user } = useAuth(),
    allowed = useCan('settings.workspace.manage'),
    limit = useEntitlement('webForms'),
    notify = useToast(),
    client = useQueryClient()
  const scope = `${user?.organization?.id}:${user?.id}`,
    service = makeCaptureApi(scope)
  const query = useQuery({ queryKey: [...captureKeys(scope), 'forms'], queryFn: service.listForms, enabled: allowed })
  const [removing, setRemoving] = useState<WebForm | null>(null),
    [error, setError] = useState('')
  if (!allowed)
    return (
      <EmptyState
        title="Web forms are managed by your workspace admin"
        description="Ask an owner or admin to create and connect a form."
      />
    )
  return (
    <div className="space-y-5">
      <PageHeader
        title="Web forms"
        description="Turn visitors into conversations. Build once, share anywhere."
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
      {limit.limit !== null && (
        <p className="text-xs text-muted">
          Your plan includes {limit.limit} {limit.limit === 1 ? 'live form' : 'live forms'}. The server enforces
          publishing limits.
        </p>
      )}
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={FileInput}
          title="Your next lead is a form away"
          description="Start with a simple enquiry form, customize the fields, then add it to your website."
          action={
            <Button to="/app/settings/forms/new">
              <Plus className="size-4" />
              Build your first form
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.map((form) => (
            <article key={form.id} className="surface p-5">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <FileInput className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/app/settings/forms/${form.id}`} className="font-semibold text-ink hover:text-brand-700">
                    {form.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {form.fields.length} fields · {captureLive ? 'Website capture' : 'Browser preview'}
                  </p>
                </div>
                <Badge tone={captureLive && form.isActive ? 'success' : 'neutral'}>
                  {captureLive ? (form.isActive ? 'Published' : 'Draft') : 'Preview'}
                </Badge>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 border-y border-line py-4">
                {[
                  ['Views', form.views],
                  ['Submissions', form.submissions],
                  ['Conversion', form.views ? `${Math.round((form.submissions / form.views) * 100)}%` : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-lg font-semibold text-ink tabular-nums">{value}</p>
                    <p className="mt-1 text-xs text-muted">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError('')
                    setRemoving(form)
                  }}
                  aria-label={`Delete ${form.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button variant="secondary" size="sm" to={`/app/settings/forms/${form.id}`}>
                  Edit form
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
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
