import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Contact, Info, Milestone, ShieldCheck, UserRound } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { FieldRow, FormDrawer, FormSection } from '../../components/app/FormDrawer'
import { UserPicker } from '../../components/app/UserPicker'
import { listCompanies } from '../companies/api'
import { EmailsEditor, PhonesEditor, type EmailDraft, type PhoneDraft } from '../crm/components/ContactPoints'
import { cleanEmails, cleanPhones } from '../crm/listHelpers'
import { CustomFieldsSection } from '../crm/components/CustomFieldInput'
import { LinkedRecordList } from '../crm/components/LinkedRecords'
import { RecordPicker, type PickerOption } from '../crm/components/RecordPicker'
import { DuplicateWarning } from '../crm/components/RecordParts'
import { TagPicker } from '../crm/components/Tags'
import { fieldErrorsUnder, lifecycleLabels } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import type { ContactRecord, CustomFieldValues, Duplicate, LifecycleStage } from '../crm/types'
import { useDuplicateCheck } from '../crm/useDuplicateCheck'
import { checkContactDuplicates, createContact, updateContact, type ContactInput } from './api'

interface Draft {
  firstName: string
  lastName: string
  title: string
  emails: EmailDraft[]
  phones: PhoneDraft[]
  lifecycleStage: LifecycleStage
  source: string
  ownerId: string | null
  whatsappOptIn: boolean
  emailOptIn: boolean
  companies: { option: PickerOption; role: string; isPrimary: boolean }[]
  tagIds: string[]
  customFields: CustomFieldValues
}

const fromContact = (c: ContactRecord | null, userId: string | null): Draft => ({
  firstName: c?.firstName ?? '',
  lastName: c?.lastName ?? '',
  title: c?.title ?? '',
  emails: c?.emails.map((e) => ({ value: e.value, label: e.label, primary: e.primary })) ?? [],
  phones: c?.phones.map((p) => ({ raw: p.raw, label: p.label, primary: p.primary, whatsapp: p.whatsapp })) ?? [],
  lifecycleStage: c?.lifecycleStage ?? 'lead',
  source: c?.source ?? '',
  ownerId: c ? c.ownerId : userId,
  whatsappOptIn: Boolean(c?.whatsappOptInAt),
  emailOptIn: Boolean(c?.emailOptInAt),
  companies: c?.companies.map((co) => ({ option: { id: co.id, label: co.name }, role: co.role ?? '', isPrimary: co.isPrimary })) ?? [],
  tagIds: c?.tags.map((t) => t.id) ?? [],
  customFields: c?.customFields ?? {},
})

const toInput = (d: Draft): ContactInput => ({
  firstName: d.firstName.trim() || null,
  lastName: d.lastName.trim() || null,
  title: d.title.trim() || null,
  emails: cleanEmails(d.emails),
  phones: cleanPhones(d.phones),
  lifecycleStage: d.lifecycleStage,
  source: d.source.trim() || null,
  ownerId: d.ownerId,
  whatsappOptIn: d.whatsappOptIn,
  emailOptIn: d.emailOptIn,
  companies: d.companies.map((c) => ({ companyId: c.option.id, role: c.role.trim() || null, isPrimary: c.isPrimary })),
  tagIds: d.tagIds,
  customFields: d.customFields,
})

/**
 * Quick-create (and edit) drawer for a contact. While typing a phone or email it warns about
 * existing contacts with the same one; the server also refuses duplicates unless you confirm.
 */
export function ContactFormDrawer({ open, onClose, contact = null, defaultCompany }: { open: boolean; onClose: () => void; contact?: ContactRecord | null; defaultCompany?: PickerOption }) {
  const { user } = useAuth()
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const canAssign = useCan('records.assign')
  const [draft, setDraft] = useState<Draft>(() => {
    const d = fromContact(contact, user?.id ?? null)
    if (!contact && defaultCompany) d.companies = [{ option: defaultCompany, role: '', isPrimary: true }]
    return d
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Duplicate[]>([])
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const emails = cleanEmails(draft.emails).map((e) => e.value)
  const phones = cleanPhones(draft.phones).map((p) => p.raw)
  const live = useDuplicateCheck(JSON.stringify([emails, phones]), open && (emails.length > 0 || phones.some((p) => p.replace(/\D/g, '').length >= 8)), (signal) =>
    checkContactDuplicates({ emails, phones, excludeId: contact?.id }, signal),
  )

  function close() {
    guard.markSaved()
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
      const input = toInput(draft)
      const saved = contact ? await updateContact(contact.id, input, { ifMatch: contact.updatedAt, allowDuplicate }) : await createContact(input, { allowDuplicate })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).contacts.all })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).current })
      notify({ title: contact ? 'Contact saved' : `${saved.displayName} added` })
      close()
      if (!contact) navigate(`/app/contacts/${saved.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await queryClient.invalidateQueries({ queryKey: qk.org(orgId).contacts.all })
      if (err instanceof ApiError && err.code === 'DUPLICATE_FOUND') setConflicts((err.details?.duplicates as Duplicate[]) ?? [])
      else if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setServerError(err instanceof ApiError ? err.message : 'Couldn’t save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const shown = conflicts.length ? conflicts : live
  const consents = [draft.whatsappOptIn && 'WhatsApp', draft.emailOptIn && 'Email'].filter(Boolean).join(' · ')

  const guard = useUnsavedChanges(draft, close, busy, open)

  return (
    <>
      <FormDrawer
        open={open}
        onClose={guard.requestClose}
        busy={busy}
        icon={UserRound}
        title={contact ? 'Edit contact' : 'New contact'}
        description={contact ? contact.displayName : 'A name, phone or email is enough to start.'}
        formId="contact-form"
        onSubmit={() => void submit(false)}
        submitLabel={contact ? 'Save changes' : 'Create contact'}
        actions={
          conflicts.length > 0 && (
            <Button variant="secondary" onClick={() => submit(true)} disabled={busy}>
              Save anyway
            </Button>
          )
        }
        error={serverError}
      >
        <DuplicateWarning duplicates={shown} hrefFor={(d) => `/app/contacts/${d.id}`} />

        <FormSection title="Contact details" icon={Contact}>
          <FieldRow>
            <Field label="First name" error={errors.firstName}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} autoFocus value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />}
            </Field>
            <Field label="Last name" optional error={errors.lastName}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />}
            </Field>
          </FieldRow>
          <Field label="Job title" optional error={errors.title}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Purchase head" />}
          </Field>
          <Field label="Phone" optional error={errors.phones}>
            {({ id }) => <PhonesEditor idPrefix={id} value={draft.phones} onChange={(v) => set('phones', v)} errors={fieldErrorsUnder(errors, 'phones')} />}
          </Field>
          <Field label="Email" optional error={errors.emails}>
            {({ id }) => <EmailsEditor idPrefix={id} value={draft.emails} onChange={(v) => set('emails', v)} errors={fieldErrorsUnder(errors, 'emails')} />}
          </Field>
        </FormSection>

        <FormSection title="Companies" icon={Building2} description="Where they work. The primary company shows on their profile.">
          <LinkedRecordList
            noun="company"
            items={draft.companies}
            onChange={(v) => set('companies', v)}
            picker={
              <RecordPicker
                queryKey={qk.org(orgId).companies.all}
                search={async (q) => (await listCompanies({ q, limit: 10 })).items.map((co) => ({ id: co.id, label: co.name, hint: co.domain }))}
                selected={null}
                onChange={(o) => o && !draft.companies.some((c) => c.option.id === o.id) && set('companies', [...draft.companies, { option: o, role: '', isPrimary: draft.companies.length === 0 }])}
                placeholder={draft.companies.length ? 'Link another company…' : 'Search companies to link…'}
              />
            }
          />
          {errors.companies && <p className="text-sm text-danger">{errors.companies}</p>}
        </FormSection>

        <FormSection title="Stage & owner" icon={Milestone}>
          <FieldRow>
            <Field label="Lifecycle stage">
              {({ id }) => (
                <Select id={id} value={draft.lifecycleStage} onChange={(e) => set('lifecycleStage', e.target.value as LifecycleStage)}>
                  {Object.entries(lifecycleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Source" optional>
              {({ id }) => <Input id={id} value={draft.source} onChange={(e) => set('source', e.target.value)} placeholder="e.g. Trade fair" />}
            </Field>
            {canAssign && (
              <Field label="Owner" error={errors.ownerId}>
                {({ id, invalid }) => <UserPicker id={id} invalid={invalid} value={draft.ownerId} onChange={(v) => set('ownerId', v)} placeholder="Unassigned" />}
              </Field>
            )}
            <Field label="Tags" optional error={errors.tagIds} className={canAssign ? undefined : '@md:col-span-2'}>
              {({ id }) => <TagPicker id={id} value={draft.tagIds} onChange={(v) => set('tagIds', v)} />}
            </Field>
          </FieldRow>
        </FormSection>

        <FormSection title="Marketing consent" icon={ShieldCheck} collapsible defaultOpen={Boolean(contact)} summary={consents ? `Agreed: ${consents}` : 'No consent recorded'}>
          <div className="space-y-3 rounded-lg border border-line p-3">
            <Checkbox label="Agreed to receive WhatsApp messages" checked={draft.whatsappOptIn} onChange={(e) => set('whatsappOptIn', e.target.checked)} />
            <Checkbox label="Agreed to receive marketing emails" checked={draft.emailOptIn} onChange={(e) => set('emailOptIn', e.target.checked)} />
          </div>
          <p className="text-xs text-muted">Only tick these when the person has agreed. Record consent before including this contact in marketing.</p>
        </FormSection>

        <CustomFieldsSection entityType="contact" values={draft.customFields} onChange={(v) => set('customFields', v)} errors={fieldErrorsUnder(errors, 'customFields')} />
        {!contact && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            Contacts count toward your plan’s leads & contacts limit.
          </p>
        )}
      </FormDrawer>
      {guard.confirmation}
    </>
  )
}
