import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CircleDollarSign, Handshake, UserRound, Users } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Field, Input, MoneyInput, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { FieldRow, FormDrawer, FormSection } from '../../components/app/FormDrawer'
import { UserPicker } from '../../components/app/UserPicker'
import { listCompanies } from '../companies/api'
import { listContacts } from '../contacts/api'
import { CustomFieldsSection } from '../crm/components/CustomFieldInput'
import { LinkedRecordList } from '../crm/components/LinkedRecords'
import { RecordPicker, type PickerOption } from '../crm/components/RecordPicker'
import { TagPicker } from '../crm/components/Tags'
import { fieldErrorsUnder, formatPhone, minorToRupeesText, rupeesToMinor } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import type { CustomFieldValues, DealRecord } from '../crm/types'
import { useLeadSources } from '../leads/api'
import { createDeal, updateDeal, usePipelines, type DealInput } from './api'

interface Draft {
  title: string
  pipelineId: string
  stageId: string
  value: string
  expectedCloseDate: string
  company: PickerOption | null
  contacts: { option: PickerOption; role: string; isPrimary: boolean }[]
  ownerId: string | null
  sourceId: string
  probabilityOverride: string
  tagIds: string[]
  customFields: CustomFieldValues
}

/**
 * Create / edit a deal. Stage changes after creation go through the board or the stage stepper
 * (so stage rules apply); the drawer edits everything else.
 */
export function DealFormDrawer({
  open,
  onClose,
  deal = null,
  defaults,
}: {
  open: boolean
  onClose: () => void
  deal?: DealRecord | null
  defaults?: { pipelineId?: string; stageId?: string; company?: PickerOption; contact?: PickerOption }
}) {
  const { user } = useAuth()
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const canAssign = useCan('records.assign')
  const pipelines = usePipelines()
  const sources = useLeadSources()
  const [draft, setDraft] = useState<Draft>(() => ({
    title: deal?.title ?? '',
    pipelineId: deal?.pipelineId ?? defaults?.pipelineId ?? '',
    stageId: deal?.stageId ?? defaults?.stageId ?? '',
    value: minorToRupeesText(deal?.valueMinor),
    expectedCloseDate: deal?.expectedCloseDate ?? '',
    company: deal?.company ? { id: deal.company.id, label: deal.company.name } : (defaults?.company ?? null),
    contacts: deal?.contacts.map((c) => ({ option: { id: c.contactId, label: c.displayName }, role: c.role ?? '', isPrimary: c.isPrimary })) ?? (defaults?.contact ? [{ option: defaults.contact, role: '', isPrimary: true }] : []),
    ownerId: deal ? deal.ownerId : (user?.id ?? null),
    sourceId: deal?.sourceId ?? '',
    probabilityOverride: deal?.probabilityOverride !== null && deal?.probabilityOverride !== undefined ? String(deal.probabilityOverride) : '',
    tagIds: deal?.tags.map((t) => t.id) ?? [],
    customFields: deal?.customFields ?? {},
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const livePipelines = (pipelines.data ?? []).filter((p) => !p.archived && !p.readOnly)
  const pipeline = livePipelines.find((p) => p.id === draft.pipelineId) ?? livePipelines.find((p) => p.isDefault) ?? livePipelines[0]
  const stages = (pipeline?.stages ?? []).filter((s) => s.type === 'open')
  const stageId = stages.some((s) => s.id === draft.stageId) ? draft.stageId : stages[0]?.id

  function close() {
    guard.markSaved()
    setErrors({})
    setServerError(null)
    onClose()
  }

  async function submit() {
    if (draft.value.trim() && rupeesToMinor(draft.value) === null) return setErrors({ valueMinor: 'Enter an amount in rupees' })
    setBusy(true)
    setErrors({})
    setServerError(null)
    const input: DealInput = {
      title: draft.title.trim(),
      valueMinor: rupeesToMinor(draft.value) ?? 0,
      expectedCloseDate: draft.expectedCloseDate || null,
      companyId: draft.company?.id ?? null,
      contacts: draft.contacts.map((c) => ({ contactId: c.option.id, role: c.role.trim() || null, isPrimary: c.isPrimary })),
      ownerId: draft.ownerId,
      sourceId: draft.sourceId || null,
      probabilityOverride: draft.probabilityOverride === '' ? null : Math.max(0, Math.min(100, Number(draft.probabilityOverride))),
      tagIds: draft.tagIds,
      customFields: draft.customFields,
    }
    try {
      const saved = deal ? await updateDeal(deal.id, input, deal.updatedAt) : await createDeal({ ...input, title: input.title!, pipelineId: pipeline?.id, stageId: stageId! })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all })
      notify({ title: deal ? 'Deal saved' : `${saved.title} added` })
      close()
      if (!deal) navigate(`/app/deals/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all })
      if (err instanceof ApiError && err.code === 'STAGE_REQUIREMENTS') setServerError(`${err.message} (${((err.details?.missing as string[]) ?? []).join(', ')})`)
      else if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setServerError(err instanceof ApiError ? err.message : 'Couldn’t save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const guard = useUnsavedChanges(draft, close, busy, open)
  const stage = stages.find((s) => s.id === stageId)

  return (
    <>
      <FormDrawer
        open={open}
        onClose={guard.requestClose}
        busy={busy}
        icon={Handshake}
        title={deal ? 'Edit deal' : 'New deal'}
        description={deal ? deal.title : 'Give it a clear name and the stage it’s at.'}
        formId="deal-form"
        onSubmit={() => void submit()}
        submitLabel={deal ? 'Save changes' : 'Create deal'}
        submitDisabled={!deal && !stageId}
        error={serverError}
      >
        <FormSection title="Deal" icon={CircleDollarSign}>
          <Field label="Title" error={errors.title}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} autoFocus value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Saffron Retail — annual supply" />}
          </Field>
          {!deal && (
            <FieldRow>
              <Field label="Pipeline">
                {({ id }) => (
                  <Select id={id} value={pipeline?.id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, pipelineId: e.target.value, stageId: '' }))}>
                    {livePipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Stage" error={errors.stageId}>
                {({ id, invalid }) => (
                  <Select id={id} invalid={invalid} value={stageId ?? ''} onChange={(e) => set('stageId', e.target.value)}>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.probability}%)
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </FieldRow>
          )}
          <FieldRow cols={3}>
            <Field label="Value" optional error={errors.valueMinor}>
              {({ id, invalid }) => <MoneyInput id={id} invalid={invalid} value={draft.value} onChange={(e) => set('value', e.target.value)} placeholder="1,85,000" />}
            </Field>
            <Field label="Expected close" optional error={errors.expectedCloseDate}>
              {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} value={draft.expectedCloseDate} onChange={(e) => set('expectedCloseDate', e.target.value)} />}
            </Field>
            <Field label="Win probability" optional error={errors.probabilityOverride} hint={stage ? `Stage default: ${stage.probability}%` : 'Empty = the stage’s probability'}>
              {({ id, describedBy, invalid }) => (
                <div className="relative">
                  <Input id={id} invalid={invalid} aria-describedby={describedBy} type="number" min={0} max={100} value={draft.probabilityOverride} onChange={(e) => set('probabilityOverride', e.target.value)} placeholder={stage ? String(stage.probability) : ''} className="pr-8" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted" aria-hidden="true">
                    %
                  </span>
                </div>
              )}
            </Field>
          </FieldRow>
        </FormSection>

        <FormSection title="People" icon={Users} description="The company you’re selling to and who’s involved">
          <Field label="Company" optional error={errors.companyId}>
            {({ id, invalid }) => (
              <RecordPicker
                id={id}
                invalid={invalid}
                queryKey={qk.org(orgId).companies.all}
                search={async (q) => (await listCompanies({ q, limit: 10 })).items.map((c) => ({ id: c.id, label: c.name, hint: c.domain }))}
                selected={draft.company}
                onChange={(o) => set('company', o)}
                placeholder="Search companies…"
              />
            )}
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">
              Contacts <span className="font-normal text-muted">(optional)</span>
            </p>
            <LinkedRecordList
              noun="contact"
              rolePlaceholder="Role, e.g. Decision maker"
              items={draft.contacts}
              onChange={(v) => set('contacts', v)}
              picker={
                <RecordPicker
                  queryKey={qk.org(orgId).contacts.all}
                  search={async (q) => (await listContacts({ q, limit: 10 })).items.map((c) => ({ id: c.id, label: c.displayName, hint: c.companies[0]?.name ?? formatPhone(c.primaryPhoneE164, c.phones[0]?.raw) }))}
                  selected={null}
                  onChange={(o) => o && !draft.contacts.some((c) => c.option.id === o.id) && set('contacts', [...draft.contacts, { option: o, role: '', isPrimary: draft.contacts.length === 0 }])}
                  placeholder={draft.contacts.length ? 'Add another contact…' : 'Search contacts to add…'}
                />
              }
            />
            {errors.contacts && <p className="mt-1 text-sm text-danger">{errors.contacts}</p>}
          </div>
        </FormSection>

        <FormSection title="Source, owner & tags" icon={UserRound}>
          <FieldRow>
            <Field label="Source" optional>
              {({ id }) => (
                <Select id={id} value={draft.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
                  <option value="">Not set</option>
                  {(sources.data ?? [])
                    .filter((s) => !s.archived || s.id === draft.sourceId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            {canAssign && (
              <Field label="Owner" error={errors.ownerId}>
                {({ id, invalid }) => <UserPicker id={id} invalid={invalid} value={draft.ownerId} onChange={(v) => set('ownerId', v)} placeholder="Unassigned" />}
              </Field>
            )}
            <Field label="Tags" optional className="@md:col-span-2">
              {({ id }) => <TagPicker id={id} value={draft.tagIds} onChange={(v) => set('tagIds', v)} />}
            </Field>
          </FieldRow>
        </FormSection>

        <CustomFieldsSection entityType="deal" values={draft.customFields} onChange={(v) => set('customFields', v)} errors={fieldErrorsUnder(errors, 'customFields')} />
      </FormDrawer>
      {guard.confirmation}
    </>
  )
}
