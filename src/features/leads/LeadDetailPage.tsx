import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, CalendarPlus, FileText, ListChecks, MessageCircle, NotebookPen, Phone, UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useSeo } from '../../lib/useSeo'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/app/Dialog'
import { Menu, MenuItem, MenuLabel } from '../../components/app/Menu'
import { ErrorState, Skeleton } from '../../components/app/States'
import { Timeline, type TimelineDraft } from '../activities/Timeline'
import { BulkAssignDialog } from '../crm/components/BulkDialogs'
import { useOrgId } from '../crm/hooks'
import { Attachments } from '../files/Attachments'
import { TaskFormDialog } from '../tasks/TaskFormDialog'
import type { TaskInput } from '../activities/api'
import { assignLead, changeLeadStatus, claimLead, deleteLead, restoreLead } from './api'
import { ConvertDialog } from './ConvertDialog'
import { LeadFormDrawer } from './LeadFormDrawer'
import { useCommunication } from './detail/useCommunication'
import { qualificationFor, useMessageTemplates, useUpdateQualification, type LeadQualification } from './detail/extrasApi'
import { InsightsCard } from './detail/InsightsCard'
import { computeInsights, type FieldTarget, type NextActionKind } from './detail/insights'
import { DuplicatesCard, LeadAlerts } from './detail/LeadAlerts'
import { LeadHeader } from './detail/LeadHeader'
import { NextStepsCard } from './detail/NextStepsCard'
import { ProfileCard } from './detail/ProfileCard'
import { RequirementsCard } from './detail/RequirementsCard'
import { useLeadDetail, type LeadDetail } from './detail/useLeadDetail'
import { useFieldFocus } from './detail/useFieldFocus'

type Tab = 'activity' | 'details' | 'next'
type DialogState = null | 'edit' | 'convert' | 'assign' | 'delete' | 'qualify' | 'reopen' | { task: Partial<TaskInput> }

/** /app/leads/:id — three columns: know the lead · talk to the lead · what's next. */
export default function LeadDetailPage() {
  const { id = '' } = useParams()
  const detail = useLeadDetail(id)
  const lead = detail.lead
  useSeo({ title: lead?.displayName ?? 'Lead', noindex: true })

  if (detail.query.isPending) return <LeadSkeleton />
  if (detail.query.isError || !lead)
    return (
      <div className="app-page">
        <ErrorState error={detail.query.error} onRetry={() => detail.query.refetch()} />
      </div>
    )
  // Keyed so per-lead UI state (tabs, drafts, prompts) resets when navigating between leads.
  return <LeadWorkspace key={`${detail.user?.organization?.id}:${detail.user?.id}:${lead.id}`} detail={detail} />
}

function LeadWorkspace({ detail }: { detail: LeadDetail }) {
  const lead = detail.lead!
  const { can, act, user } = detail
  const orgId = useOrgId()
  const client = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const updateQualification = useUpdateQualification(lead.id)
  const templates = useMessageTemplates()
  const qualification = useMemo(() => qualificationFor(lead), [lead])
  const [tab, setTab] = useState<Tab>('activity')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const reveal = useFieldFocus<Tab>(setTab)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [draft, setDraft] = useState<TimelineDraft | null>(null)
  const [now] = useState(() => Date.now())

  const comm = useCommunication({
    lead,
    ownerName: lead.owner?.fullName ?? user?.fullName,
    workspaceName: user?.organization?.name,
    canLog: can.createTasks,
  })
  const openTasks = detail.tasks.data
  const tasksLoaded = detail.tasks.isSuccess
  const insights = useMemo(() => computeInsights(lead, qualification, openTasks ?? [], now, { tasksLoaded }), [lead, qualification, openTasks, now, tasksLoaded])

  async function saveQualification(values: Partial<LeadQualification>) {
    try {
      return await updateQualification.mutateAsync(values)
    } catch (err) {
      notify({ tone: 'error', title: 'Not saved', description: err instanceof Error ? err.message : undefined })
      throw err
    }
  }

  function compose(kind: TimelineDraft['kind'], body?: string) {
    setDraft({ kind, body, nonce: Date.now() })
    setTab('activity')
    requestAnimationFrame(() => {
      const box = document.getElementById('lead-composer')
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      box?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
      box?.querySelector<HTMLTextAreaElement>('[data-composer]:not([hidden]) textarea')?.focus({ preventScroll: true })
    })
  }

  const scheduleCallback = () => setDialog({ task: { title: `Call back ${lead.displayName}`, type: 'call' } })

  function onNextAction(kind: NextActionKind) {
    if (!canNextAction(kind)) return
    const template = (tplId: string) => templates.data?.find((t) => t.id === tplId)
    switch (kind) {
      case 'claim':
        return void act(() => claimLead(lead.id), 'Lead claimed — it’s yours')
      case 'call':
        return comm.start('call')
      case 'whatsapp':
        return comm.start('whatsapp', template(lead.firstRespondedAt ? 'tpl_wa_quote_followup' : 'tpl_wa_intro'))
      case 'email':
        return comm.start('email', template('tpl_email_intro'))
      case 'overdue':
      case 'schedule':
        return reveal('next', 'lead-tasks')
      case 'convert':
        return setDialog('convert')
      case 'reopen':
        return setDialog('reopen')
      case 'qualify': {
        if (!lead.phones.length && !lead.emails.length) return setDialog('edit')
        const ready = lead.requirement && lead.budgetMinor !== null && qualification.timeline
        if (lead.status === 'contacted' && ready) return setDialog('qualify')
        const gap = insights.missing.find((m) => ['requirement', 'budget', 'timeline', 'decisionMakers'].includes(m.target))
        return reveal('details', gap ? `lead-field-${gap.target}` : 'lead-requirements', Boolean(gap))
      }
    }
  }

  function onMissing(target: FieldTarget) {
    if (!canEditField(target)) return
    if (target === 'phone' || target === 'email') return setDialog('edit')
    if (target === 'owner') return can.claim ? void act(() => claimLead(lead.id), 'Lead claimed — it’s yours') : setDialog('assign')
    reveal('details', `lead-field-${target}`, true)
  }

  function canEditField(target: FieldTarget) { return target === 'owner' ? Boolean(can.claim || can.assign) : Boolean(can.update) }
  function canNextAction(kind: NextActionKind) {
    if (lead.deletedAt) return false
    if (kind === 'claim') return Boolean(can.claim)
    if (kind === 'call' || kind === 'whatsapp' || kind === 'email') return comm.available[kind]
    if (kind === 'schedule' || kind === 'overdue') return Boolean(can.tasks)
    return Boolean(can.update)
  }

  const noteTemplates = (templates.data ?? []).filter((t) => t.channel === 'note')
  const overdueCount = insights.overdue.length

  const profile = (
    <>
      <ProfileCard
        detail={detail}
        qualification={qualification}
        saveQualification={saveQualification}
        onEditContacts={() => setDialog('edit')}
        onAssign={() => setDialog('assign')}
        onClaim={() => act(() => claimLead(lead.id), 'Lead claimed — it’s yours')}
      />
      <RequirementsCard detail={detail} qualification={qualification} saveQualification={saveQualification} />
      <Attachments entityType="lead" entityId={lead.id} />
    </>
  )

  return (
    <div className="lead-page app-page max-w-wide">
      <div className="space-y-3">
        <LeadAlerts lead={lead} canRestore={can.delete} onRestore={() => act(() => restoreLead(lead.id), 'Lead restored')} />
        <LeadHeader
          detail={detail}
          qualification={qualification}
          comm={comm}
          onConvert={() => setDialog('convert')}
          onEdit={() => setDialog('edit')}
          onAssign={() => setDialog('assign')}
          onDelete={() => setDialog('delete')}
          onMeeting={() => setDialog({ task: { title: `Meeting with ${lead.displayName}`, type: 'meeting' } })}
          onCallback={scheduleCallback}
          onAddNotes={() => compose('note')}
        />
      </div>

      <div className="lead-layout">
        <div role="tablist" aria-label="Lead sections" className="lead-tabs">
          {(
            [
              { key: 'activity', label: 'Activity', icon: Activity },
              { key: 'details', label: 'Details', icon: UserRound },
              { key: 'next', label: 'Next steps', icon: ListChecks, badge: overdueCount },
            ] as const
          ).map((t, index, tabs) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`lead-tab-${t.key}`}
              ref={(element) => { tabRefs.current[index] = element }}
              tabIndex={tab === t.key ? 0 : -1}
              aria-selected={tab === t.key}
              aria-controls={`lead-col-${t.key}`}
              onClick={() => setTab(t.key)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length)%tabs.length
                setTab(tabs[next].key); tabRefs.current[next]?.focus()
              }}
              className="lead-tab compact-control"
            >
              <t.icon className="size-4" aria-hidden="true" />
              {t.label}
              {'badge' in t && t.badge > 0 && <span className="lead-tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>

        <div className="lead-grid">
          <aside id="lead-col-details" role="tabpanel" aria-labelledby="lead-tab-details" className="lead-col lead-col-profile" data-active={tab === 'details' || undefined} aria-label="Lead details">
            {profile}
          </aside>

          <section id="lead-col-activity" role="tabpanel" aria-labelledby="lead-tab-activity" className="lead-col lead-col-main" data-active={tab === 'activity' || undefined} aria-label="Conversation">
            <div id="lead-composer" className="scroll-mt-24">
              <Timeline
                entityType="lead"
                entityId={lead.id}
                recordName={lead.displayName}
                canPin={can.update}
                draft={draft}
                actions={
                  can.createTasks && noteTemplates.length > 0 && (
                    <Menu
                      align="end"
                      className="w-72"
                      trigger={(props) => (
                        <button type="button" {...props} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface-subtle hover:text-ink">
                          <FileText className="size-4" aria-hidden="true" />
                          Note templates
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuLabel>Start a note from</MenuLabel>
                          {noteTemplates.map((t) => (
                            <MenuItem key={t.id} icon={<NotebookPen className="size-4" />} onSelect={() => (close(), compose('note', t.body))}>
                              {t.name}
                            </MenuItem>
                          ))}
                        </>
                      )}
                    </Menu>
                  )
                }
              />
            </div>
          </section>

          <aside id="lead-col-next" role="tabpanel" aria-labelledby="lead-tab-next" className="lead-col lead-col-next" data-active={tab === 'next' || undefined} aria-label="Next steps">
            <InsightsCard insights={insights} canAct={insights.next ? canNextAction(insights.next.kind) : false} canEdit={canEditField} onAction={onNextAction} onMissing={onMissing} />
            <NextStepsCard detail={detail} onCustom={() => setDialog({ task: { title: `Follow up with ${lead.displayName}`, type: 'follow_up' } })} />
            <DuplicatesCard lead={lead} />
          </aside>
        </div>
      </div>

      {!lead.deletedAt && (
        <nav className="lead-mobile-bar" aria-label="Quick actions">
          <MobileAction icon={Phone} label="Call" disabled={!comm.available.call} onClick={() => comm.start('call')} primary />
          <MobileAction icon={MessageCircle} label="WhatsApp" disabled={!comm.available.whatsapp} onClick={() => comm.start('whatsapp')} />
          {can.createTasks && <MobileAction icon={NotebookPen} label="Log" onClick={() => compose('call')} />}
          {can.createTasks && (
            <MobileAction
              icon={CalendarPlus}
              label="Follow-up"
              onClick={() => setDialog({ task: { title: `Follow up with ${lead.displayName}`, type: 'follow_up' } })}
            />
          )}
        </nav>
      )}

      {dialog === 'edit' && <LeadFormDrawer open lead={lead} onClose={() => setDialog(null)} />}
      {dialog === 'convert' && <ConvertDialog lead={lead} onClose={() => setDialog(null)} />}
      <ConfirmDialog open={dialog === 'qualify' || dialog === 'reopen'} onClose={() => setDialog(null)} title={dialog === 'qualify' ? 'Move to Qualified?' : 'Re-open this lead?'} description="This changes the lead stage and records it in the timeline." confirmLabel="Confirm stage change" onConfirm={async () => {
        const saved = await act(() => changeLeadStatus(lead.id, { status: dialog === 'qualify' ? 'qualified' : 'contacted' }), dialog === 'qualify' ? 'Marked as qualified' : 'Lead re-opened')
        if (!saved) throw new Error('Couldn’t change the stage. Please try again.')
        setDialog(null)
      }} />
      {dialog !== null && typeof dialog === 'object' && (
        <TaskFormDialog record={{ entityType: 'lead', entityId: lead.id, name: lead.displayName }} defaults={dialog.task} onClose={() => setDialog(null)} />
      )}
      <BulkAssignDialog
        open={dialog === 'assign'}
        count={1}
        onClose={() => setDialog(null)}
        onAssign={async (ownerId) => {
          detail.setLead(await assignLead(lead.id, ownerId))
          await client.invalidateQueries({ queryKey: qk.org(orgId).leads.lists })
          notify({ title: ownerId ? 'Lead reassigned' : 'Lead is now unassigned' })
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await deleteLead(lead.id)
          await detail.refreshAll()
          notify({ title: 'Lead deleted', description: 'You can restore it from the bin for 30 days.' })
          navigate('/app/leads')
        }}
        title={`Delete ${lead.displayName}?`}
        description="It moves to the bin and can be restored for 30 days. Its tasks and timeline stay attached."
        confirmLabel="Delete lead"
        tone="danger"
      />
    </div>
  )
}

function MobileAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: typeof Phone
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn('lead-mobile-action compact-control', primary && 'is-primary')}>
      <Icon className="size-5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function LeadSkeleton() {
  return (
    <div className="app-page max-w-wide space-y-4" aria-busy="true" aria-label="Loading lead">
      <Skeleton className="h-52 rounded-card" />
      <div className="grid gap-4 xl:grid-cols-[17.5rem_minmax(0,1fr)_20rem]">
        <Skeleton className="hidden h-96 rounded-card xl:block" />
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="hidden h-96 rounded-card xl:block" />
      </div>
    </div>
  )
}
