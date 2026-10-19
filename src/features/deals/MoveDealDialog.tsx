import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { qk } from '../../lib/queryKeys'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { Dialog } from '../../components/app/Dialog'
import { UserPicker } from '../../components/app/UserPicker'
import { listCompanies } from '../companies/api'
import { listContacts } from '../contacts/api'
import { CustomFieldInput } from '../crm/components/CustomFieldInput'
import { RecordPicker, type PickerOption } from '../crm/components/RecordPicker'
import { minorToRupeesText, rupeesToMinor } from '../crm/format'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import type { DealRecord, PipelineStage } from '../crm/types'
import { listLostReasons } from '../leads/api'
import { requirableFieldLabels, type MoveInput } from './api'

/**
 * Asks for what a move needs before it's sent: the target stage's missing required fields (the
 * board's "mini-form"), and for Lost the reason. `missing` comes from the server's 422
 * STAGE_REQUIREMENTS, or is known up front for Won (value) and Lost.
 */
export function MoveDealDialog({
  deal,
  stage,
  missing,
  onClose,
  onSubmit,
}: {
  deal: DealRecord
  stage: PipelineStage
  missing: string[]
  onClose: () => void
  onSubmit: (input: MoveInput) => Promise<unknown>
}) {
  const orgId = useOrgId()
  const defs = useCustomFieldDefs('deal')
  const reasons = useQuery({ queryKey: qk.org(orgId).lostReasons('deal'), queryFn: () => listLostReasons('deal'), enabled: stage.type === 'lost' })
  const [value, setValue] = useState(minorToRupeesText(deal.valueMinor || null))
  const [closeDate, setCloseDate] = useState(deal.expectedCloseDate ?? '')
  const [company, setCompany] = useState<PickerOption | null>(deal.company ? { id: deal.company.id, label: deal.company.name } : null)
  const [contact, setContact] = useState<PickerOption | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(deal.ownerId)
  const [custom, setCustom] = useState<Record<string, unknown>>({})
  const [lostReasonId, setLostReasonId] = useState('')
  const [lostNote, setLostNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const need = new Set(missing)

  async function submit() {
    const fields: NonNullable<MoveInput['fields']> = {}
    if (need.has('valueMinor')) {
      const minor = rupeesToMinor(value)
      if (!minor) return setError('Enter the deal value')
      fields.valueMinor = minor
    }
    if (need.has('expectedCloseDate')) fields.expectedCloseDate = closeDate || null
    if (need.has('companyId')) fields.companyId = company?.id ?? null
    if (need.has('ownerId')) fields.ownerId = ownerId
    if (need.has('contacts') && contact) fields.contacts = [...deal.contacts.map((c) => ({ contactId: c.contactId, role: c.role, isPrimary: c.isPrimary })), { contactId: contact.id, isPrimary: !deal.contacts.length }]
    const cf = Object.fromEntries([...need].filter((f) => f.startsWith('cf.')).map((f) => [f.slice(3), custom[f.slice(3)]]))
    if (Object.keys(cf).length) fields.customFields = cf
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ stageId: stage.id, ...(Object.keys(fields).length && { fields }), ...(stage.type === 'lost' && { lostReasonId, lostNote: lostNote.trim() || null }) })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t move the deal')
    } finally {
      setBusy(false)
    }
  }

  const title = stage.type === 'won' ? `Mark “${deal.title}” as won` : stage.type === 'lost' ? `Mark “${deal.title}” as lost` : `Move to ${stage.name}`
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={missing.length ? `${stage.name} needs ${missing.length === 1 ? 'this' : 'these'} first.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={stage.type === 'lost' && !lostReasonId}>
            {stage.type === 'won' ? 'Mark won' : stage.type === 'lost' ? 'Mark lost' : 'Move deal'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {need.has('valueMinor') && (
          <Field label={requirableFieldLabels.valueMinor}>
            {({ id }) => (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-500">₹</span>
                <Input id={id} autoFocus inputMode="decimal" className="pl-7" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            )}
          </Field>
        )}
        {need.has('expectedCloseDate') && <Field label={requirableFieldLabels.expectedCloseDate}>{({ id }) => <Input id={id} type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />}</Field>}
        {need.has('companyId') && (
          <Field label={requirableFieldLabels.companyId}>
            {({ id }) => (
              <RecordPicker
                id={id}
                queryKey={qk.org(orgId).companies.all}
                search={async (q) => (await listCompanies({ q, limit: 10 })).items.map((c) => ({ id: c.id, label: c.name, hint: c.domain }))}
                selected={company}
                onChange={setCompany}
              />
            )}
          </Field>
        )}
        {need.has('contacts') && (
          <Field label={requirableFieldLabels.contacts}>
            {({ id }) => (
              <RecordPicker id={id} queryKey={qk.org(orgId).contacts.all} search={async (q) => (await listContacts({ q, limit: 10 })).items.map((c) => ({ id: c.id, label: c.displayName, hint: c.companies[0]?.name }))} selected={contact} onChange={setContact} />
            )}
          </Field>
        )}
        {need.has('ownerId') && <Field label={requirableFieldLabels.ownerId}>{({ id }) => <UserPicker id={id} value={ownerId} onChange={(v) => setOwnerId(v)} />}</Field>}
        {(defs.data ?? [])
          .filter((d) => need.has(`cf.${d.key}`))
          .map((d) => (
            <Field key={d.id} label={d.label}>
              {({ id, describedBy }) => <CustomFieldInput def={d} id={id} describedBy={describedBy} value={custom[d.key]} onChange={(v) => setCustom((c) => ({ ...c, [d.key]: v }))} />}
            </Field>
          ))}
        {stage.type === 'lost' && (
          <>
            <Field label="Why was it lost?">
              {({ id }) => (
                <Select id={id} value={lostReasonId} onChange={(e) => setLostReasonId(e.target.value)}>
                  <option value="">Choose a reason</option>
                  {(reasons.data ?? [])
                    .filter((r) => !r.archived)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Note" optional>
              {({ id }) => <Textarea id={id} rows={2} value={lostNote} onChange={(e) => setLostNote(e.target.value)} maxLength={1000} />}
            </Field>
          </>
        )}
        {!missing.length && stage.type !== 'lost' && <p className="text-sm text-zinc-600">Ready to move.</p>}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Dialog>
  )
}
