import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, SquareKanban, UserRound } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { Skeleton } from '../../components/app/States'
import { listCompanies } from '../companies/api'
import { listContacts } from '../contacts/api'
import { RecordPicker, type PickerOption } from '../crm/components/RecordPicker'
import { CustomFieldInput } from '../crm/components/CustomFieldInput'
import { formatPhone, minorToRupeesText, rupeesToMinor } from '../crm/format'
import { usePipelines } from '../deals/api'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import type { CustomFieldValues, LeadRecord } from '../crm/types'
import { convertLead, getConversionSuggestions, type ConvertInput } from './api'

function Choice({ checked, onChange, title, hint }: { checked: boolean; onChange: () => void; title: string; hint?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm ring-1', checked ? 'bg-brand-50 ring-brand-300' : 'ring-zinc-200 hover:bg-zinc-50')}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-0.5 text-brand-600 focus:ring-brand-500" />
      <span>
        <span className="block font-medium text-zinc-900">{title}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4 ring-1 ring-zinc-200">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
        <Icon className="size-4 text-zinc-400" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  )
}

/**
 * Convert a lead: contact (new or existing — matches suggested), company (new, existing or none),
 * and optionally a deal in a pipeline stage. The lead becomes read-only afterwards.
 */
export function ConvertDialog({ lead, onClose }: { lead: LeadRecord; onClose: () => void }) {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const suggestions = useQuery({ queryKey: [...qk.org(orgId).leads.detail(lead.id), 'conversion'], queryFn: () => getConversionSuggestions(lead.id) })
  const [contactMode, setContactMode] = useState<'create' | 'link' | null>(null)
  const [contact, setContact] = useState<PickerOption | null>(null)
  const [companyMode, setCompanyMode] = useState<'create' | 'link' | 'none' | null>(null)
  const [company, setCompany] = useState<PickerOption | null>(null)
  const [companyName, setCompanyName] = useState(lead.companyName ?? '')
  const pipelines = usePipelines()
  const dealDefs = useCustomFieldDefs('deal')
  const leadDefs = useCustomFieldDefs('lead')
  const [dealFields, setDealFields] = useState<CustomFieldValues>({})
  const [makeDeal, setMakeDeal] = useState<boolean | null>(null)
  const [dealTitle, setDealTitle] = useState<string | null>(null)
  const [dealValue, setDealValue] = useState<string | null>(null)
  const [dealStageId, setDealStageId] = useState<string | null>(null)
  const [dealClose, setDealClose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Defaults follow the suggestions: an existing match is pre-selected.
  const s = suggestions.data
  const cMode = contactMode ?? (s?.contacts.length ? 'link' : 'create')
  const cPick = contact ?? (s?.contacts[0] ? { id: s.contacts[0].id, label: s.contacts[0].displayName } : null)
  const coMode = companyMode ?? (s?.companies.length ? 'link' : lead.companyName ? 'create' : 'none')
  const coPick = company ?? (s?.companies[0] ? { id: s.companies[0].id, label: s.companies[0].name } : null)
  const withDeal = (makeDeal ?? Boolean(s?.dealsAvailable)) && Boolean(s?.dealsAvailable)
  const stageOptions = (pipelines.data ?? []).filter((p) => !p.archived && !p.readOnly).flatMap((p) => p.stages.filter((st) => st.type === 'open').map((st) => ({ id: st.id, pipelineId: p.id, requiredFields: st.requiredFields, label: `${p.name} → ${st.name}` })))
  const stage = stageOptions.find((o) => o.id === (dealStageId ?? s?.defaultStageId)) ?? stageOptions[0]
  const title = dealTitle ?? s?.dealTitle ?? ''
  const valueText = dealValue ?? minorToRupeesText(s?.dealValueMinor)
  const requiredDefs = (dealDefs.data ?? []).filter((d) => !d.archived && stage?.requiredFields.includes(`cf.${d.key}`))
  const copiedFields = Object.fromEntries((dealDefs.data ?? []).filter((d) => (leadDefs.data ?? []).some((l) => l.key === d.key && l.type === d.type) && lead.customFields[d.key] !== undefined).map((d) => [d.key, lead.customFields[d.key]]))

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const input: ConvertInput = {
        contact: cMode === 'link' && cPick ? { mode: 'link', contactId: cPick.id } : { mode: 'create' },
        company: coMode === 'link' && coPick ? { mode: 'link', companyId: coPick.id } : coMode === 'create' ? { mode: 'create', name: companyName.trim() || null } : { mode: 'none' },
        ...(withDeal && stage && { deal: { create: true, pipelineId: stage.pipelineId, stageId: stage.id, title: title.trim() || null, valueMinor: rupeesToMinor(valueText) ?? 0, customFields: dealFields, ...(dealClose && { expectedCloseDate: dealClose }) } }),
      }
      const result = await convertLead(lead.id, input)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.all }),
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).contacts.all }),
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).companies.all }),
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all }),
      ])
      notify({ title: 'Lead converted', description: result.dealId ? 'Contact and deal created — the history moved with them.' : 'The contact now holds this lead’s details and history.' })
      onClose()
      navigate(result.dealId ? `/app/deals/${result.dealId}` : `/app/contacts/${result.contactId}`)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setError(Object.values(err.fields)[0])
      else if (!handleGlobalApiError(err)) setError(err instanceof ApiError ? err.message : 'Couldn’t convert. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  const invalid = (cMode === 'link' && !cPick) || (coMode === 'link' && !coPick) || (coMode === 'create' && !companyName.trim()) || (withDeal && (!stage || pipelines.isPending || dealDefs.isPending || leadDefs.isPending))

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Convert ${lead.displayName}`}
      description={lead.status !== 'qualified' ? 'This lead isn’t marked qualified yet — you can still convert it.' : 'Turn this lead into a customer record.'}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={invalid || suggestions.isPending}>
            Convert
          </Button>
        </>
      }
    >
      {suggestions.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-4">
          <Section icon={UserRound} title="Contact">
            <Choice checked={cMode === 'create'} onChange={() => setContactMode('create')} title="Create a new contact" hint={[lead.displayName, formatPhone(lead.primaryPhoneE164, lead.phones[0]?.raw)].filter((v) => v && v !== '—').join(' · ')} />
            <Choice
              checked={cMode === 'link'}
              onChange={() => setContactMode('link')}
              title="Add to an existing contact"
              hint={s?.contacts.length ? `${s.contacts.length} with the same ${s.contacts[0].matchedOn === 'phone' ? 'phone' : 'email'}` : undefined}
            />
            {cMode === 'link' && (
              <RecordPicker
                queryKey={qk.org(orgId).contacts.all}
                search={async (q) => {
                  if (!q && s?.contacts.length) return s.contacts.map((c) => ({ id: c.id, label: c.displayName, hint: `Same ${c.matchedOn}: ${c.value}` }))
                  return (await listContacts({ q, limit: 10 })).items.map((c) => ({ id: c.id, label: c.displayName, hint: c.primaryEmail ?? formatPhone(c.primaryPhoneE164) }))
                }}
                selected={cPick}
                onChange={setContact}
                placeholder="Search contacts…"
              />
            )}
          </Section>

          <Section icon={Building2} title="Company">
            <Choice checked={coMode === 'none'} onChange={() => setCompanyMode('none')} title="No company" />
            <Choice checked={coMode === 'create'} onChange={() => setCompanyMode('create')} title="Create a new company" />
            {coMode === 'create' && (
              <Field label="Company name">{({ id }) => <Input id={id} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />}</Field>
            )}
            <Choice checked={coMode === 'link'} onChange={() => setCompanyMode('link')} title="Link an existing company" hint={s?.companies.length ? `${s.companies.length} similar name${s.companies.length === 1 ? '' : 's'} found` : undefined} />
            {coMode === 'link' && (
              <RecordPicker
                queryKey={qk.org(orgId).companies.all}
                search={async (q) => (await listCompanies({ q: q || lead.companyName || '', limit: 10 })).items.map((c) => ({ id: c.id, label: c.name, hint: c.domain }))}
                selected={coPick}
                onChange={setCompany}
                placeholder="Search companies…"
              />
            )}
          </Section>

          <Section icon={SquareKanban} title="Deal">
            {s?.dealsAvailable ? (
              <>
                <Choice checked={withDeal} onChange={() => setMakeDeal(true)} title="Create a deal" hint="Linked to the contact and company, with the lead’s source and tags" />
                <Choice checked={!withDeal} onChange={() => setMakeDeal(false)} title="No deal for now" />
                {withDeal && (
                  <div className="space-y-3 pt-1">
                    <Field label="Deal title">{({ id }) => <Input id={id} value={title} onChange={(e) => setDealTitle(e.target.value)} />}</Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Value" optional>
                        {({ id }) => (
                          <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-500">₹</span>
                            <Input id={id} inputMode="decimal" className="pl-7" value={valueText} onChange={(e) => setDealValue(e.target.value)} />
                          </div>
                        )}
                      </Field>
                      <Field label="Expected close" optional>{({ id }) => <Input id={id} type="date" value={dealClose} onChange={(e) => setDealClose(e.target.value)} />}</Field>
                    </div>
                    <Field label="Stage">
                      {({ id }) => (
                        <Select id={id} value={stage?.id ?? ''} onChange={(e) => setDealStageId(e.target.value)}>
                          {stageOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    {requiredDefs.map((def) => (
                      <Field key={def.id} label={def.label}>
                        {({ id }) => <CustomFieldInput def={def} id={id} value={def.key in dealFields ? dealFields[def.key] : copiedFields[def.key]} onChange={(value) => setDealFields((fields) => ({ ...fields, [def.key]: value }))} />}
                      </Field>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">Set up a pipeline (Settings → Pipelines) to create a deal when converting.</p>
            )}
          </Section>
          {error && <FormAlert>{error}</FormAlert>}
        </div>
      )}
    </Dialog>
  )
}
