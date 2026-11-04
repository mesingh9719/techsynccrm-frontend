import { CalendarPlus, Clock, Ellipsis, Hand, Link2, Pencil, Sparkles, Trash2, UserRoundPlus } from 'lucide-react'
import { Avatar } from '../../../components/ui/Badge'
import { RecordHeader } from '../../../components/app/RecordHeader'
import { Button } from '../../../components/ui/Button'
import { Menu, MenuItem, MenuSeparator } from '../../../components/app/Menu'
import { useToast } from '../../../components/ui/Toast'
import { relativeTime } from '../../crm/format'
import type { LeadRecord } from '../../crm/types'
import { claimLead } from '../api'
import { LeadStatusBadge, ScorePill } from '../LeadBits'
import { ContactActions, LogPrompt } from './Communication'
import type { Communication } from './useCommunication'
import type { LeadQualification } from './extrasApi'
import { PriorityLabel } from './ProfileCard'
import { StageTracker } from './StageTracker'
import { FROZEN, type LeadDetail } from './useLeadDetail'

/**
 * The lead's record header (shared RecordHeader card): identity and key facts, contact and convert
 * actions, the log prompt and stage tracker beneath.
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
  const { can, act } = detail
  const notify = useToast()
  const subtitle = [lead.companyName, lead.city, lead.source?.name].filter(Boolean).join(' · ')

  return (
    <RecordHeader
      media={<Avatar name={lead.displayName} size="md" />}
      title={lead.displayName}
      titleHint={lead.displayName}
      status={<LeadStatusBadge status={lead.status} />}
      subtitle={subtitle || 'No company or location yet'}
      facts={
            <ul className="lead-facts" aria-label="Key facts">
              <li data-fact="score">
                <span className="text-muted">Score</span>
                <ScorePill score={lead.score} breakdown={lead.scoreBreakdown} frozen={FROZEN.includes(lead.status)} />
              </li>
              {qualification.priority && (
                <li>
                  <PriorityLabel priority={qualification.priority} />
                </li>
              )}
              <li data-fact="owner">
                {lead.owner ? (
                  <>
                    <Avatar name={lead.owner.fullName} size="xs" className="size-5! text-[10px]!" />
                    <span className="text-ink">{lead.owner.fullName}</span>
                  </>
                ) : (
                  <span className="font-medium text-warning">Unassigned</span>
                )}
              </li>
              <li data-fact="activity" className="text-muted" title={new Date(lead.lastActivityAt).toLocaleString()}>
                <Clock className="size-3.5" aria-hidden="true" />
                Active {relativeTime(lead.lastActivityAt)}
              </li>
              <li data-fact="created" className="text-muted" title={new Date(lead.createdAt).toLocaleString()}>
                <CalendarPlus className="size-3.5" aria-hidden="true" />
                Added {relativeTime(lead.createdAt)}
              </li>
            </ul>
      }
      actions={
        <>
          {!lead.deletedAt && <ContactActions comm={comm} canLog={can.createTasks} onMeeting={can.createTasks ? onMeeting : undefined} />}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          {can.claim && (
            <Button size="sm" variant="secondary" className="h-9" onClick={() => act(() => claimLead(lead.id), 'Lead claimed — it’s yours')}>
              <Hand className="size-4" aria-hidden="true" />
              Claim
            </Button>
          )}
          {can.convert && (
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
        </>
      }
    >
      <LogPrompt comm={comm} name={lead.firstName ?? lead.displayName} onCallback={onCallback} onAddNotes={onAddNotes} />
      <StageTracker lead={lead} canStatus={Boolean(can.status)} canConvert={Boolean(can.convert)} onChange={act} onConvert={onConvert} />
    </RecordHeader>
  )
}
