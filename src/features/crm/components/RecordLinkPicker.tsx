import { useState } from 'react'
import { Field, Select } from '../../../components/ui/Form'
import { useCan } from '../../../lib/useOrg'
import { useOrgId } from '../hooks'
import type { RecordType } from '../types'
import { listLeads } from '../../leads/api'
import { listContacts } from '../../contacts/api'
import { listCompanies } from '../../companies/api'
import { listDeals } from '../../deals/api'
import { RecordPicker } from './RecordPicker'

export interface LinkedRecord { entityType: RecordType; entityId: string; name: string | null }
const recordLabels: Record<RecordType, string> = { lead: 'Lead', contact: 'Contact', company: 'Company', deal: 'Deal' }
export function RecordLinkPicker({ value, onChange }: { value: LinkedRecord | null; onChange: (value: LinkedRecord | null) => void }) {
  const orgId = useOrgId()
  const lead = useCan('leads.read'), contact = useCan('contacts.read'), company = useCan('companies.read'), deal = useCan('deals.read')
  const available = (Object.keys(recordLabels) as RecordType[]).filter((type) => ({ lead, contact, company, deal })[type])
  const [chosenType, setType] = useState<RecordType>(value?.entityType || available[0] || 'lead')
  const type = value?.entityType || chosenType
  if (!available.length) return <p className="text-sm text-muted">Your role can create an unlinked event.</p>
  return <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
    <Field label="Record type">{({ id }) => <Select id={id} value={type} onChange={(event) => { setType(event.target.value as RecordType); onChange(null) }}>{available.map((type) => <option key={type} value={type}>{recordLabels[type]}</option>)}</Select>}</Field>
    <Field label={`Link a ${type}`} optional>{({ id, describedBy }) => <RecordPicker key={type} id={id} describedBy={describedBy} queryKey={['org', orgId, 'record-link', type]} selected={value ? { id: value.entityId, label: value.name || recordLabels[type] } : null} onChange={(option) => onChange(option ? { entityType: type, entityId: option.id, name: option.label } : null)} placeholder={`Search ${recordLabels[type].toLowerCase()} records`} search={async (q) => {
      const params = { q, limit: 10 }
      if (type === 'lead') return (await listLeads(params)).items.map((row) => ({ id: row.id, label: row.displayName }))
      if (type === 'contact') return (await listContacts(params)).items.map((row) => ({ id: row.id, label: row.displayName }))
      if (type === 'company') return (await listCompanies(params)).items.map((row) => ({ id: row.id, label: row.name }))
      return (await listDeals(params)).items.map((row) => ({ id: row.id, label: row.title }))
    }} />}</Field>
  </div>
}
