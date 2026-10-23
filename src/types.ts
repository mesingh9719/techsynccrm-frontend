/** Shared content types. These mirror the JSON in src/data and the shape a real CMS/API should return. */

export type IconName = string

export interface NavLinkItem {
  label: string
  to: string
  description?: string
  icon?: IconName
}

export interface NavGroup {
  label: string
  to?: string
  items?: NavLinkItem[]
}

export interface FooterColumn {
  title: string
  links: NavLinkItem[]
}

export interface Feature {
  icon: IconName
  title: string
  description: string
}

export interface FeatureCategory {
  id: string
  icon: IconName
  eyebrow: string
  title: string
  description: string
  points: string[]
  features: Feature[]
}

export type Currency = 'INR' | 'USD'
export type BillingCycle = 'monthly' | 'annual'

export interface Plan {
  id: string
  name: string
  tagline: string
  /** Per user per month. `null` means custom pricing. */
  price: Record<Currency, Record<BillingCycle, number> | null>
  highlighted?: boolean
  badge?: string
  cta: { label: string; to: string }
  userLimit: string
  features: string[]
}

export type ComparisonValue = boolean | string

export interface ComparisonGroup {
  group: string
  rows: { label: string; values: Record<string, ComparisonValue> }[]
}

export interface Faq {
  question: string
  answer: string
}

export interface Testimonial {
  quote: string
  name: string
  role: string
  company: string
  metric?: string
  /** True while we wait for approved customer quotes. */
  placeholder?: boolean
}

export interface Industry {
  id: string
  icon: IconName
  name: string
  headline: string
  summary: string
  challenges: string[]
  solutions: { title: string; description: string }[]
  metric: { value: string; label: string }
}

export interface TeamSolution {
  icon: IconName
  team: string
  description: string
  outcomes: string[]
}

export type IntegrationStatus = 'Available' | 'Beta' | 'Coming soon'

export interface Integration {
  id: string
  name: string
  category: string
  description: string
  status: IntegrationStatus
  popular?: boolean
  /** Monogram background, used in place of third-party logos. */
  color: string
}

export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }

export interface Author {
  name: string
  role: string
}

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  category: string
  author: Author
  date: string
  readMinutes: number
  featured?: boolean
  body: ContentBlock[]
}

export interface HelpCategory {
  id: string
  icon: IconName
  title: string
  description: string
}

export interface HelpArticle {
  slug: string
  category: string
  title: string
  summary: string
  updated: string
  body: ContentBlock[]
}

export interface LegalSection {
  id: string
  title: string
  body: ContentBlock[]
}

export interface LegalDocument {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export interface TeamMember {
  name: string
  role: string
  bio: string
}

export interface Office {
  city: string
  address: string
  phone: string
  email: string
}

export type PlanId = 'starter' | 'growth' | 'business' | 'enterprise'

export type LimitKey = 'users' | 'records' | 'pipelines' | 'customFields' | 'workflowRules' | 'webForms' | 'storageGb'

/** What the workspace's plan includes (backend config/plans.js). Limits: null = unlimited. */
export interface Entitlements {
  limits: Record<LimitKey, number | null>
  features: string[]
  /** Features this plan lacks → the cheapest plan that has them. */
  upgrades: Record<string, PlanId | null>
}

/** Usage shown on Settings → Plan (a cache; limits are enforced live by the server). */
export interface OrganizationUsage {
  users: number
  records: number
  pipelines: number
  storageBytes: number
  updatedAt: string
}

export type MemberRole = 'owner' | 'admin' | 'manager' | 'sales_rep' | 'viewer'

/** The workspace a session is signed in to (embedded in AuthUser). */
export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  plan: PlanId
  role: MemberRole
  /** The member's permissions (backend config/permissions.js); read through useCan. */
  permissions: string[]
  /** Members must have 2FA on to use this workspace. */
  require2fa: boolean
}

/** Full workspace settings (GET /api/organizations/current). */
export interface Organization {
  unreadNotificationCount?: number
  id: string
  name: string
  slug: string
  industry: string | null
  teamSize: string | null
  logoFileId: string | null
  logoUrl: string | null
  timezone: string
  country: string
  stateCode: string | null
  currency: 'INR' | 'USD'
  locale: string
  fiscalYearStartMonth: number
  gstin: string | null
  legalName: string | null
  address: { line1: string | null; line2: string | null; city: string | null; pincode: string | null } | null
  plan: PlanId
  trialEndsAt: string | null
  /** Whole days left in the trial in the workspace's time zone (0 = last day), or null. */
  trialDaysLeft: number | null
  trialActive: boolean
  /** A downgrade left more members than seats: the owner must choose who stays. */
  seatSelectionRequired: boolean
  entitlements: Entitlements
  usage: OrganizationUsage
  require2fa: boolean
  createdAt: string
  updatedAt: string
}

/** The signed-in user as returned by the API. */
export interface AuthUser {
  hasPassword?: boolean
  id: string
  fullName: string
  email: string
  emailVerified: boolean
  onboardingCompleted: boolean
  jobRole: string | null
  phone: string | null
  goals: string[]
  createdAt: string
  avatarFileId: string | null
  avatarUrl: string | null
  /** Personal time zone override (falls back to the workspace's). */
  timezone: string | null
  locale: string | null
  twoFactorEnabled: boolean
  /** New email waiting for confirmation, if a change is in progress. */
  pendingEmail: string | null
  /** False when the Terms/Privacy Policy changed since the user last accepted. */
  termsUpToDate: boolean
  /** Active workspace, or null until onboarding creates one. */
  organization: OrganizationSummary | null
}

// ---------- Team (M04) ----------

export interface Member {
  userId: string
  fullName: string
  email: string
  role: MemberRole
  status: 'active' | 'invited' | 'deactivated'
  title: string | null
  joinedAt: string | null
  deactivatedAt: string | null
  twoFactorEnabled: boolean
  teams: { id: string; name: string; isManager: boolean }[]
  lastActiveAt: string | null
}

export interface MemberOption {
  userId: string
  fullName: string
  email: string
  role: MemberRole
}

export interface Invitation {
  id: string
  email: string
  role: MemberRole
  teamIds: string[]
  status: 'pending' | 'expired'
  expiresAt: string
  lastSentAt: string
  createdAt: string
  invitedByName: string | null
}

export interface Team {
  id: string
  name: string
  createdAt: string
  members: { userId: string; isManager: boolean; fullName: string; email: string | null }[]
}

// ---------- Account (M05) ----------

export interface UserSession {
  id: string
  userAgent: string | null
  ip: string | null
  device: { browser: string; os: string; label: string }
  startedAt: string
  lastActiveAt: string
  expiresAt: string
  current: boolean
}
