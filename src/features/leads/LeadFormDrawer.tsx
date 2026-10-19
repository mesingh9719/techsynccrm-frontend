import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { gstStates } from '../../lib/india'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Drawer } from '../../components/app/Dialog'
import { UserPicker } from '../../components/app/UserPicker'
import { EmailsEditor, PhonesEditor, type EmailDraft, type PhoneDraft } from '../crm/components/ContactPoints'
import { cleanEmails, cleanPhones } from '../crm/listHelpers'
import { CustomFieldsEditor } from '../crm/components/CustomFieldInput'
import { DuplicateWarning } from '../crm/components/RecordParts'
import { TagPicker } from '../crm/components/Tags'
import { fieldErrorsUnder, minorToRupeesText, rupeesToMinor } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import type { CustomFieldValues, Duplicate, LeadRecord } from '../crm/types'
import { useDuplicateCheck } from '../crm/useDuplicateCheck'
import { checkLeadDuplicates, createLead, updateLead, useLeadSources, type LeadInput } from './api'

interface Draft {
  firstName: string
  lastName: string
  phones: PhoneDraft[]
  emails: EmailDraft[]
  companyName: string
  requirement: string
  budget: string
  city: string
  stateCode: string
  pincode: string
  sourceId: string
  sourceDetail: string
  ownerId: string | null
  tagIds: string[]
  customFields: CustomFieldValues
}

const fromLead = (l: LeadRecord | null, userId: string | null): Draft => ({
  firstName: l?.firstName ?? '',
  lastName: l?.lastName ?? '',
  phones: l?.phones.map((p) => ({ raw: p.raw, primary: p.primary, whatsapp: p.whatsapp, label: p.label })) ?? [],
  emails: l?.emails.map((e) => ({ value: e.value, primary: e.primary, label: e.label })) ?? [],
  companyName: l?.companyName ?? '',
  requirement: l?.requirement ?? '',
  budget: minorToRupeesText(l?.budgetMinor),
  city: l?.city ?? '',
  stateCode: l?.stateCode ?? '',
  pincode: l?.pincode ?? '',
  sourceId: l?.sourceId ?? '',
  sourceDetail: l?.sourceDetail ?? '',
  ownerId: l ? l.ownerId : userId,
  tagIds: l?.tags.map((t) => t.id) ?? [],
  customFields: l?.customFields ?? {},
})

/** Quick-create / edit a lead. Warns about open leads and contacts with the same phone or email. */
export function LeadFormDrawer({ open, onClose, lead = null }: { open: boolean; onClose: () => void; lead?: LeadRecord | null }) {
  const { user } = useAuth()
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const canAssign = useCan('records.assign')
  const sources = useLeadSources()
  const [draft, setDraft] = useState<Draft>(() => fromLead(lead, user?.id ?? null))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Duplicate[]>([])
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const emails = cleanEmails(draft.emails).map((e) => e.value)
  const phones = cleanPhones(draft.phones).map((p) => p.raw)
  const live = useDuplicateCheck(JSON.stringify([emails, phones]), open && (emails.length > 0 || phones.some((p) => p.replace(/\D/g, '').length >= 8)), (signal) =>
    checkLeadDuplicates({ emails, phones, excludeId: lead?.id }, signal),
  )

  function close() {
    setErrors({})
    setServerError(null)
    setConflicts([])
    onClose()
  }

  function toInput(): LeadInput {
    const budgetMinor = draft.budget.trim() ? rupeesToMinor(draft.budget) : null
    return {
      firstName: draft.firstName.trim() || null,
      lastName: draft.lastName.trim() || null,
      phones: cleanPhones(draft.phones),
      emails: cleanEmails(draft.emails),
      companyName: draft.companyName.trim() || null,
      requirement: draft.requirement.trim() || null,
      budgetMinor,
      city: draft.city.trim() || null,
      stateCode: draft.stateCode || null,
      pincode: draft.pincode.trim() || null,
      sourceId: draft.sourceId || null,
      sourceDetail: draft.sourceDetail.trim() || null,
      tagIds: draft.tagIds,
      customFields: draft.customFields,
      ...(!lead && { ownerId: draft.ownerId }),
    }
  }

  async function submit(allowDuplicate = false) {
    if (draft.budget.trim() && rupeesToMinor(draft.budget) === null) return setErrors({ budgetMinor: 'Enter an amount in rupees' })
    setBusy(true)
    setErrors({})
    setServerError(null)
    try {
      const input = toInput()
      const saved = lead ? await updateLead(lead.id, input, { ifMatch: lead.updatedAt, allowDuplicate }) : await createLead(input, { allowDuplicate })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.all })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).current })
      notify({ title: lead ? 'Lead saved' : `${saved.displayName} added` })
      close()
      if (!lead) navigate(`/app/leads/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.all })
      if (err instanceof ApiError && err.code === 'DUPLICATE_FOUND') setConflicts((err.details?.duplicates as Duplicate[]) ?? [])
      else if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setServerError(err instanceof ApiError ? err.message : 'Couldn’t save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const activeSources = (sources.data ?? []).filter((s) => !s.archived || s.id === draft.sourceId)

  return (
    <Drawer
      open={open}
      onClose={close}
      title={lead ? 'Edit lead' : 'New lead'}
      description={lead ? undefined : 'A name, phone or email is enough. Add the rest as you learn it.'}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          {conflicts.length > 0 && (
            <Button variant="secondary" onClick={() => submit(true)} loading={busy}>
              Save anyway
            </Button>
          )}
          <Button type="submit" form="lead-form" loading={busy && !conflicts.length}>
            {lead ? 'Save' : 'Create lead'}
          </Button>
        </>
      }
    >
      <form
        id="lead-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
        className="space-y-5"
      >
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <DuplicateWarning duplicates={conflicts.length ? conflicts : live} hrefFor={(d) => (d.entityType === 'contact' ? `/app/contacts/${d.id}` : `/app/leads/${d.id}`)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} autoFocus value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Last name" optional>
            {({ id }) => <Input id={id} value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />}
          </Field>
        </div>
        <Field label="Phone" optional error={errors.phones}>
          {({ id }) => <PhonesEditor idPrefix={id} value={draft.phones} onChange={(v) => set('phones', v)} errors={fieldErrorsUnder(errors, 'phones')} />}
        </Field>
        <Field label="Email" optional error={errors.emails}>
          {({ id }) => <EmailsEditor idPrefix={id} value={draft.emails} onChange={(v) => set('emails', v)} errors={fieldErrorsUnder(errors, 'emails')} />}
        </Field>
        <Field label="Company" optional>
          {({ id }) => <Input id={id} value={draft.companyName} onChange={(e) => set('companyName', e.target.value)} autoComplete="organization" />}
        </Field>
        <Field label="Requirement" optional error={errors.requirement}>
          {({ id, invalid }) => <Textarea id={id} invalid={invalid} rows={3} value={draft.requirement} onChange={(e) => set('requirement', e.target.value)} placeholder="What are they looking for?" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source" optional error={errors.sourceId}>
            {({ id, invalid }) => (
              <Select id={id} invalid={invalid} value={draft.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
                <option value="">—</option>
                {activeSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Budget" optional error={errors.budgetMinor}>
            {({ id, invalid }) => (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-500">₹</span>
                <Input id={id} invalid={invalid} inputMode="decimal" className="pl-7" value={draft.budget} onChange={(e) => set('budget', e.target.value)} placeholder="1,85,000" />
              </div>
            )}
          </Field>
        </div>
        <Field label="Source details" optional hint="Campaign name, IndiaMART query ID, who referred them…">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={draft.sourceDetail} onChange={(e) => set('sourceDetail', e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" optional>
            {({ id }) => <Input id={id} value={draft.city} onChange={(e) => set('city', e.target.value)} />}
          </Field>
          <Field label="State" optional error={errors.stateCode}>
            {({ id }) => (
              <Select id={id} value={draft.stateCode} onChange={(e) => set('stateCode', e.target.value)}>
                <option value="">—</option>
                {gstStates.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="PIN code" optional error={errors.pincode}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} inputMode="numeric" maxLength={6} value={draft.pincode} onChange={(e) => set('pincode', e.target.value)} />}
          </Field>
        </div>
        {!lead && canAssign && (
          <Field label="Owner" hint="Leave empty to put it in the unassigned queue for anyone to claim." error={errors.ownerId}>
            {({ id, describedBy, invalid }) => <UserPicker id={id} aria-describedby={describedBy} invalid={invalid} value={draft.ownerId} onChange={(v) => set('ownerId', v)} placeholder="Unassigned" />}
          </Field>
        )}
        <Field label="Tags" optional error={errors.tagIds}>
          {({ id }) => <TagPicker id={id} value={draft.tagIds} onChange={(v) => set('tagIds', v)} />}
        </Field>
        <CustomFieldsEditor entityType="lead" values={draft.customFields} onChange={(v) => set('customFields', v)} errors={fieldErrorsUnder(errors, 'customFields')} />
      </form>
    </Drawer>
  )
}
