import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { gstStates } from '../../lib/india'
import { qk } from '../../lib/queryKeys'
import { companySizes, industries } from '../../lib/schemas'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Drawer } from '../../components/app/Dialog'
import { UserPicker } from '../../components/app/UserPicker'
import { CustomFieldsEditor } from '../crm/components/CustomFieldInput'
import { DuplicateWarning } from '../crm/components/RecordParts'
import { TagPicker } from '../crm/components/Tags'
import { fieldErrorsUnder } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import type { CompanyRecord, CustomFieldValues, Duplicate } from '../crm/types'
import { useDuplicateCheck } from '../crm/useDuplicateCheck'
import { checkCompanyDuplicates, createCompany, updateCompany, type CompanyInput } from './api'

interface Draft {
  name: string
  domain: string
  industry: string
  size: string
  gstin: string
  phone: string
  email: string
  website: string
  line1: string
  city: string
  stateCode: string
  pincode: string
  ownerId: string | null
  tagIds: string[]
  customFields: CustomFieldValues
}

const fromCompany = (c: CompanyRecord | null, userId: string | null, name = ''): Draft => ({
  name: c?.name ?? name,
  domain: c?.domain ?? '',
  industry: c?.industry ?? '',
  size: c?.size ?? '',
  gstin: c?.gstin ?? '',
  phone: c?.phoneRaw ?? '',
  email: c?.email ?? '',
  website: c?.website ?? '',
  line1: c?.billingAddress?.line1 ?? '',
  city: c?.billingAddress?.city ?? '',
  stateCode: c?.billingAddress?.stateCode ?? '',
  pincode: c?.billingAddress?.pincode ?? '',
  ownerId: c ? c.ownerId : userId,
  tagIds: c?.tags.map((t) => t.id) ?? [],
  customFields: c?.customFields ?? {},
})

function toInput(d: Draft, existing: CompanyRecord | null): CompanyInput {
  const address = { line1: d.line1.trim() || null, line2: existing?.billingAddress?.line2 ?? null, city: d.city.trim() || null, stateCode: d.stateCode || null, pincode: d.pincode.trim() || null, country: 'IN' }
  return {
    name: d.name.trim(),
    domain: d.domain.trim() || null,
    industry: d.industry || null,
    size: d.size || null,
    gstin: d.gstin.trim() || null,
    phone: d.phone.trim() || null,
    email: d.email.trim() || null,
    website: d.website.trim() || null,
    billingAddress: Object.entries(address).some(([k, v]) => k !== 'country' && v) ? address : null,
    ownerId: d.ownerId,
    tagIds: d.tagIds,
    customFields: d.customFields,
  }
}

/** Create/edit a company. Warns while typing when the name, domain or GSTIN matches an existing one. */
export function CompanyFormDrawer({ open, onClose, company = null, initialName, onCreated }: { open: boolean; onClose: () => void; company?: CompanyRecord | null; initialName?: string; onCreated?: (company: CompanyRecord) => void }) {
  const { user } = useAuth()
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const canAssign = useCan('records.assign')
  const [draft, setDraft] = useState<Draft>(() => fromCompany(company, user?.id ?? null, initialName))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Duplicate[]>([])
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const check = { name: draft.name.trim(), domain: draft.domain.trim() || draft.website.trim(), gstin: draft.gstin.trim() }
  const live = useDuplicateCheck(JSON.stringify(check), open && check.name.length >= 3, (signal) =>
    checkCompanyDuplicates({ name: check.name || undefined, domain: check.domain || undefined, gstin: check.gstin || undefined, excludeId: company?.id }, signal),
  )

  function close() {
    setErrors({})
    setServerError(null)
    setConflicts([])
    onClose()
  }

  async function submit(allowDuplicate = false) {
    setBusy(true)
    setErrors({})
    setServerError(null)
    try {
      const input = toInput(draft, company)
      const saved = company ? await updateCompany(company.id, input, { ifMatch: company.updatedAt, allowDuplicate }) : await createCompany(input, { allowDuplicate })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).companies.all })
      notify({ title: company ? 'Company saved' : `${saved.name} added` })
      close()
      if (!company) {
        if (onCreated) onCreated(saved)
        else navigate(`/app/companies/${saved.id}`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await queryClient.invalidateQueries({ queryKey: qk.org(orgId).companies.all })
      if (err instanceof ApiError && err.code === 'DUPLICATE_FOUND') setConflicts((err.details?.duplicates as Duplicate[]) ?? [])
      else if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setServerError(err instanceof ApiError ? err.message : 'Couldn’t save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={company ? 'Edit company' : 'New company'}
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
          <Button type="submit" form="company-form" loading={busy && !conflicts.length}>
            {company ? 'Save' : 'Create company'}
          </Button>
        </>
      }
    >
      <form
        id="company-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
        className="space-y-5"
      >
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <DuplicateWarning duplicates={conflicts.length ? conflicts : live} hrefFor={(d) => `/app/companies/${d.id}`} />
        <Field label="Company name" error={errors.name}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} autoComplete="organization" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" optional error={errors.website}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} value={draft.website} onChange={(e) => set('website', e.target.value)} placeholder="saffronretail.in" />}
          </Field>
          <Field label="Domain" optional error={errors.domain} hint="Filled from the website if left empty.">
            {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} aria-describedby={describedBy} value={draft.domain} onChange={(e) => set('domain', e.target.value)} />}
          </Field>
          <Field label="Industry" optional>
            {({ id }) => (
              <Select id={id} value={draft.industry} onChange={(e) => set('industry', e.target.value)}>
                <option value="">—</option>
                {industries.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Size" optional>
            {({ id }) => (
              <Select id={id} value={draft.size} onChange={(e) => set('size', e.target.value)}>
                <option value="">—</option>
                {companySizes.map((s) => (
                  <option key={s} value={s}>
                    {s} employees
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Phone" optional error={errors.phone}>
            {({ id, invalid }) => <Input id={id} type="tel" invalid={invalid} value={draft.phone} onChange={(e) => set('phone', e.target.value)} />}
          </Field>
          <Field label="Email" optional error={errors.email}>
            {({ id, invalid }) => <Input id={id} type="email" invalid={invalid} value={draft.email} onChange={(e) => set('email', e.target.value)} />}
          </Field>
        </div>
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-zinc-800">Billing address & GST</legend>
          <Field label="Address" optional>
            {({ id }) => <Input id={id} value={draft.line1} onChange={(e) => set('line1', e.target.value)} autoComplete="street-address" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" optional>
              {({ id }) => <Input id={id} value={draft.city} onChange={(e) => set('city', e.target.value)} />}
            </Field>
            <Field label="State" optional error={errors['billingAddress.stateCode']}>
              {({ id, invalid }) => (
                <Select id={id} invalid={invalid} value={draft.stateCode} onChange={(e) => set('stateCode', e.target.value)}>
                  <option value="">—</option>
                  {gstStates.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="PIN code" optional error={errors['billingAddress.pincode']}>
              {({ id, invalid }) => <Input id={id} inputMode="numeric" maxLength={6} invalid={invalid} value={draft.pincode} onChange={(e) => set('pincode', e.target.value)} />}
            </Field>
          </div>
          <Field label="GSTIN" optional error={errors.gstin} hint="Needed for GST invoices. Must match the state above.">
            {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} aria-describedby={describedBy} maxLength={15} className="uppercase" value={draft.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />}
          </Field>
        </fieldset>
        {canAssign && (
          <Field label="Owner" error={errors.ownerId}>
            {({ id, invalid }) => <UserPicker id={id} invalid={invalid} value={draft.ownerId} onChange={(v) => set('ownerId', v)} placeholder="No owner" />}
          </Field>
        )}
        <Field label="Tags" optional error={errors.tagIds}>
          {({ id }) => <TagPicker id={id} value={draft.tagIds} onChange={(v) => set('tagIds', v)} />}
        </Field>
        <CustomFieldsEditor entityType="company" values={draft.customFields} onChange={(v) => set('customFields', v)} errors={fieldErrorsUnder(errors, 'customFields')} />
      </form>
    </Drawer>
  )
}
