import { ConfirmDialog } from '../../components/app/Dialog'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Textarea } from '../../components/ui/Form'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { fromLocalInput } from '../tasks/taskTime'
import { captureKeys, captureLive, makeCaptureApi } from './api'

export default function AvailabilitySettings() {
  const { user } = useAuth(),
    { organization } = useOrg(),
    client = useQueryClient(),
    notify = useToast()
  const scope = `${user?.organization?.id}:${user?.id}`,
    service = makeCaptureApi(scope),
    key = [...captureKeys(scope), 'availability'],
    timezone = user?.timezone ?? organization?.timezone ?? 'Asia/Kolkata'
  const query = useQuery({ queryKey: key, queryFn: service.listAbsences })
  const [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: key })
  return (
    <div className="space-y-5">
      <PageHeader title="Your availability" description="Let the team know when you’ll be away from new enquiries." />
      {!captureLive && (
        <PreviewNotice>
          Save an out-of-office plan in this browser. Live assignment rules will not skip you until the availability
          service is connected.
        </PreviewNotice>
      )}
      <form
        className="surface space-y-4 p-5"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          if (!start || !end) return setError('Choose a start and end time.')
          let startsAt: Date, endsAt: Date
          try {
            startsAt = fromLocalInput(start, timezone)
            endsAt = fromLocalInput(end, timezone)
            if (endsAt <= startsAt) return setError('The end must be after the start.')
          } catch {
            return setError('Choose valid dates and times in your time zone.')
          }
          setBusy(true)
          try {
            await service.addAbsence({
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              note: note.trim(),
            })
            await refresh()
            setStart('')
            setEnd('')
            setNote('')
            notify({ title: captureLive ? 'Out-of-office period saved' : 'Availability preview saved' })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Couldn’t save availability.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Away from" required>
            {({ id }) => (
              <Input id={id} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            )}
          </Field>
          <Field label="Back on" required>
            {({ id }) => (
              <Input id={id} type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            )}
          </Field>
        </div>
        <Field label="Note for your team" optional>
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="e.g. On leave; Priya can help with urgent enquiries."
            />
          )}
        </Field>
        <p className="text-xs text-muted">Times use {timezone}. Existing lead ownership is kept.</p>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" loading={busy}>
          <Plus className="size-4" />
          Add out-of-office period
        </Button>
      </form>
      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={CalendarClock}
          title="No time away planned"
          description="Add an out-of-office period above when you need one."
        />
      ) : (
        <div className="space-y-3">
          {query.data.map((absence) => (
            <div key={absence.id} className="surface flex items-start gap-3 p-4">
              <CalendarClock className="mt-1 size-4 text-brand-700" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">
                  {new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: timezone,
                  }).format(new Date(absence.startsAt))}{' '}
                  →{' '}
                  {new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: timezone,
                  }).format(new Date(absence.endsAt))}
                </p>
                <p className="mt-1 text-xs text-muted">{absence.note || 'Out of office'}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label="Remove out-of-office period"
                onClick={() => setRemoving(absence.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove this time away?" description="This period will no longer affect availability planning." confirmLabel="Remove period" tone="danger" onConfirm={async () => { if (!removing) return; await service.deleteAbsence(removing); await refresh(); setRemoving(null); notify({ title: 'Time away removed' }) }} />
    </div>
  )
}
