/** Shared CRM record types (M07/M08). They mirror the backend services' `present()` shapes. */

export type TagColor = 'zinc' | 'brand' | 'emerald' | 'amber' | 'red' | 'violet' | 'sky' | 'pink'

export interface Tag {
  id: string
  name: string
  color: TagColor
  /** Records using it (GET /tags only). */
  usage?: number
}

export interface EmailPoint {
  value: string
  label: string | null
  primary: boolean
}

export interface PhonePoint {
  /** null when the number couldn't be normalised (kept as typed, never matched as a duplicate). */
  e164: string | null
  raw: string
  label: string | null
  primary: boolean
  whatsapp: boolean
}

export interface OwnerSummary {
  id: string
  fullName: string
  email: string
}

export type CustomFieldEntity = 'contact' | 'company' | 'lead' | 'deal'
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'datetime' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone' | 'user'
export type CustomFieldValues = Record<string, unknown>

export interface CustomFieldOption {
  value: string
  label: string
  color?: TagColor
}

export interface CustomFieldDefinition {
  id: string
  entityType: CustomFieldEntity
  key: string
  label: string
  type: CustomFieldType
  options: CustomFieldOption[] | null
  required: boolean
  position: number
  archived: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Address {
  line1: string | null
  line2: string | null
  city: string | null
  stateCode: string | null
  pincode: string | null
  country: string | null
}

interface RecordBase {
  id: string
  ownerId: string | null
  owner: OwnerSummary | null
  tags: Tag[]
  customFields: CustomFieldValues
  lastActivityAt: string
  createdById: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type LifecycleStage = 'subscriber' | 'lead' | 'customer' | 'inactive'

export interface ContactRecord extends RecordBase {
  firstName: string | null
  lastName: string | null
  displayName: string
  title: string | null
  emails: EmailPoint[]
  phones: PhonePoint[]
  primaryEmail: string | null
  primaryPhoneE164: string | null
  lifecycleStage: LifecycleStage
  whatsappOptInAt: string | null
  emailOptInAt: string | null
  optOutAt: string | null
  consentSource: string | null
  source: string | null
  mergedIntoId: string | null
  companies: { id: string; name: string; role: string | null; isPrimary: boolean }[]
}

export interface CompanyRecord extends RecordBase {
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  gstin: string | null
  phoneE164: string | null
  phoneRaw: string | null
  email: string | null
  website: string | null
  billingAddress: Address | null
  shippingAddress: Address | null
  mergedIntoId: string | null
  contactCount: number
}

export interface CompanyContact {
  id: string
  displayName: string
  title: string | null
  primaryEmail: string | null
  primaryPhoneE164: string | null
  ownerId: string | null
  role: string | null
  isPrimary: boolean
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'junk'
export type JunkReason = 'spam' | 'wrong_number' | 'test' | 'duplicate' | 'other'

export interface ScoreBreakdown {
  fit: { source: number; phone: number; email: number; company: number; budget: number; total: number }
  engagement: { recentInbound: number; touches: number; qualified: number; total: number }
  decay: number
  total: number
}

export interface LeadRecord extends RecordBase {
  firstName: string | null
  lastName: string | null
  displayName: string
  emails: EmailPoint[]
  phones: PhonePoint[]
  primaryEmail: string | null
  primaryPhoneE164: string | null
  companyName: string | null
  requirement: string | null
  budgetMinor: number | null
  city: string | null
  stateCode: string | null
  pincode: string | null
  sourceId: string | null
  source: { id: string; name: string; key: string | null } | null
  sourceDetail: string | null
  utm: Record<string, string> | null
  status: LeadStatus
  lostReasonId: string | null
  lostReason: { id: string; name: string } | null
  lostNote: string | null
  junkReason: JunkReason | null
  score: number
  scoreBreakdown: ScoreBreakdown | null
  assignedAt: string | null
  firstRespondedAt: string | null
  firstResponseSeconds: number | null
  enquiryCount: number
  /** Latest repeat enquiry; older API responses may omit these fields. */
  latestSource?: { id: string; name: string; key: string | null } | null
  latestEnquiryAt?: string | null
  contactId: string | null
  isExistingCustomer: boolean
  previousLeadId: string | null
  convertedAt: string | null
  convertedById: string | null
  convertedContactId: string | null
  convertedCompanyId: string | null
  convertedDealId: string | null
}

export interface LeadSource {
  id: string
  name: string
  key: string | null
  isSystem: boolean
  scoreWeight: number
  position: number
  archived: boolean
  leadCount?: number
}

export interface LostReason {
  id: string
  entityType: 'lead' | 'deal'
  name: string
  position: number
  archived: boolean
}

export interface SavedView {
  id: string
  entityType: 'lead' | 'contact' | 'company' | 'deal'
  name: string
  filters: Record<string, string>
  columns: string[]
  isShared: boolean
  userId: string
  mine: boolean
  canEdit: boolean
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
  total?: number
}

export interface Duplicate {
  id: string
  displayName: string
  matchedOn: 'email' | 'phone' | 'domain' | 'gstin' | 'name'
  value?: string
  /** Lead duplicate checks return leads and contacts. */
  entityType?: 'lead' | 'contact'
  status?: LeadStatus
}

export interface BulkResult {
  succeeded: string[]
  failed: { id: string; code: string }[]
}

export type BulkAction = 'assign' | 'tag' | 'untag' | 'delete' | 'status'

// ---------- Pipelines & deals (M09) ----------

export type StageType = 'open' | 'won' | 'lost'
export type DealStatus = 'open' | 'won' | 'lost'

export interface PipelineStage {
  id: string
  pipelineId: string
  name: string
  type: StageType
  position: number
  probability: number
  rottingDays: number | null
  /** Core keys (valueMinor, expectedCloseDate, companyId, contacts, ownerId) or "cf.<key>" */
  requiredFields: string[]
  dealCount?: number
}

export interface Pipeline {
  id: string
  name: string
  isDefault: boolean
  position: number
  templateKey: string | null
  archived?: boolean
  /** Over the plan's pipeline limit after a downgrade: deals can only be marked won/lost. */
  readOnly?: boolean
  dealCount?: number
  stages: PipelineStage[]
}

export interface PipelineTemplate {
  key: string
  label: string
  name: string
  stages: { name: string; probability: number; rottingDays: number | null }[]
}

export interface DealContactLink {
  contactId: string
  role: string | null
  isPrimary: boolean
  displayName: string
  primaryEmail: string | null
  primaryPhoneE164: string | null
}

export interface DealRecord extends RecordBase {
  title: string
  pipelineId: string
  stageId: string
  status: DealStatus
  valueMinor: number
  currency: string
  probabilityOverride: number | null
  probability: number
  weightedMinor: number
  expectedCloseDate: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  leadId: string | null
  sourceId: string | null
  source: { id: string; name: string } | null
  position: number
  stageEnteredAt: string
  daysInStage: number
  isRotting: boolean
  wonAt: string | null
  lostAt: string | null
  closedAt: string | null
  lostReasonId: string | null
  lostReason: { id: string; name: string } | null
  lostNote: string | null
  stage: Omit<PipelineStage, 'dealCount'>
  pipeline: { id: string; name: string }
  contacts: DealContactLink[]
}

export interface BoardColumn extends PipelineStage {
  count: number
  totalMinor: number
  weightedMinor: number
  hasMore: boolean
  deals: DealRecord[]
}

export interface Board {
  pipeline: { id: string; name: string; readOnly: boolean }
  closedWithinDays: number
  stages: BoardColumn[]
}

export interface StageHistoryEntry {
  id: string
  movedAt: string
  secondsInPrevStage: number | null
  from: { id: string; name: string; type: StageType } | null
  to: { id: string; name: string; type: StageType }
  pipelineChanged: boolean
  movedBy: OwnerSummary | null
}

export interface ForecastBucket {
  period: string
  label: string
  totalMinor: number
  weightedMinor: number
  count: number
  byOwner: { ownerId: string | null; name: string; totalMinor: number; weightedMinor: number; count: number }[]
}

export interface Forecast {
  period: 'month' | 'quarter'
  currency: string
  periods: ForecastBucket[]
  noCloseDate: { totalMinor: number; weightedMinor: number; count: number }
  totals: { totalMinor: number; weightedMinor: number; count: number }
}

// ---------- Activities & tasks (M10) ----------

export type RecordType = 'lead' | 'contact' | 'company' | 'deal'
export type ActivityType = 'note' | 'call' | 'meeting' | 'site_visit' | 'whatsapp' | 'email' | 'sms' | 'system'
export type CallOutcome = 'connected' | 'no_answer' | 'busy' | 'wrong_number' | 'callback_requested' | 'voicemail'

export interface Activity {
  id: string
  type: ActivityType
  entityType: RecordType
  entityId: string
  subject: string | null
  body: string | null
  occurredAt: string
  endAt: string | null
  direction: 'inbound' | 'outbound' | null
  outcome: CallOutcome | null
  durationSeconds: number | null
  location: { text?: string; lat?: number; lng?: number } | null
  meta: Record<string, unknown>
  isPinned: boolean
  actorId: string | null
  actor: OwnerSummary | null
  record: { entityType: RecordType; entityId: string; name: string | null }
  participants: ({ userId: string; name: string } | { contactId: string; name: string })[]
  mentions: { userId: string; name: string }[]
  editedAt: string | null
  createdAt: string
  canEditNow: boolean
}

export interface TimelinePage extends Page<Activity> {
  pinned?: Activity[]
}

export type TaskType = 'todo' | 'call' | 'meeting' | 'follow_up' | 'email' | 'whatsapp'
export type TaskPriority = 'low' | 'normal' | 'high'
export type TaskView = 'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | 'open'

export interface TaskRecurrence {
  freq: 'daily' | 'weekly' | 'monthly'
  interval?: number
  byWeekday?: number[]
  byMonthDay?: number
  count?: number
  until?: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  type: TaskType
  priority: TaskPriority
  status: 'open' | 'completed' | 'cancelled'
  dueAt: string | null
  allDay: boolean
  reminderOffsetMinutes: number | null
  recurrence: TaskRecurrence | null
  seriesId: string | null
  entityType: RecordType | null
  entityId: string | null
  record: { entityType: RecordType; entityId: string; name: string | null } | null
  assigneeId: string
  assignee: OwnerSummary | null
  createdBy: OwnerSummary | null
  completedAt: string | null
  isOverdue: boolean
  isDueToday: boolean
  createdAt: string
  updatedAt: string
}
