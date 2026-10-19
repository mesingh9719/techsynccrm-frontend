/**
 * Marketing content access layer (see also site.ts, blog.ts, help.ts, legal.ts — split so each
 * route only downloads the content it needs).
 *
 * Pages read content through these accessors rather than importing JSON directly.
 * To move to a CMS or API, swap the implementation here (e.g. fetch + cache, or a route loader)
 * and keep the same return types — pages don't need to change.
 */
import featuresJson from '../data/features.json'
import pricingJson from '../data/pricing.json'
import faqsJson from '../data/faqs.json'
import testimonialsJson from '../data/testimonials.json'
import solutionsJson from '../data/solutions.json'
import integrationsJson from '../data/integrations.json'
import companyJson from '../data/company.json'
import crmDemoJson from '../data/crm-demo.json'
import type {
  ComparisonGroup,
  Faq,
  Feature,
  FeatureCategory,
  Industry,
  Integration,
  Office,
  Plan,
  TeamMember,
  TeamSolution,
  Testimonial,
} from '../types'

export const features = {
  categories: featuresJson.categories as FeatureCategory[],
  platform: featuresJson.platform as Feature[],
}

export const pricing = {
  annualDiscountLabel: pricingJson.annualDiscountLabel,
  plans: pricingJson.plans as Plan[],
  comparison: pricingJson.comparison as ComparisonGroup[],
  faqs: pricingJson.faqs as Faq[],
}

export const faqs = faqsJson as Faq[]
export const testimonials = testimonialsJson as Testimonial[]

export const solutions = {
  industries: solutionsJson.industries as Industry[],
  teams: solutionsJson.teams as TeamSolution[],
}

export const integrations = integrationsJson as Integration[]
export const integrationCategories = Array.from(new Set(integrations.map((i) => i.category)))

export const company = {
  ...companyJson,
  team: companyJson.team as TeamMember[],
  offices: companyJson.offices as Office[],
}

export const crmDemo = crmDemoJson
export type DemoDeal = (typeof crmDemoJson.deals)[number]
export type DemoLead = (typeof crmDemoJson.leads)[number]
