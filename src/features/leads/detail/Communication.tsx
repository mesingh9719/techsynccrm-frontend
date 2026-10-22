import { CalendarPlus, ChevronDown, FileText, Mail, MessageCircle, MessageSquareText, Phone, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Menu, MenuItem, MenuLabel } from '../../../components/app/Menu'
import { outcomeLabels } from '../../activities/api'
import type { CallOutcome } from '../../crm/types'
import { useMessageTemplates, type TemplateChannel } from './extrasApi'
import { channelLabel, type Channel, type Communication } from './useCommunication'

/** Template picker for one channel; picking opens the app with the message filled in. */
function TemplateMenu({ channel, comm, label }: { channel: Exclude<TemplateChannel, 'note'>; comm: Communication; label: string }) {
  const templates = useMessageTemplates()
  const items = (templates.data ?? []).filter((t) => t.channel === channel)
  return (
    <Menu
      align="end"
      className="w-80"
      trigger={(props) => (
        <button type="button" {...props} aria-label={`${label} templates`} disabled={!comm.available[channel]} className="comm-split compact-control">
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{label} templates</MenuLabel>
          {templates.isPending && <p className="px-3 py-2 text-sm text-muted">Loading…</p>}
          {items.map((t) => (
            <MenuItem key={t.id} icon={<FileText className="size-4" />} onSelect={() => (close(), comm.start(channel, t))}>
              <span className="block font-medium">{t.name}</span>
              <span className="line-clamp-2 block text-xs text-muted">{comm.fill(t.body)}</span>
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  )
}

/** The prominent contact row in the lead header. */
export function ContactActions({ comm, onMeeting, canLog }: { comm: Communication; onMeeting?: () => void; canLog: boolean }) {
  const buttons: { channel: Channel; label: string; icon: typeof Phone; templates?: Exclude<TemplateChannel, 'note'>; missing: string }[] = [
    { channel: 'call', label: 'Call', icon: Phone, missing: 'Add a phone number to call' },
    { channel: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, templates: 'whatsapp', missing: 'Add a valid mobile number for WhatsApp' },
    { channel: 'sms', label: 'SMS', icon: MessageSquareText, templates: 'sms', missing: 'Add a phone number to text' },
    { channel: 'email', label: 'Email', icon: Mail, templates: 'email', missing: 'Add an email address' },
  ]
  return (
    <div className="comm-actions" role="group" aria-label="Contact this lead">
      {buttons.map((b) => (
        <div key={b.channel} className={cn('comm-button-group', b.channel === 'call' && 'is-primary')}>
          <button
            type="button"
            onClick={() => comm.start(b.channel)}
            disabled={!comm.available[b.channel]}
            title={comm.available[b.channel] ? undefined : b.missing}
            className="comm-button compact-control"
          >
            <b.icon className="size-4" aria-hidden="true" />
            <span>{b.label}</span>
          </button>
          {b.templates && canLog && <TemplateMenu channel={b.templates} comm={comm} label={b.label} />}
        </div>
      ))}
      {onMeeting && (
        <div className="comm-button-group">
          <button type="button" onClick={onMeeting} className="comm-button compact-control">
            <CalendarPlus className="size-4" aria-hidden="true" />
            <span>Meeting</span>
          </button>
        </div>
      )}
    </div>
  )
}

const quickOutcomes: CallOutcome[] = ['connected', 'no_answer', 'busy', 'callback_requested', 'voicemail', 'wrong_number']

/**
 * “How did it go?” bar after a call or message was started. One tap logs it to the timeline;
 * a requested call-back also opens a follow-up task.
 */
export function LogPrompt({ comm, name, onCallback, onAddNotes }: { comm: Communication; name: string; onCallback: () => void; onAddNotes: () => void }) {
  const p = comm.pending
  if (!p) return null
  return (
    <div className="log-prompt" role="region" aria-label="Log this conversation">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          {p.channel === 'call' ? `How did the call with ${name} go?` : `Did you send the ${channelLabel[p.channel]}?`}
        </p>
        <button type="button" onClick={comm.dismiss} className="icon-button -m-2 size-8!" aria-label="Don’t log">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {p.channel === 'call' ? (
          quickOutcomes.map((o) => (
            <button
              key={o}
              type="button"
              disabled={comm.saving}
              onClick={async () => {
                const done = await comm.log(o)
                if (done && o === 'callback_requested') onCallback()
                if (done && o === 'connected') onAddNotes()
              }}
              className={cn('outcome-chip compact-control', o === 'connected' && 'is-positive', o === 'wrong_number' && 'is-negative')}
            >
              {outcomeLabels[o]}
            </button>
          ))
        ) : (
          <>
            <button type="button" disabled={comm.saving} onClick={() => comm.log()} className="outcome-chip is-positive compact-control">
              Yes, log it
            </button>
            <button type="button" onClick={comm.dismiss} className="outcome-chip compact-control">
              Not sent
            </button>
          </>
        )}
      </div>
    </div>
  )
}
