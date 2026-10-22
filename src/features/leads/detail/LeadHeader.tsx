import { Link } from 'react-router-dom'
import { ChevronRight, Clock, Ellipsis, Hand, Link2, Pencil, Sparkles, Trash2, UserRoundPlus } from 'lucide-react'
import { Avatar } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Menu, MenuItem, MenuSeparator } from '../../../components/app/Menu'
import { useToast } from '../../../components/ui/Toast'
import { relativeTime } from '../../crm/format'
import type { LeadRecord } from '../../crm/types'
import { claimLead } from '../api'
import { ScorePill } from '../LeadBits'
import { ContactActions, LogPrompt } from './Communication'
import type { Communication } from './useCommunication'
import type { LeadQualification } from './extrasApi'
import { PriorityLabel } from './ProfileCard'
import { StageTracker } from './StageTracker'
import { FROZEN, type LeadDetail } from './useLeadDetail'

/**
 * Compact record header: who (identity + key facts) and do (contact, convert) on one band,
 * the stage stepper beneath. Wraps to stacked rows on narrow screens.
 */
export function LeadHeader({
  detail,
  qualification,
  comm,
  onConvert,
  onEdit,
  onAssign,
  onDelete,
  onMeeting,
  onCallback,
  onAddNotes,
}: {
  detail: LeadDetail
  qualification: LeadQualification
  comm: Communication
  onConvert: () => void
  onEdit: () => void
  onAssign: () => void
  onDelete: () => void
  onMeeting: () => void
  onCallback: () => void
  onAddNotes: () => void
}) {
  const lead = detail.lead as LeadRecord
  const { can, isOpen, act } = detail
  const notify = useToast()
  const subtitle = [lead.companyName, lead.city, lead.source?.name].filter(Boolean).join(' · ')

  return (
    <header className="lead-header surface">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted">
        <Link to="/app/leads" className="rounded hover:text-ink hover:underline">
          Leads
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="truncate text-ink" aria-current="page">
          {lead.displayName}
        </span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-[16rem] flex-1 items-start gap-3">
          <Avatar name={lead.displayName} size="md" className="mt-0.5 size-12! text-base!" />
          <div className="min-w-0">
            <h1 className="truncate text-xl! leading-7 font-semibold tracking-tight text-ink" title={lead.displayName}>
              {lead.displayName}
            </h1>
            <p className="truncate text-sm text-muted">{subtitle || 'No company or location yet'}</p>
            <ul className="lead-facts mt-2" aria-label="Key facts">
              <li>
                <span className="text-muted">Score</span>
                <ScorePill score={lead.score} breakdown={lead.scoreBreakdown} frozen={FROZEN.includes(lead.status)} />
              </li>
              {qualification.priority && (
                <li>
                  <PriorityLabel priority={qualification.priority} />
                </li>
              )}
              <li>
                {lead.owner ? (
                  <>
                    <Avatar name={lead.owner.fullName} size="xs" className="size-5! text-[10px]!" />
                    <span className="text-ink">{lead.owner.fullName}</span>
                  </>
                ) : (
                  <span className="font-medium text-warning">Unassigned</span>
                )}
              </li>
              <li className="text-muted">
                <Clock className="size-3.5" aria-hidden="true" />
                Active {relativeTime(lead.lastActivityAt)}
              </li>
            </ul>
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2">
          {!lead.deletedAt && <ContactActions comm={comm} canLog={can.createTasks} onMeeting={can.createTasks ? onMeeting : undefined} />}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          {can.claim && (
            <Button size="sm" variant="secondary" className="h-9" onClick={() => act(() => claimLead(lead.id), 'Lead claimed — it’s yours')}>
              <Hand className="size-4" aria-hidden="true" />
              Claim
            </Button>
          )}
          {can.update && isOpen && (
            <Button size="sm" className="h-9" onClick={onConvert}>
              <Sparkles className="size-4" aria-hidden="true" />
              Convert
            </Button>
          )}
          <Menu
            align="end"
            trigger={(props) => (
              <button type="button" {...props} className="icon-button size-9! min-h-9! min-w-9! ring-1 ring-line ring-inset" aria-label="More lead actions">
                <Ellipsis className="size-4" aria-hidden="true" />
              </button>
            )}
          >
            {(close) => (
              <>
                {can.update && (
                  <MenuItem icon={<Pencil className="size-4" />} onSelect={() => (close(), onEdit())}>
                    Edit all details
                  </MenuItem>
                )}
                {can.assign && (
                  <MenuItem icon={<UserRoundPlus className="size-4" />} onSelect={() => (close(), onAssign())}>
                    Assign to…
                  </MenuItem>
                )}
                <MenuItem
                  icon={<Link2 className="size-4" />}
                  onSelect={() => {
                    close()
                    void navigator.clipboard
                      ?.writeText(window.location.href)
                      .then(() => notify({ title: 'Link copied' }))
                      .catch(() => notify({ tone: 'error', title: 'Couldn’t copy the link' }))
                  }}
                >
                  Copy link
                </MenuItem>
                {can.delete && !lead.deletedAt && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 className="size-4" />} tone="danger" onSelect={() => (close(), onDelete())}>
                      Delete lead…
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </Menu>
        </div>
      </div>

      <LogPrompt comm={comm} name={lead.firstName ?? lead.displayName} onCallback={onCallback} onAddNotes={onAddNotes} />

      <div className="mt-4 border-t border-line pt-3">
        <StageTracker lead={lead} canUpdate={can.update} onChange={act} onConvert={onConvert} />
      </div>
    </header>
  )
}
