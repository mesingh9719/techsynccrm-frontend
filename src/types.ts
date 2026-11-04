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
  /** Base role; with a custom role this is its tier and `roleId` / `roleName` name the custom role. */
  role: MemberRole
  roleId: string | null
  roleName: string
  /** The member's effective permissions (backend services/roleAccess.service.js); read through useCan. */
  permissions: string[]
  /** Fingerprint of `permissions`; workspace responses send the current one as X-Access-Version. */
  accessVersion: string
  /** Members must have 2FA on to use this workspace. */
  require2fa: boolean
}

/** Full workspace settings (GET /api/organizations/current). */
export interface Organization {
  unreadNotificationCount?: number
  id: string
  name: string
  slug: string
  /** Row of the industries master list; null when not chosen. */
  industryId: string | null
  industry: { id: string; slug: string; name: string; icon: string } | null
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
  /** Built-in role, or the tier of their custom role (`roleId` / `roleName`). */
  role: MemberRole
  roleId: string | null
  roleName: string | null
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
  roleId: string | null
  roleName: string | null
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

// ---------- Roles (RBAC) ----------

export type PermissionScope = 'all' | 'team' | 'own'

/**
 * One action in a module of the roles screen. Record modules: `key` is the action (`list`) and
 * the permission is `<module>.<key>`; other modules: `key` is the whole permission.
 * `scoped`: granted as `<permission>.<scope>` with the module's scope.
 */
export interface ModuleAction {
  key: string
  label: string
  description?: string
  scoped?: boolean
  scopes?: PermissionScope[]
  /** Other actions of the same module this one needs. */
  requires?: string[]
  /** Only the Owner role holds it. */
  ownerOnly?: boolean
  /** Only the locked Owner and Admin roles hold it. */
  adminOnly?: boolean
}

/** A card on the roles screen (backend config/permissions.js MODULES). */
export interface PermissionModule {
  key: string
  label: string
  description: string
  /** A record module: switched on by `<key>.read.<scope>`, with a "which records" choice. */
  records: boolean
  /** Other scoped modules (reports): the permission that switches it on. */
  access?: string
  scopes?: PermissionScope[]
  actions: ModuleAction[]
}

/** GET /api/roles/catalogue */
export interface PermissionCatalogue {
  modules: PermissionModule[]
  scopes: PermissionScope[]
  defaults: Record<MemberRole, string[]>
  colors: string[]
}

export interface Role {
  /** Built-in roles: the key (`manager`). Custom roles: the row id. */
  id: string
  system: boolean
  key: MemberRole | null
  name: string
  description: string | null
  color: string | null
  /** Owner and Admin: never editable. */
  locked: boolean
  /** Built-in roles: differs from the defaults. Custom roles: always true. */
  customised: boolean
  /** The current member may edit it. */
  editable: boolean
  permissions: string[]
  defaults: string[] | null
  memberCount: number
  /** For STALE_UPDATE checks; 0 while a built-in role is at its defaults. */
  version: number
  updatedAt: string | null
}

/** GET /api/roles */
export interface RoleList {
  roles: Role[]
  canManage: boolean
}

export interface RoleProblem {
  permission: string
  message: string
  kind: 'invalid' | 'combination'
}

/** POST /api/roles/preview */
export interface RolePreview {
  problems: RoleProblem[]
  permissions: string[]
  changes: { added: string[]; removed: string[] }
  affected: { count: number; members: { userId: string; fullName: string }[] }
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
