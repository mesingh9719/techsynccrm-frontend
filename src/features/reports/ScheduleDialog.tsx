import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Switch } from '../../components/ui/Switch'
import { FormAlert } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { useOrgId } from '../crm/hooks'
import { getSchedules, saveSchedule, type ScheduleFrequency } from './api'

const copy: Record<ScheduleFrequency, { title: string; when: string }> = {
  weekly: { title: 'Weekly summary', when: 'Every Monday morning, covering the previous Monday–Sunday' },
  monthly: { title: 'Monthly summary', when: 'On the 1st of each month, covering the previous month' },
}

/** The signed-in member's own emailed report summaries, built with their own report access. */
export function ScheduleDialog({ filters, filterLabel, onClose }: { filters: { ownerId?: string; sourceId?: string }; filterLabel: string | null; onClose: () => void }) {
  const orgId = useOrgId()
  const client = useQueryClient()
  const notify = useToast()
  const [busy, setBusy] = useState<ScheduleFrequency | null>(null)
  const [error, setError] = useState('')
  const query = useQuery({ queryKey: ['org', orgId, 'reports', 'schedules'], queryFn: getSchedules })

  async function toggle(frequency: ScheduleFrequency, enabled: boolean) {
    setBusy(frequency)
    setError('')
    try {
      const data = await saveSchedule(frequency, { enabled, filters: enabled ? filters : undefined })
      client.setQueryData(['org', orgId, 'reports', 'schedules'], data)
      notify({ title: enabled ? `${copy[frequency].title} turned on` : `${copy[frequency].title} turned off`, tone: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the schedule.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Email me this report" description="A summary of KPIs, top sources, team results and follow-ups, sent to your inbox." icon={Mail} footer={<Button onClick={onClose}>Done</Button>}>
      {query.isPending ? (
        <Skeleton className="h-32" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.available ? (
        <div className="space-y-3 rounded-card bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-brand-200">
          <p className="font-medium">Scheduled reports are included in Growth and higher plans.</p>
          <Button size="sm" to="/app/settings/plan">
            View plans
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <FormAlert>{error}</FormAlert>}
          <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
            {query.data.schedules.map((s) => (
              <li key={s.frequency} className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="block font-medium text-ink">{copy[s.frequency].title}</span>
                  <span className="block text-xs text-muted">{copy[s.frequency].when}</span>
                  {s.lastSentAt && <span className="block text-xs text-muted">Last sent {new Date(s.lastSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                </span>
                <Switch checked={s.enabled} disabled={busy === s.frequency} label={copy[s.frequency].title} onChange={(on) => void toggle(s.frequency, on)} />
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-muted">
            {filterLabel ? `Turning a summary on saves the current filters (${filterLabel}).` : 'Summaries cover everything you can see in Reports.'} They arrive from 8 AM in your workspace’s time zone and only include data your role can access.
          </p>
        </div>
      )}
    </Dialog>
  )
}
