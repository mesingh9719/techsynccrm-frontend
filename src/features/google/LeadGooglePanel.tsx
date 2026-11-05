import { useGoogleResourceKey } from './resourceUi'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Table2, Video } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { GoogleServiceGate } from './GoogleServiceGate'
import { MeetingDialog } from './MeetingDialog'
import { MeetingList } from './CalendarPage'
import { CreateSheetDialog, SheetList } from './SheetsPage'
import { listMeetings, listSheets } from './api'

export function LeadGooglePanel({ lead }: { lead: { id: string; displayName: string; deletedAt?: string | null } }) {
  const allowed = useCan('google.connect.own'), tasks = useCan('tasks.create'), canExport = useCan('leads.export'), key = useGoogleResourceKey()
  if (!allowed || lead.deletedAt) return null
  return <section className="surface space-y-3 p-4" aria-label="Lead Google tools"><h2 className="text-sm font-semibold">Meetings & sheets</h2><LeadTools key={`${key.join(':')}:${lead.id}`} lead={{ id: lead.id, label: lead.displayName }} tasks={tasks} canExport={canExport} /></section>
}
function LeadTools({ lead, tasks, canExport }: { lead: { id: string; label: string }; tasks: boolean; canExport: boolean }) {
  const [section, setSection] = useState<'calendar' | 'sheets' | null>(null), [meeting, setMeeting] = useState<'calendar' | 'meet' | null>(null), [sheet, setSheet] = useState<'blank' | 'leads' | null>(null)
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{tasks && <><Button size="sm" variant="secondary" onClick={() => setMeeting('calendar')}><CalendarDays className="size-4" />Schedule</Button><Button size="sm" variant="secondary" onClick={() => setMeeting('meet')}><Video className="size-4" />Google Meet</Button></>}<Button size="sm" variant="secondary" onClick={() => setSheet('blank')}><Table2 className="size-4" />Notes sheet</Button>{canExport && <Button size="sm" variant="ghost" onClick={() => setSheet('leads')}>Export lead</Button>}</div><div className="flex flex-wrap gap-3"><Button size="sm" variant="link" onClick={() => setSection(section === 'calendar' ? null : 'calendar')}>Lead meetings</Button><Button size="sm" variant="link" onClick={() => setSection(section === 'sheets' ? null : 'sheets')}>Lead spreadsheets</Button></div>
    {section && <GoogleServiceGate service={section}><LeadResources key={section} leadId={lead.id} service={section} /></GoogleServiceGate>}
    {meeting && <MeetingDialog lead={lead} withMeet={meeting === 'meet'} onClose={() => setMeeting(null)} onSaved={() => setSection('calendar')} />}
    {sheet && <CreateSheetDialog kind={sheet} lead={lead} onClose={() => setSheet(null)} onCreated={() => setSection('sheets')} />}
  </div>
}
function LeadResources({ leadId, service }: { leadId: string; service: 'calendar' | 'sheets' }) {
  const key = useGoogleResourceKey(), client = useQueryClient(), [from] = useState(() => new Date(Date.now() - 86400000).toISOString()), [to] = useState(() => new Date(Date.now() + 90 * 86400000).toISOString())
  const meetings = useQuery({ queryKey: [...key, 'events', 'lead', leadId, from], queryFn: () => listMeetings(from, to, leadId), enabled: service === 'calendar', refetchInterval: 5000 })
  const sheets = useQuery({ queryKey: [...key, 'sheets', 'lead', leadId], queryFn: () => listSheets(1, leadId), enabled: service === 'sheets', refetchInterval: 5000 })
  const refresh = () => client.invalidateQueries({ queryKey: key })
  const active = service === 'calendar' ? meetings : sheets
  return <div className="space-y-3">{active.isPending && <p role="status" className="text-sm text-muted">Loading lead {service === 'calendar' ? 'meetings' : 'spreadsheets'}…</p>}{active.isError && <FormAlert>{active.error.message} <button className="underline" onClick={() => void active.refetch()}>Retry</button></FormAlert>}{service === 'calendar' && meetings.data && <><p className="text-xs text-muted">Meetings from yesterday through the next 90 days.</p><MeetingList items={meetings.data.items.filter((item) => item.status !== 'cancelled')} onChanged={refresh} /></>}{service === 'sheets' && sheets.data && <>{!sheets.data.items.length && <p className="text-sm text-muted">No spreadsheets linked to this lead.</p>}<SheetList items={sheets.data.items} onChanged={refresh} />{sheets.data.total > 25 && <Button size="sm" variant="link" to="/app/sheets">See all spreadsheets</Button>}</>}</div>
}
