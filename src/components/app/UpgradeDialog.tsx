import { useState } from 'react'
import { Check, CircleCheck, Sparkles } from 'lucide-react'
import { features, pricing } from '../../services/content'
import { requestUpgrade } from '../../services/organizations'
import { ApiError } from '../../services/http'
import { useOrg } from '../../lib/useOrg'
import type { PlanId } from '../../types'
import { Button } from '../ui/Button'
import { Field, FormAlert, Textarea } from '../ui/Form'
import { Dialog } from './Dialog'

export interface UpgradePrompt {
  reason: 'limit' | 'feature'
  message?: string
  feature?: string
  requiredPlan?: string
  resource?: string
}

/** Plan feature key (backend config/plans.js) → the marketing copy that explains it (features.json). */
const FEATURE_COPY: Record<string, { category: string; title: string }> = {
  whatsapp: { category: 'communication', title: 'WhatsApp inbox' },
  emailSync: { category: 'communication', title: 'Email sync' },
  callRecording: { category: 'communication', title: 'Calling' },
  automation: { category: 'automation', title: 'Workflow builder' },
  aiAssistant: { category: 'automation', title: 'AI follow-up assistant' },
  sequences: { category: 'automation', title: 'Sequences' },
  approvals: { category: 'automation', title: 'Approvals' },
  quotes: { category: 'quotes', title: 'Quote builder' },
  forecasting: { category: 'pipeline', title: 'Weighted forecast' },
  standardReports: { category: 'analytics', title: 'Live dashboards' },
  customReports: { category: 'analytics', title: 'Live dashboards' },
  scheduledReports: { category: 'analytics', title: 'Scheduled reports' },
  marketplaceSync: { category: 'leads', title: 'Unified lead inbox' },
}

function featureCopy(feature?: string) {
  const ref = feature ? FEATURE_COPY[feature] : undefined
  if (!ref) return null
  return features.categories.find((c) => c.id === ref.category)?.features.find((f) => f.title === ref.title) ?? null
}

const PAID: PlanId[] = ['growth', 'business', 'enterprise']
/** The plan above the current one, for limit prompts that don't name one. */
const nextPlan = (current?: PlanId): PlanId => (current === 'growth' ? 'business' : current === 'business' ? 'enterprise' : 'growth')

/**
 * Shown when the server says a limit was reached or a feature isn't in the plan, and from locked
 * nav items. Until billing (M16) exists, "Request upgrade" sends the request to our sales team.
 */
export function UpgradeDialog({ prompt, onClose }: { prompt: UpgradePrompt | null; onClose: () => void }) {
  const { summary } = useOrg()
  const target = (PAID.includes(prompt?.requiredPlan as PlanId) ? prompt?.requiredPlan : nextPlan(summary?.plan)) as Exclude<PlanId, 'starter'>
  const plan = pricing.plans.find((p) => p.id === target) ?? pricing.plans.find((p) => p.id === 'growth')!
  const copy = featureCopy(prompt?.feature)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = sent ? 'Request sent' : prompt?.reason === 'limit' ? 'You’ve reached your plan’s limit' : copy ? `${copy.title} is on ${plan.name}` : `Available on ${plan.name}`
  const description = sent
    ? `Thanks — our team will get in touch within one business day to move you to ${plan.name}.`
    : (prompt?.message ?? (prompt?.reason === 'limit' ? 'Upgrade to keep adding more.' : `This feature is part of the ${plan.name} plan and above.`))

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await requestUpgrade({ plan: target, message: message.trim() || undefined })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(prompt)}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        sent ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button to="/pricing" variant="secondary" onClick={onClose}>
              Compare plans
            </Button>
            {summary && (
              <Button onClick={submit} loading={busy}>
                <Sparkles className="size-4" aria-hidden="true" />
                Request {plan.name}
              </Button>
            )}
          </>
        )
      }
    >
      {sent ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CircleCheck className="size-4" aria-hidden="true" />
          We’ve emailed our sales team. You can keep working in the meantime.
        </p>
      ) : (
        <>
          {copy && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">{copy.description}</p>}
          <p className="text-sm font-medium text-zinc-900">
            {plan.name} includes{plan.userLimit ? ` · ${plan.userLimit.toLowerCase()}` : ''}:
          </p>
          <ul className="mt-3 space-y-2">
            {plan.features
              .filter((f) => !f.endsWith(':'))
              .slice(0, 6)
              .map((feature) => (
                <li key={feature} className="flex gap-2 text-sm text-zinc-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {feature}
                </li>
              ))}
          </ul>
          {summary && (
            <Field label="Anything we should know?" optional className="mt-5">
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Team size, timeline, questions about pricing…" />
              )}
            </Field>
          )}
          {error && (
            <div className="mt-4">
              <FormAlert>{error}</FormAlert>
            </div>
          )}
        </>
      )}
    </Dialog>
  )
}
