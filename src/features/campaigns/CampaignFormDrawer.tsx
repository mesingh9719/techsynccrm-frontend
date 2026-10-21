import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useId, useState } from 'react'
import { Copy, Check, Globe, Sparkles } from 'lucide-react'
import { Drawer } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { useOrg } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { buildUtmUrl, generateCampaignCode } from './api'
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  type Campaign,
  type CampaignInput,
  type CampaignObjective,
  type CampaignStatus,
  type CampaignType,
} from './types'

interface CampaignDraft {
  name: string
  code: string
  type: CampaignType
  objective: CampaignObjective
  status: CampaignStatus
  startDate: string
  endDate: string
  budget: string
  actualSpend: string
  landingUrl: string
  targetAudience: string
  description: string
  utmSource: string
  utmMedium: string
  utmContent: string
  utmTerm: string
  externalCampaignId: string
}

function initDraft(c?: Campaign | null): CampaignDraft {
  const today = new Date().toISOString().slice(0, 10)
  if (c) {
    return {
      name: c.name,
      code: c.code,
      type: c.type,
      objective: c.objective,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate ?? '',
      budget: c.budgetMinor != null ? (c.budgetMinor / 100).toFixed(2) : '',
      actualSpend: c.actualSpendMinor != null ? (c.actualSpendMinor / 100).toFixed(2) : '',
      landingUrl: c.landingUrl ?? '',
      targetAudience: c.targetAudience ?? '',
      description: c.description ?? '',
      utmSource: c.utm.utm_source ?? '',
      utmMedium: c.utm.utm_medium ?? '',
      utmContent: c.utm.utm_content ?? '',
      utmTerm: c.utm.utm_term ?? '',
      externalCampaignId: c.externalCampaignId ?? '',
    }
  }
  return {
    name: '',
    code: '',
    type: 'meta_ads',
    objective: 'lead_generation',
    status: 'active',
    startDate: today,
    endDate: '',
    budget: '',
    actualSpend: '',
    landingUrl: '',
    targetAudience: '',
    description: '',
    utmSource: 'facebook',
    utmMedium: 'paid_social',
    utmContent: '',
    utmTerm: '',
    externalCampaignId: '',
  }
}

function CampaignFormContent({
  campaign,
  onClose,
  onSave,
}: {
  campaign?: Campaign | null
  onClose: () => void
  onSave: (input: CampaignInput, id?: string) => Promise<unknown>
}) {
  const { organization } = useOrg()
  const notify = useToast()

  const [draft, setDraft] = useState<CampaignDraft>(() => initDraft(campaign))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const formId = useId()
  const guard = useUnsavedChanges(draft, onClose, busy)

  const setField = <K extends keyof CampaignDraft>(key: K, val: CampaignDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }))

  function handleTypeChange(nextType: CampaignType) {
    let source = draft.utmSource
    let medium = draft.utmMedium
    if (!campaign) {
      if (nextType === 'meta_ads') {
        source = 'facebook'
        medium = 'paid_social'
      } else if (nextType === 'google_ads') {
        source = 'google'
        medium = 'cpc'
      } else if (nextType === 'email') {
        source = 'newsletter'
        medium = 'email'
      } else if (nextType === 'sms') {
        source = 'whatsapp'
        medium = 'sms'
      } else if (nextType === 'website') {
        source = 'website'
        medium = 'organic'
      } else if (nextType === 'referral') {
        source = 'referral'
        medium = 'partner'
      }
    }
    setDraft((d) => ({ ...d, type: nextType, utmSource: source, utmMedium: medium }))
  }

  function handleNameChange(v: string) {
    const nextCode =
      !campaign && (!draft.code || draft.code === generateCampaignCode(draft.name))
        ? generateCampaignCode(v)
        : draft.code
    setDraft((d) => ({ ...d, name: v, code: nextCode }))
  }

  const generatedUrl = buildUtmUrl(draft.landingUrl, {
    utm_source: draft.utmSource || undefined,
    utm_medium: draft.utmMedium || undefined,
    utm_campaign: draft.code || undefined,
    utm_content: draft.utmContent || undefined,
    utm_term: draft.utmTerm || undefined,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const invalid: Record<string, string> = {}
    if (!draft.name.trim()) invalid.name = 'Enter a campaign name.'
    if (!draft.startDate) invalid.startDate = 'Choose a start date.'
    if (draft.endDate && draft.endDate < draft.startDate) invalid.endDate = 'End date must be on or after the start date.'
    if (draft.budget && (!Number.isFinite(Number(draft.budget)) || Number(draft.budget) < 0)) invalid.budgetMinor = 'Enter a positive amount or zero.'
    if (draft.actualSpend && (!Number.isFinite(Number(draft.actualSpend)) || Number(draft.actualSpend) < 0)) invalid.actualSpendMinor = 'Enter a positive amount or zero.'
    if (draft.landingUrl.trim() && !buildUtmUrl(draft.landingUrl, {})) invalid.landingUrl = 'Enter a valid http or https address.'
    setFieldErrors(invalid)
    if (Object.keys(invalid).length) { setError('Check the highlighted fields before saving.'); return }

    try {
      setBusy(true)
      setError(null)

      const budgetMinor = draft.budget.trim() ? Math.round(parseFloat(draft.budget) * 100) : null
      const actualSpendMinor = draft.actualSpend.trim() ? Math.round(parseFloat(draft.actualSpend) * 100) : null

      const input: CampaignInput = {
        name: draft.name.trim(),
        code: draft.code.trim() || generateCampaignCode(draft.name),
        type: draft.type,
        objective: draft.objective,
        status: draft.status,
        startDate: draft.startDate,
        currency: campaign?.currency ?? organization?.currency ?? 'INR',
        endDate: draft.endDate.trim() || null,
        budgetMinor,
        actualSpendMinor,
        landingUrl: draft.landingUrl.trim() ? buildUtmUrl(draft.landingUrl.trim(), {}) : null,
        targetAudience: draft.targetAudience.trim() || null,
        description: draft.description.trim() || null,
        utm: {
          utm_source: draft.utmSource.trim() || undefined,
          utm_medium: draft.utmMedium.trim() || undefined,
          utm_campaign: draft.code.trim() || generateCampaignCode(draft.name),
          utm_content: draft.utmContent.trim() || undefined,
          utm_term: draft.utmTerm.trim() || undefined,
        },
        externalCampaignId: draft.externalCampaignId.trim() || null,
      }

      await onSave(input, campaign?.id)
      notify({
        title: campaign ? 'Campaign updated' : 'Campaign created',
        description: `"${draft.name}" is ready for lead attribution and tracking.`,
      })
      onClose()
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fields)
      setError(err instanceof ApiError ? Object.values(err.fields)[0] ?? err.message : err instanceof Error ? err.message : 'Could not save campaign')
    } finally {
      setBusy(false)
    }
  }

  async function copyTrackingLink() {
    if (!generatedUrl) return
    try { await navigator.clipboard.writeText(generatedUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); notify({ title: 'Tracking link copied' }) } catch { notify({ tone: 'error', title: 'Couldn’t copy the link', description: 'Check clipboard permission and try again.' }) }
  }

  return (
    <>
    <Drawer open onClose={guard.requestClose} busy={busy} title={campaign ? 'Edit campaign' : 'Create campaign'} description="Campaign details, spend, and attribution tracking." footer={<>
      <Button variant="secondary" disabled={busy} onClick={guard.requestClose}>Cancel</Button>
      <Button type="submit" form={formId} loading={busy}>{campaign ? 'Save changes' : 'Create campaign'}</Button>
    </>}>
    <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}

      <Field label="Campaign name" error={fieldErrors.name} required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id} aria-describedby={describedBy}
            invalid={invalid}
            value={draft.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Q4 Meta Ads — High Intent Founders"
            required
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Channel / Type">
          {({ id, invalid, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} value={draft.type} onChange={(e) => handleTypeChange(e.target.value as CampaignType)}>
              {Object.entries(CAMPAIGN_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Objective">
          {({ id, invalid, describedBy }) => (
            <Select
              id={id} aria-describedby={describedBy} invalid={invalid}
              value={draft.objective}
              onChange={(e) => setField('objective', e.target.value as CampaignObjective)}
            >
              {Object.entries(CAMPAIGN_OBJECTIVE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          {({ id, invalid, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} value={draft.status} onChange={(e) => setField('status', e.target.value as CampaignStatus)}>
              {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Tracking code (slug)"
          hint={
            campaign
              ? 'Tracking codes stay fixed so existing links keep working.'
              : 'Used in the utm_campaign query tag'
          }
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id} aria-describedby={describedBy} invalid={invalid}
              value={draft.code}
              readOnly={Boolean(campaign)}
              onChange={(e) => setField('code', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="e.g. q4-meta-founders"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date" error={fieldErrors.startDate} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id} aria-describedby={describedBy} invalid={invalid}
              type="date"
              value={draft.startDate}
              onChange={(e) => setField('startDate', e.target.value)}
            />
          )}
        </Field>

        <Field label="End date" error={fieldErrors.endDate} optional>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id} aria-describedby={describedBy} invalid={invalid}
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(e) => setField('endDate', e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Budget (${campaign?.currency ?? organization?.currency ?? 'INR'})`} error={fieldErrors.budgetMinor}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id} aria-describedby={describedBy} invalid={invalid}
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 50000"
              value={draft.budget}
              onChange={(e) => setField('budget', e.target.value)}
            />
          )}
        </Field>

        <Field label={`Actual spend (${campaign?.currency ?? organization?.currency ?? 'INR'})`} error={fieldErrors.actualSpendMinor}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id} aria-describedby={describedBy} invalid={invalid}
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 24500"
              value={draft.actualSpend}
              onChange={(e) => setField('actualSpend', e.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="Landing page URL" error={fieldErrors.landingUrl} hint="Destination URL for your campaign ads or links">
        {({ id, invalid, describedBy }) => (
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
            <Input
              id={id} aria-describedby={describedBy} invalid={invalid}
              value={draft.landingUrl}
              onChange={(e) => setField('landingUrl', e.target.value)}
              placeholder="https://yourcompany.com/lead-page"
              className="pl-9!"
            />
          </div>
        )}
      </Field>

      {/* UTM Attribution Parameters */}
      <div className="rounded-xl border border-line bg-surface-subtle p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand-700" />
          <span className="text-xs font-semibold text-ink uppercase tracking-wide">Attribution & UTM Tags</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="utm_source">
            {({ id, invalid, describedBy }) => (
              <Input
                id={id} aria-describedby={describedBy} invalid={invalid}
                value={draft.utmSource}
                onChange={(e) => setField('utmSource', e.target.value)}
                placeholder="facebook, google, newsletter"
                className="h-8! text-xs"
              />
            )}
          </Field>

          <Field label="utm_medium">
            {({ id, invalid, describedBy }) => (
              <Input
                id={id} aria-describedby={describedBy} invalid={invalid}
                value={draft.utmMedium}
                onChange={(e) => setField('utmMedium', e.target.value)}
                placeholder="paid_social, cpc, email"
                className="h-8! text-xs"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="utm_content" optional>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id} aria-describedby={describedBy} invalid={invalid}
                value={draft.utmContent}
                onChange={(e) => setField('utmContent', e.target.value)}
                placeholder="banner_v1, carousel, cta_top"
                className="h-8! text-xs"
              />
            )}
          </Field>

          <Field label="utm_term" optional>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id} aria-describedby={describedBy} invalid={invalid}
                value={draft.utmTerm}
                onChange={(e) => setField('utmTerm', e.target.value)}
                placeholder="b2b crm, lead manager"
                className="h-8! text-xs"
              />
            )}
          </Field>
        </div>

        {generatedUrl && (
          <div className="mt-2 space-y-1">
            <span className="text-xs font-medium text-muted">Generated tracking URL:</span>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{generatedUrl}</span>
              <Button size="sm" variant="ghost" onClick={copyTrackingLink} type="button">
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Field label="Target audience" optional>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id} aria-describedby={describedBy} invalid={invalid}
            value={draft.targetAudience}
            onChange={(e) => setField('targetAudience', e.target.value)}
            placeholder="e.g. Founders, CXOs, Tier 1/2 Cities"
          />
        )}
      </Field>

      <Field label="Notes / Campaign strategy" optional>
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id} aria-describedby={describedBy} invalid={invalid}
            rows={2}
            value={draft.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Outline target metrics, creative variations, or campaign schedule..."
          />
        )}
      </Field>

    </form>
    </Drawer>
    {guard.confirmation}
    </>
  )
}

export function CampaignFormDrawer({
  open,
  campaign,
  onClose,
  onSave,
}: {
  open: boolean
  campaign?: Campaign | null
  onClose: () => void
  onSave: (input: CampaignInput, id?: string) => Promise<unknown>
}) {
  return open ? <CampaignFormContent key={campaign?.id ?? 'create'} campaign={campaign} onClose={onClose} onSave={onSave} /> : null
}
