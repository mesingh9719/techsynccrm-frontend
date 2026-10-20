import { Attachments } from '../files/Attachments'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Globe, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { gstStates } from '../../lib/india'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { ApiError } from '../../services/http'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { ContactFormDrawer } from '../contacts/ContactFormDrawer'
import { formatCustomValue } from '../crm/customFieldFormat'
import { DeletedBanner, FieldRow, InlineText, OwnerCell, Panel, UpcomingSlot } from '../crm/components/RecordParts'
import { TagChips } from '../crm/components/Tags'
import { formatPhone, relativeTime } from '../crm/format'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import { Timeline } from '../activities/Timeline'
import { RecordDeals } from '../deals/RecordDeals'
import { RecordTasks } from '../tasks/RecordTasks'
import { deleteCompany, getCompany, listCompanyContacts, restoreCompany, updateCompany, type CompanyInput } from './api'
import { CompanyFormDrawer } from './CompanyFormDrawer'

const stateName = (code: string | null | undefined) => gstStates.find(([c]) => c === code)?.[1] ?? null

/** /app/companies/:id */
export default function CompanyDetailPage() {
  const { id = '' } = useParams()
  const orgId = useOrgId()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const query = useQuery({ queryKey: qk.org(orgId).companies.detail(id), queryFn: () => getCompany(id) })
  const contacts = useQuery({ queryKey: [...qk.org(orgId).companies.detail(id), 'contacts'], queryFn: () => listCompanyContacts(id) })
  const defs = useCustomFieldDefs('company')
  const canUpdateAny = useCan('companies.update')
  const canDeleteAny = useCan('companies.delete')
  const canCreateContact = useCan('contacts.create')
  const [editing, setEditing] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const company = query.data
  useSeo({ title: company?.name ?? 'Company', noindex: true })

  if (query.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-6xl rounded-2xl" />
  if (query.isError || !company) return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>

  const permissions = user?.organization?.permissions ?? []
  const ownScoped = (action: string) => permissions.includes(`companies.${action}.own`) && company.ownerId !== user?.id
  const canUpdate = canUpdateAny && !ownScoped('update') && !company.deletedAt
  const canDelete = canDeleteAny && !ownScoped('delete')
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).companies.all })

  async function patch(values: CompanyInput) {
    try {
      const saved = await updateCompany(company!.id, values, { ifMatch: company!.updatedAt })
      queryClient.setQueryData(qk.org(orgId).companies.detail(id), saved)
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).companies.lists })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await refresh()
      if (handleGlobalApiError(err)) throw new Error('Not saved')
      throw new Error(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save')
    }
  }

  const address = company.billingAddress
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived || company.customFields[d.key] !== undefined)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/app/companies" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Companies
      </Link>
      {company.deletedAt && (
        <div className="mt-4">
          <DeletedBanner
            deletedAt={company.deletedAt}
            merged={Boolean(company.mergedIntoId)}
            canRestore={canDelete}
            onRestore={async () => {
              try {
                queryClient.setQueryData(qk.org(orgId).companies.detail(id), await restoreCompany(company.id))
                await refresh()
                notify({ title: 'Company restored' })
              } catch (err) {
                if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t restore', description: err instanceof ApiError ? err.message : undefined })
              }
            }}
          />
          {company.mergedIntoId && (
            <Link to={`/app/companies/${company.mergedIntoId}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              Open the company it was merged into →
            </Link>
          )}
        </div>
      )}

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">{company.name.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{company.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-600">{[company.industry, address?.city, stateName(address?.stateCode)].filter(Boolean).join(' · ') || 'No details yet'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {company.gstin && <Badge tone="brand">GST registered</Badge>}
              <TagChips tags={company.tags} max={6} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {company.website && (
            <Button href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" variant="secondary" size="sm">
              <Globe className="size-4" aria-hidden="true" />
              Website
            </Button>
          )}
          {(company.phoneE164 || company.phoneRaw) && (
            <Button href={`tel:${company.phoneE164 ?? company.phoneRaw}`} variant="secondary" size="sm">
              <Phone className="size-4" aria-hidden="true" />
              Call
            </Button>
          )}
          {canUpdate && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {canDelete && !company.deletedAt && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete company">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-zinc-100">
              <FieldRow label="Name">
                <InlineText label="name" value={company.name} disabled={!canUpdate} onSave={(v) => (v ? patch({ name: v }) : Promise.reject(new Error('A company needs a name')))} />
              </FieldRow>
              <FieldRow label="Domain">{company.domain ?? '—'}</FieldRow>
              <FieldRow label="Phone">{formatPhone(company.phoneE164, company.phoneRaw)}</FieldRow>
              <FieldRow label="Email">{company.email ? <a href={`mailto:${company.email}`} className="hover:underline">{company.email}</a> : '—'}</FieldRow>
              <FieldRow label="Size">{company.size ? `${company.size} employees` : '—'}</FieldRow>
              <FieldRow label="GSTIN">
                <span className="font-mono text-xs">{company.gstin ?? '—'}</span>
              </FieldRow>
              <FieldRow label="Billing address">{address ? [address.line1, address.line2, address.city, stateName(address.stateCode), address.pincode].filter(Boolean).join(', ') || '—' : '—'}</FieldRow>
              <FieldRow label="Owner">
                <OwnerCell owner={company.owner} emptyLabel="No owner" />
              </FieldRow>
              <FieldRow label="Created">{relativeTime(company.createdAt)}</FieldRow>
              {activeDefs.map((d) => (
                <FieldRow key={d.id} label={d.label}>
                  {formatCustomValue(d, company.customFields[d.key])}
                </FieldRow>
              ))}
            </dl>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel
            title={`Contacts${contacts.data ? ` (${contacts.data.length})` : ''}`}
            actions={
              canCreateContact &&
              !company.deletedAt && (
                <Button size="sm" variant="secondary" onClick={() => setAddingContact(true)}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add contact
                </Button>
              )
            }
          >
            {contacts.isPending ? (
              <Skeleton className="h-16" />
            ) : contacts.data?.length ? (
              <ul className="divide-y divide-zinc-100">
                {contacts.data.map((c) => (
                  <li key={c.id}>
                    <Link to={`/app/contacts/${c.id}`} className="flex items-center gap-3 py-2.5 hover:bg-zinc-50">
                      <Avatar name={c.displayName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900">{c.displayName}</span>
                        <span className="block truncate text-xs text-zinc-500">{[c.role ?? c.title, formatPhone(c.primaryPhoneE164, null)].filter((v) => v && v !== '—').join(' · ')}</span>
                      </span>
                      {c.isPrimary && <Badge>Primary</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <Users className="size-4" aria-hidden="true" />
                No contacts at this company yet.
              </p>
            )}
          </Panel>
          <RecordDeals company={{ id: company.id, name: company.name }} />
          <RecordTasks entityType="company" entityId={company.id} recordName={company.name} />
          <Attachments entityType="company" entityId={company.id} />
          <Timeline entityType="company" entityId={company.id} recordName={company.name} canPin={canUpdate} />
          <UpcomingSlot kind="files" />
        </div>
      </div>

      {editing && <CompanyFormDrawer open company={company} onClose={() => setEditing(false)} />}
      {addingContact && (
        <ContactFormDrawer
          open
          defaultCompany={{ id: company.id, label: company.name }}
          onClose={() => {
            setAddingContact(false)
            void contacts.refetch()
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteCompany(company.id)
          await refresh()
          notify({ title: 'Company deleted', description: 'You can restore it from the bin for 30 days.' })
          navigate('/app/companies')
        }}
        title={`Delete ${company.name}?`}
        description="It moves to the bin and can be restored for 30 days. Its contacts are kept."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}
