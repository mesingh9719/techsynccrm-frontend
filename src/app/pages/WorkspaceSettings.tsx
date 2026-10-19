import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ImageUp, Lock, ShieldCheck, Trash2 } from 'lucide-react'
import { emitAppEvent } from '../../lib/appEvents'
import { deleteCurrentOrganization, updateCurrentOrganization, uploadImage, type OrganizationUpdate } from '../../services/organizations'
import { fetchMe } from '../../services/auth'
import { ApiError } from '../../services/http'
import { companySizes, industries, workspaceSettingsSchema, type WorkspaceSettingsValues } from '../../lib/schemas'
import { gstStates, timeZoneOptions } from '../../lib/india'
import { nextPathFor } from '../../lib/useAuth'
import { useCan, useEntitlement, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { qk } from '../../lib/queryKeys'
import type { Organization } from '../../types'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-zinc-200">
      <h2 className="font-semibold text-zinc-950">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

const toValues = (org: Organization): WorkspaceSettingsValues => ({
  name: org.name,
  slug: org.slug,
  industry: org.industry ?? '',
  teamSize: org.teamSize ?? '',
  timezone: org.timezone,
  currency: org.currency,
  stateCode: org.stateCode ?? '',
  gstin: org.gstin ?? '',
  legalName: org.legalName ?? '',
  line1: org.address?.line1 ?? '',
  line2: org.address?.line2 ?? '',
  city: org.address?.city ?? '',
  pincode: org.address?.pincode ?? '',
})

function toUpdate(v: WorkspaceSettingsValues): OrganizationUpdate {
  const address = { line1: v.line1 || null, line2: v.line2 || null, city: v.city || null, pincode: v.pincode || null }
  return {
    name: v.name,
    slug: v.slug,
    industry: v.industry || null,
    teamSize: v.teamSize || null,
    timezone: v.timezone,
    currency: v.currency,
    stateCode: v.stateCode || null,
    gstin: v.gstin || null,
    legalName: v.legalName || null,
    address: Object.values(address).some(Boolean) ? address : null,
  }
}

/** Server field names → form field names (address.city → city). */
const formField = (key: string) => key.replace(/^address\./, '') as keyof WorkspaceSettingsValues

function LogoUploader({ org, canEdit, onChanged }: { org: Organization; canEdit: boolean; onChanged: (org: Organization) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const notify = useToast()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError('Use a PNG, JPG or WebP image.')
    if (file.size > MAX_LOGO_BYTES) return setError('Keep the logo under 2 MB.')
    try {
      setProgress(0)
      const fileId = await uploadImage(file, setProgress)
      onChanged(await updateCurrentOrganization({ logoFileId: fileId }))
      notify({ title: 'Logo updated' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setProgress(null)
    }
  }

  async function remove() {
    try {
      onChanged(await updateCurrentOrganization({ logoFileId: null }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t remove the logo.')
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-200">
        {org.logoUrl ? (
          <img src={org.logoUrl} alt={`${org.name} logo`} className="size-full object-contain" />
        ) : (
          <span className="text-xl font-semibold text-zinc-400" aria-hidden="true">
            {org.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={progress !== null}>
              <ImageUp className="size-4" aria-hidden="true" />
              {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : org.logoUrl ? 'Replace logo' : 'Upload logo'}
            </Button>
            {org.logoUrl && (
              <Button variant="ghost" size="sm" onClick={remove}>
                Remove
              </Button>
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-zinc-500">PNG, JPG or WebP, up to 2 MB. A square image works best.</p>
        {error && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function SettingsForm({ org, canEdit }: { org: Organization; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const notify = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const [tzOptions] = useState(() => timeZoneOptions(org.timezone))
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WorkspaceSettingsValues>({ resolver: zodResolver(workspaceSettingsSchema), defaultValues: toValues(org) })

  function applyOrg(updated: Organization) {
    queryClient.setQueryData(qk.org(updated.id).current, (old: { organization: Organization } | undefined) => (old ? { ...old, organization: updated } : old))
    void queryClient.invalidateQueries({ queryKey: qk.workspaces })
    void queryClient.invalidateQueries({ queryKey: qk.org(updated.id).checklist })
  }

  const onSubmit = async (values: WorkspaceSettingsValues) => {
    setServerError(null)
    try {
      const updated = await updateCurrentOrganization(toUpdate(values))
      applyOrg(updated)
      reset(toValues(updated))
      // Name/slug appear in the session (sidebar, switcher).
      if (updated.name !== org.name || updated.slug !== org.slug) await fetchMe().catch(() => {})
      notify({ title: 'Workspace settings saved' })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [key, message] of Object.entries(err.fields)) setError(formField(key), { message }, { shouldFocus: true })
      } else setServerError(err instanceof ApiError && err.status < 500 && err.status !== 0 ? err.message : 'Couldn’t save your changes. Please try again.')
    }
  }

  const disabled = !canEdit
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Section title="Workspace" description="How your company appears to your team.">
        <LogoUploader org={org} canEdit={canEdit} onChanged={applyOrg} />
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Company name" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('name')} />}
          </Field>
          <Field label="Workspace address" error={errors.slug?.message} hint="Lowercase letters, numbers and hyphens.">
            {({ id, describedBy, invalid }) => <Input id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('slug')} />}
          </Field>
          <Field label="Industry" error={errors.industry?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('industry')}>
                <option value="">Not set</option>
                {industries.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Team size" error={errors.teamSize?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('teamSize')}>
                <option value="">Not set</option>
                {companySizes.map((s) => (
                  <option key={s} value={s}>
                    {s} people
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Regional settings" description="Used for “today”, reminders, reports and money formatting.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Time zone" error={errors.timezone?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('timezone')}>
                {tzOptions.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Currency" error={errors.currency?.message} hint="Can’t be changed once deals or quotes exist.">
            {({ id, describedBy, invalid }) => (
              <Select id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('currency')}>
                <option value="INR">Indian rupee (₹)</option>
                <option value="USD">US dollar ($)</option>
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Business details" description="Printed on quotes and invoices. GSTIN must match the state.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Legal name" optional error={errors.legalName?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} disabled={disabled} placeholder="e.g. Saffron Retail Pvt. Ltd." aria-describedby={describedBy} invalid={invalid} {...register('legalName')} />}
          </Field>
          <Field label="GSTIN" optional error={errors.gstin?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} disabled={disabled} placeholder="29ABCDE1234F1Z5" className="font-mono uppercase" aria-describedby={describedBy} invalid={invalid} {...register('gstin')} />
            )}
          </Field>
          <Field label="Address line 1" optional error={errors.line1?.message} className="sm:col-span-2">
            {({ id, describedBy, invalid }) => <Input id={id} disabled={disabled} autoComplete="address-line1" aria-describedby={describedBy} invalid={invalid} {...register('line1')} />}
          </Field>
          <Field label="Address line 2" optional error={errors.line2?.message} className="sm:col-span-2">
            {({ id, describedBy, invalid }) => <Input id={id} disabled={disabled} autoComplete="address-line2" aria-describedby={describedBy} invalid={invalid} {...register('line2')} />}
          </Field>
          <Field label="City" optional error={errors.city?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} disabled={disabled} autoComplete="address-level2" aria-describedby={describedBy} invalid={invalid} {...register('city')} />}
          </Field>
          <Field label="PIN code" optional error={errors.pincode?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} disabled={disabled} inputMode="numeric" autoComplete="postal-code" aria-describedby={describedBy} invalid={invalid} {...register('pincode')} />
            )}
          </Field>
          <Field label="State" optional error={errors.stateCode?.message} className="sm:col-span-2">
            {({ id, describedBy, invalid }) => (
              <Select id={id} disabled={disabled} aria-describedby={describedBy} invalid={invalid} {...register('stateCode')}>
                <option value="">Choose a state</option>
                {gstStates.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name} ({code})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      {serverError && <FormAlert>{serverError}</FormAlert>}
      {canEdit ? (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={!isDirty || isSubmitting} onClick={() => reset(toValues(org))}>
            Discard
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Only workspace owners and admins can change these settings.</p>
      )}
    </form>
  )
}

/** Owners/admins can require every member to use 2FA. They must have it on themselves first. */
function SecuritySection({ org }: { org: Organization }) {
  const queryClient = useQueryClient()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const entitlement = useEntitlement('require2fa')

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateCurrentOrganization({ require2fa: !org.require2fa })
      queryClient.setQueryData(qk.org(updated.id).current, (old: { organization: Organization } | undefined) => (old ? { ...old, organization: updated } : old))
      await fetchMe().catch(() => {})
      notify({ title: updated.require2fa ? 'Two-factor authentication is now required' : 'Two-factor authentication is now optional' })
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t update this setting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Security" description="Applies to everyone in this workspace.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className={org.require2fa ? 'mt-0.5 size-5 text-emerald-600' : 'mt-0.5 size-5 text-zinc-400'} aria-hidden="true" />
          <div>
            <p className="font-medium text-zinc-900">Require two-factor authentication</p>
            <p className="text-sm text-zinc-500">
              {!entitlement.enabled && org.require2fa
                ? 'Paused — this is a Business plan feature. Members can use the workspace without 2FA until you upgrade.'
                : org.require2fa
                  ? 'Members must set up an authenticator app before they can use this workspace.'
                  : 'When on, members without 2FA are asked to set it up on their next visit.'}
            </p>
          </div>
        </div>
        {!entitlement.enabled && !org.require2fa ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => emitAppEvent({ type: 'upgrade', reason: 'feature', feature: 'require2fa', requiredPlan: entitlement.requiredPlan ?? 'business' })}
          >
            <Lock className="size-3.5" aria-hidden="true" />
            Business plan
          </Button>
        ) : (
          <Button variant={org.require2fa ? 'secondary' : 'primary'} size="sm" loading={busy} onClick={toggle} aria-pressed={org.require2fa}>
            {org.require2fa ? 'Turn off' : 'Require 2FA'}
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </Section>
  )
}

function DangerZone({ org }: { org: Organization }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    setError(null)
    try {
      const user = await deleteCurrentOrganization(org.name)
      queryClient.clear()
      notify({ title: `${org.name} was deleted` })
      navigate(nextPathFor(user), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.confirmName ?? err.message) : 'Couldn’t delete the workspace. Please try again.')
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-red-200">
      <h2 className="font-semibold text-red-700">Delete workspace</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Everyone loses access immediately. Your data is kept for 30 days in case you change your mind — contact support to restore it.
      </p>
      <Button variant="secondary" className="mt-5 text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete workspace
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false)
          setError(null)
        }}
        onConfirm={onDelete}
        tone="danger"
        title={`Delete ${org.name}?`}
        description="All members will lose access to its leads, deals and settings."
        confirmLabel="Delete workspace"
        requireText={org.name}
        error={error}
      />
    </section>
  )
}

export default function WorkspaceSettings() {
  useSeo({ title: 'Workspace settings', noindex: true })
  const { organization, query } = useOrg()
  const canEdit = useCan('settings.workspace.manage')
  const canDelete = useCan('organization.delete')

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading workspace settings">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }
  if (query.isError || !organization) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <div className="space-y-6">
      {/* Remount the form when the server copy changes from elsewhere (e.g. switching workspace). */}
      <SettingsForm key={organization.id} org={organization} canEdit={canEdit} />
      {canEdit && <SecuritySection org={organization} />}
      {canDelete && <DangerZone org={organization} />}
    </div>
  )
}
