/**
 * Smart insights for a lead, computed in the browser from data we already have: last activity,
 * first response, open tasks, score and which fields are filled in. Pure functions, so the rules
 * are easy to test and could move server-side later unchanged.
 */
import type { LeadRecord, Task } from '../../crm/types'
import type { LeadQualification } from './extrasApi'

export type InsightTone = 'success' | 'warning' | 'danger' | 'neutral'

export type NextActionKind = 'claim' | 'call' | 'whatsapp' | 'email' | 'overdue' | 'qualify' | 'convert' | 'schedule' | 'reopen'

export interface NextAction {
  kind: NextActionKind
  title: string
  reason: string
}

/** Which profile field a missing-info item points at (the page focuses/opens it). */
export type FieldTarget = 'phone' | 'email' | 'requirement' | 'budget' | 'owner' | 'timeline' | 'decisionMakers' | 'dealValue' | 'company'

export interface MissingItem {
  target: FieldTarget
  label: string
}

export interface LeadInsights {
  health: { score: number; label: string; tone: InsightTone; factors: string[] }
  inactiveDays: number
  inactivity: { tone: InsightTone; message: string } | null
  missing: MissingItem[]
  next: NextAction | null
  recommendations: string[]
  overdue: Task[]
}

const DAY = 86_400_000
const OPEN = new Set(['new', 'contacted', 'qualified'])

export function computeInsights(lead: LeadRecord, q: LeadQualification, openTasks: Task[], now = Date.now(), { tasksLoaded = true } = {}): LeadInsights {
  const isOpen = OPEN.has(lead.status) && !lead.deletedAt
  const inactiveDays = Math.max(0, Math.floor((now - new Date(lead.lastActivityAt).getTime()) / DAY))
  const overdue = openTasks.filter((t) => t.isOverdue)
  const hasPhone = lead.phones.length > 0
  const hasEmail = lead.emails.length > 0

  // ---- Missing information, most useful first ----
  const missing: MissingItem[] = []
  if (!hasPhone) missing.push({ target: 'phone', label: 'Phone number' })
  if (!hasEmail) missing.push({ target: 'email', label: 'Email address' })
  if (!lead.requirement) missing.push({ target: 'requirement', label: 'What they need' })
  if (lead.budgetMinor === null) missing.push({ target: 'budget', label: 'Budget' })
  if (!q.timeline) missing.push({ target: 'timeline', label: 'Buying timeline' })
  if (!q.decisionMakers.length) missing.push({ target: 'decisionMakers', label: 'Decision-maker' })
  if (q.dealValueMinor === null) missing.push({ target: 'dealValue', label: 'Expected deal value' })
  if (!lead.ownerId) missing.push({ target: 'owner', label: 'Owner' })

  // ---- Health ----
  const factors: string[] = []
  let health = 70 + Math.round((lead.score - 50) / 5)
  const adjust = (points: number, factor?: string) => {
    health += points
    if (factor) factors.push(factor)
  }
  if (isOpen) {
    if (inactiveDays > 14) adjust(-40, `No activity for ${inactiveDays} days`)
    else if (inactiveDays > 7) adjust(-25, `Quiet for ${inactiveDays} days`)
    else if (inactiveDays > 3) adjust(-10, `Last touch ${inactiveDays} days ago`)
    else adjust(10, 'Recently active')
    if (overdue.length) adjust(-Math.min(30, overdue.length * 15), `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`)
    if (openTasks.length) adjust(0, 'Follow-up scheduled')
    else if (tasksLoaded) adjust(-15, 'No follow-up scheduled')
    else adjust(0, 'Follow-up status unavailable')
    if (!lead.ownerId) adjust(-15, 'Nobody owns it')
    if (lead.status === 'new' && !lead.firstRespondedAt && now - new Date(lead.createdAt).getTime() > 3_600_000)
      adjust(-10, 'Not contacted yet')
    const keyGaps = missing.filter((m) => ['requirement', 'budget', 'timeline', 'decisionMakers'].includes(m.target)).length
    adjust(-keyGaps * 5)
    if (q.priority === 'hot') adjust(5)
  }
  health = Math.max(0, Math.min(100, health))
  const [label, tone]: [string, InsightTone] = !isOpen
    ? [lead.deletedAt ? 'Deleted' : lead.status === 'converted' ? 'Converted' : 'Closed', 'neutral']
    : health >= 70
      ? ['Healthy', 'success']
      : health >= 45
        ? ['Needs attention', 'warning']
        : ['At risk', 'danger']

  // ---- Inactivity alert ----
  const inactivity =
    isOpen && inactiveDays > 7
      ? { tone: inactiveDays > 14 ? ('danger' as const) : ('warning' as const), message: `No activity in ${inactiveDays} days — leads go cold fast. Reach out today.` }
      : isOpen && inactiveDays > 3
        ? { tone: 'neutral' as const, message: `Last activity ${inactiveDays} days ago.` }
        : null

  // ---- Next best action ----
  let next: NextAction | null = null
  const firstName = lead.firstName ?? lead.displayName.split(' ')[0]
  if (lead.deletedAt) next = null
  else if (lead.status === 'lost') next = { kind: 'reopen', title: 'Re-open if they come back', reason: 'Lost leads can return to Contacted.' }
  else if (!isOpen) next = null
  else if (!lead.ownerId) next = { kind: 'claim', title: 'Claim this lead', reason: 'It has no owner, so nobody will follow up.' }
  else if (lead.status === 'new' && !lead.firstRespondedAt)
    next = hasPhone
      ? { kind: 'call', title: `Call ${firstName} now`, reason: 'First contact within an hour converts several times better.' }
      : hasEmail ? { kind: 'email', title: `Email ${firstName}`, reason: 'Start the conversation using their email address.' }
      : { kind: 'qualify', title: 'Add a phone number or email', reason: 'A contact method is needed before the first conversation.' }
  else if (overdue.length) next = { kind: 'overdue', title: `Overdue: ${overdue[0].title}`, reason: 'Clear overdue follow-ups before they cost the deal.' }
  else if (inactiveDays > 7)
    next = { kind: 'whatsapp', title: `Re-engage ${firstName}`, reason: `Nothing logged for ${inactiveDays} days. A short check-in message works well.` }
  else if (lead.status !== 'qualified' && (!lead.requirement || lead.budgetMinor === null || !q.timeline))
    next = { kind: 'qualify', title: 'Qualify: capture needs, budget and timeline', reason: 'You’ll know if this is worth pursuing.' }
  else if (lead.status === 'qualified')
    next = { kind: 'convert', title: 'Convert to contact and deal', reason: 'Qualified with a known need — move it into the pipeline.' }
  else if (lead.status === 'contacted')
    next = { kind: 'qualify', title: 'Mark as qualified', reason: 'Need, budget and timeline are captured.' }
  else if (tasksLoaded && !openTasks.length) next = { kind: 'schedule', title: 'Schedule the next follow-up', reason: 'Every open lead should have a next step.' }

  // ---- Conversion recommendations ----
  const recommendations: string[] = []
  if (isOpen) {
    if (!q.decisionMakers.some((d) => d.role === 'decision_maker')) recommendations.push('Find out who signs off — add the decision-maker.')
    if (q.objections.length) recommendations.push(`Address “${q.objections[0]}” before sending a proposal.`)
    if (lead.budgetMinor !== null && q.dealValueMinor !== null && q.dealValueMinor > lead.budgetMinor)
      recommendations.push('Expected value is above their budget — consider a smaller first order.')
    if (q.timeline === 'immediate' || q.timeline === '1_month') recommendations.push('Short timeline — book a meeting this week.')
    if (lead.enquiryCount > 1) recommendations.push(`They enquired ${lead.enquiryCount} times — strong intent, prioritise.`)
    if (tasksLoaded && !openTasks.length && next?.kind !== 'schedule') recommendations.push('No follow-up scheduled — add one so it doesn’t slip.')
  }

  return {
    health: { score: health, label, tone, factors },
    inactiveDays,
    inactivity,
    missing,
    next,
    recommendations: recommendations.slice(0, 3),
    overdue,
  }
}
