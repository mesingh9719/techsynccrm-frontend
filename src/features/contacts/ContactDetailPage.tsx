import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Mail, MessageCircle, Pencil, Phone, Star, Trash2 } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
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
import { formatCustomValue } from '../crm/customFieldFormat'
import { DeletedBanner, FieldRow, InlineText, OwnerCell, Panel, UpcomingSlot } from '../crm/components/RecordParts'
import { TagChips } from '../crm/components/Tags'
import { formatPhone, lifecycleLabels, relativeTime, whatsappLink } from '../crm/format'
import { useCustomFieldDefs, useOrgId } from '../crm/hooks'
import { Timeline } from '../activities/Timeline'
import { RecordDeals } from '../deals/RecordDeals'
import { RecordTasks } from '../tasks/RecordTasks'
import { deleteContact, getContact, restoreContact, updateContact, type ContactInput } from './api'
import { ContactFormDrawer } from './ContactFormDrawer'

const dateTime = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso)) : null)

/** /app/contacts/:id — header, details with inline edit, companies, consent; slots for timeline, deals, files. */
export default function ContactDetailPage() {
  const { id = '' } = useParams()
  const orgId = useOrgId()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const query = useQuery({ queryKey: qk.org(orgId).contacts.detail(id), queryFn: () => getContact(id) })
  const defs = useCustomFieldDefs('contact')
  const canUpdateAny = useCan('contacts.update')
  const canDeleteAny = useCan('contacts.delete')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const contact = query.data
  useSeo({ title: contact?.displayName ?? 'Contact', noindex: true })

  if (query.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-6xl rounded-2xl" />
  if (query.isError || !contact) return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>

  // Own-scope roles can only change records they own (the server enforces this too).
  const permissions = user?.organization?.permissions ?? []
  const ownScoped = (action: string) => permissions.includes(`contacts.${action}.own`) && contact.ownerId !== user?.id
  const canUpdate = canUpdateAny && !ownScoped('update') && !contact.deletedAt
  const canDelete = canDeleteAny && !ownScoped('delete')

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).contacts.all })
  async function patch(values: ContactInput) {
    try {
      const saved = await updateContact(contact!.id, values, { ifMatch: contact!.updatedAt })
      queryClient.setQueryData(qk.org(orgId).contacts.detail(id), saved)
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).contacts.lists })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') await refresh()
      if (handleGlobalApiError(err)) throw new Error('Not saved')
      throw new Error(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save')
    }
  }

  const primaryPhone = contact.phones.find((p) => p.primary) ?? contact.phones[0]
  const primaryEmail = contact.primaryEmail
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived || contact.customFields[d.key] !== undefined)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/app/contacts" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Contacts
      </Link>

      {contact.deletedAt && (
        <div className="mt-4">
          <DeletedBanner
            deletedAt={contact.deletedAt}
            merged={Boolean(contact.mergedIntoId)}
            canRestore={canDelete}
            onRestore={async () => {
              try {
                const restored = await restoreContact(contact.id)
                queryClient.setQueryData(qk.org(orgId).contacts.detail(id), restored)
                await refresh()
                notify({ title: 'Contact restored' })
              } catch (err) {
                if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t restore', description: err instanceof ApiError ? err.message : undefined })
              }
            }}
          />
          {contact.mergedIntoId && (
            <Link to={`/app/contacts/${contact.mergedIntoId}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              Open the contact it was merged into →
            </Link>
          )}
        </div>
      )}

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar name={contact.displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{contact.displayName}</h1>
            <p className="mt-0.5 text-sm text-zinc-600">{[contact.title, contact.companies.find((c) => c.isPrimary)?.name].filter(Boolean).join(' at ') || 'No company yet'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={contact.lifecycleStage === 'customer' ? 'success' : 'neutral'}>{lifecycleLabels[contact.lifecycleStage]}</Badge>
              <TagChips tags={contact.tags} max={6} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryPhone && (
            <Button href={`tel:${primaryPhone.e164 ?? primaryPhone.raw}`} variant="secondary" size="sm">
              <Phone className="size-4" aria-hidden="true" />
              Call
            </Button>
          )}
          {primaryPhone?.e164 && (
            <Button href={whatsappLink(primaryPhone.e164)!} target="_blank" rel="noreferrer" variant="secondary" size="sm">
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </Button>
          )}
          {primaryEmail && (
            <Button href={`mailto:${primaryEmail}`} variant="secondary" size="sm">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </Button>
          )}
          {canUpdate && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {canDelete && !contact.deletedAt && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete contact">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-zinc-100">
              <FieldRow label="First name">
                <InlineText label="first name" value={contact.firstName} disabled={!canUpdate} onSave={(v) => patch({ firstName: v })} />
              </FieldRow>
              <FieldRow label="Last name">
                <InlineText label="last name" value={contact.lastName} disabled={!canUpdate} onSave={(v) => patch({ lastName: v })} />
              </FieldRow>
              <FieldRow label="Job title">
                <InlineText label="job title" value={contact.title} disabled={!canUpdate} onSave={(v) => patch({ title: v })} />
              </FieldRow>
              <FieldRow label="Phone">
                {contact.phones.length ? (
                  <ul className="space-y-1">
                    {contact.phones.map((p) => (
                      <li key={p.raw} className="flex items-center gap-1.5 tabular-nums">
                        {p.primary && <Star className="size-3 fill-amber-400 text-amber-400" aria-label="Primary" />}
                        <a href={`tel:${p.e164 ?? p.raw}`} className="hover:underline">
                          {formatPhone(p.e164, p.raw)}
                        </a>
                        {p.whatsapp && <Badge tone="success">WhatsApp</Badge>}
                        {!p.e164 && <span className="text-xs text-amber-700">(not a valid number)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </FieldRow>
              <FieldRow label="Email">
                {contact.emails.length ? (
                  <ul className="space-y-1">
                    {contact.emails.map((e) => (
                      <li key={e.value} className="flex items-center gap-1.5">
                        {e.primary && <Star className="size-3 fill-amber-400 text-amber-400" aria-label="Primary" />}
                        <a href={`mailto:${e.value}`} className="truncate hover:underline">
                          {e.value}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </FieldRow>
              <FieldRow label="Owner">
                <OwnerCell owner={contact.owner} emptyLabel="No owner" />
              </FieldRow>
              <FieldRow label="Source">
                <InlineText label="source" value={contact.source} disabled={!canUpdate} onSave={(v) => patch({ source: v })} />
              </FieldRow>
              <FieldRow label="Created">{relativeTime(contact.createdAt)}</FieldRow>
              {activeDefs.map((d) => (
                <FieldRow key={d.id} label={d.label}>
                  {formatCustomValue(d, contact.customFields[d.key])}
                </FieldRow>
              ))}
            </dl>
          </Panel>

          <Panel title="Companies">
            {contact.companies.length ? (
              <ul className="space-y-2">
                {contact.companies.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <Building2 className="size-4 text-zinc-400" aria-hidden="true" />
                    <Link to={`/app/companies/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                      {c.name}
                    </Link>
                    {c.role && <span className="text-zinc-500">· {c.role}</span>}
                    {c.isPrimary && contact.companies.length > 1 && <Badge>Primary</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Not linked to a company.{canUpdate && ' Edit the contact to link one.'}</p>
            )}
          </Panel>

          <Panel title="Consent">
            <dl className="divide-y divide-zinc-100">
              <FieldRow label="WhatsApp">{contact.whatsappOptInAt ? `Opted in ${dateTime(contact.whatsappOptInAt)}` : 'Not opted in'}</FieldRow>
              <FieldRow label="Marketing email">{contact.emailOptInAt ? `Opted in ${dateTime(contact.emailOptInAt)}` : 'Not opted in'}</FieldRow>
              {contact.optOutAt && <FieldRow label="Opted out">{dateTime(contact.optOutAt)}</FieldRow>}
            </dl>
          </Panel>
        </div>

        <div className="space-y-6">
          <RecordTasks entityType="contact" entityId={contact.id} recordName={contact.displayName} />
          <RecordDeals contact={{ id: contact.id, name: contact.displayName }} />
          <Timeline entityType="contact" entityId={contact.id} recordName={contact.displayName} canPin={canUpdate} />
          <UpcomingSlot kind="files" />
        </div>
      </div>

      {editing && <ContactFormDrawer open contact={contact} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteContact(contact.id)
          await refresh()
          notify({ title: 'Contact deleted', description: 'You can restore it from the bin for 30 days.' })
          navigate('/app/contacts')
        }}
        title={`Delete ${contact.displayName}?`}
        description="It moves to the bin and can be restored for 30 days."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}
