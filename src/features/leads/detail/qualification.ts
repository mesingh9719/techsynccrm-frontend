import qualificationJson from './config/qualification-options.json'

export type LeadPriority = 'hot' | 'warm' | 'cold'
export type BuyingTimeline = 'immediate' | '1_month' | '3_months' | '6_months' | 'exploring'
export type DecisionRole = 'decision_maker' | 'influencer' | 'user' | 'finance'

export interface DecisionMaker {
  id: string
  name: string
  role: DecisionRole
  note?: string
}

export interface LeadQualification {
  priority: LeadPriority | null
  /** Expected deal value in paise (minor units), like budgetMinor. */
  dealValueMinor: number | null
  expectedCloseDate: string | null
  timeline: BuyingTimeline | null
  preferences: string | null
  objections: string[]
  decisionMakers: DecisionMaker[]
  updatedAt: string | null
}

export type TemplateChannel = 'whatsapp' | 'sms' | 'email' | 'note'

export interface MessageTemplate {
  id: string
  channel: TemplateChannel
  name: string
  subject?: string
  body: string
}

export const qualificationOptions = qualificationJson as {
  priorities: { value: LeadPriority; label: string; hint: string }[]
  timelines: { value: BuyingTimeline; label: string }[]
  objections: string[]
  decisionRoles: { value: DecisionRole; label: string }[]
}

export const emptyQualification: LeadQualification = {
  priority: null,
  dealValueMinor: null,
  expectedCloseDate: null,
  timeline: null,
  preferences: null,
  objections: [],
  decisionMakers: [],
  updatedAt: null,
}
