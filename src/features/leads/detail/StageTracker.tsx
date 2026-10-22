import { useState } from 'react'
import { Ban, Check, ChevronDown, CircleX, Sparkles } from 'lucide-react'
import { Menu, MenuItem } from '../../../components/app/Menu'
import { junkReasonLabels, leadStatusLabels } from '../../crm/format'
import type { LeadRecord, LeadStatus } from '../../crm/types'
import { changeLeadStatus, LEAD_TRANSITIONS, type StatusChange } from '../api'
import { StatusDialog } from '../StatusDialog'
import { ConfirmDialog } from '../../../components/app/Dialog'

const STAGES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted']
const hints: Partial<Record<LeadStatus, string>> = {
  new: 'Just came in',
  contacted: 'Conversation started',
  qualified: 'Real need and budget',
  converted: 'Continue with the contact',
}

/**
 * Visual pipeline: click a stage to move the lead there (only moves the status machine allows).
 * "Converted" opens the convert flow; lost/junk ask for a reason first.
 */
export function StageTracker({
  lead,
  canUpdate,
  onChange,
  onConvert,
}: {
  lead: LeadRecord
  canUpdate: boolean
  onChange: (fn: () => Promise<LeadRecord>, message: string) => Promise<boolean>
  onConvert: () => void
}) {
  const [closing, setClosing] = useState<'lost' | 'junk' | null>(null)
  const [busy, setBusy] = useState<LeadStatus | null>(null)
  const [confirming, setConfirming] = useState<Exclude<LeadStatus, 'converted'> | null>(null)
  const missing = [!lead.requirement?.trim() && 'requirement', lead.budgetMinor === null && 'budget'].filter(Boolean).join(' and ')
  const allowed = LEAD_TRANSITIONS[lead.status]
  const closed = lead.status === 'lost' || lead.status === 'junk'
  const currentIndex = STAGES.indexOf(lead.status)
  const isOpen = ['new', 'contacted', 'qualified'].includes(lead.status)

  async function move(status: Exclude<LeadStatus, 'converted'>) {
    setBusy(status)
    try {
      const saved = await onChange(() => changeLeadStatus(lead.id, { status }), `Moved to ${leadStatusLabels[status]}`)
      if (!saved) throw new Error('Couldn’t change the stage. Try again.')
      setConfirming(null)
    } finally { setBusy(null) }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <ol className="stage-track flex min-w-0 flex-1" aria-label="Lead stage">
        {STAGES.map((stage, index) => {
          const done = !closed && currentIndex > index
          const current = lead.status === stage
          const reachable =
            canUpdate && !current && (stage === 'converted' ? isOpen : allowed.includes(stage as Exclude<LeadStatus, 'converted'>))
          const label = leadStatusLabels[stage]
          return (
            <li key={stage} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!reachable || busy !== null}
                aria-current={current ? 'step' : undefined}
                title={reachable ? `Move to ${label}` : hints[stage]}
                onClick={() => (stage === 'converted' ? onConvert() : setConfirming(stage as Exclude<LeadStatus, 'converted'>))}
                data-state={current ? 'current' : done ? 'done' : closed ? 'closed' : 'todo'}
                className="stage-step compact-control"
              >
                <span className="stage-bar" aria-hidden="true" />
                <span className="flex min-w-0 items-center gap-1.5">
                  {(done || (current && stage === 'converted')) && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                  <span className="truncate">{label}</span>
                </span>
                <span className="stage-hint">{busy === stage ? 'Saving…' : stage === 'qualified' && missing && !current ? `Add ${missing}` : current ? 'Current stage' : reachable ? `Move here` : hints[stage]}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {closed ? (
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-100 sm:self-auto">
          {lead.status === 'lost' ? <CircleX className="size-4" aria-hidden="true" /> : <Ban className="size-4" aria-hidden="true" />}
          {leadStatusLabels[lead.status]}
          {lead.status === 'lost' && lead.lostReason && <span className="font-normal">· {lead.lostReason.name}</span>}
          {lead.status === 'junk' && lead.junkReason && <span className="font-normal">· {junkReasonLabels[lead.junkReason]}</span>}
        </span>
      ) : (
        canUpdate &&
        isOpen && (
          <Menu
            align="end"
            trigger={(props) => (
              <button type="button" {...props} className="compact-control inline-flex h-8 items-center gap-1 self-start rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface-subtle hover:text-ink sm:self-auto">
                Close lead
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<Sparkles className="size-4" />} onSelect={() => (close(), onConvert())}>
                  Won — convert
                </MenuItem>
                {allowed.includes('lost') && (
                  <MenuItem icon={<CircleX className="size-4" />} onSelect={() => (close(), setClosing('lost'))}>
                    Mark as lost…
                  </MenuItem>
                )}
                {allowed.includes('junk') && (
                  <MenuItem icon={<Ban className="size-4" />} tone="danger" onSelect={() => (close(), setClosing('junk'))}>
                    Mark as junk…
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        )
      )}

      {closing && (
        <StatusDialog
          open
          allowed={[closing]}
          initial={closing}
          title={closing === 'lost' ? 'Mark this lead as lost?' : 'Mark this lead as junk?'}
          onClose={() => setClosing(null)}
          onSubmit={async (change: StatusChange) => {
            const ok = await onChange(() => changeLeadStatus(lead.id, change), `Marked as ${leadStatusLabels[change.status].toLowerCase()}`)
            // StatusDialog closes itself on success and keeps the form open when this throws.
            if (!ok) throw new Error('Not saved')
          }}
        />
      )}
      <ConfirmDialog open={confirming !== null} onClose={() => setConfirming(null)} title={`Move to ${confirming ? leadStatusLabels[confirming] : 'stage'}?`} description={confirming === 'qualified' && missing ? `Requirement and budget help the team qualify a lead. You can still move now and add the missing ${missing} later.` : 'This updates the lead stage and records the change in its activity history.'} confirmLabel="Confirm stage change" onConfirm={async () => { if (confirming) await move(confirming) }} />
    </div>
  )
}
