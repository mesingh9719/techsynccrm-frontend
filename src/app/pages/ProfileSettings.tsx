import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useRef, useState, type ChangeEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, Check, Clock3, Globe2, ImageUp, Mail, MailWarning, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { discardEmailChange, requestEmailChange, updateProfile } from '../../services/account'
import { fetchMe } from '../../services/auth'
import { uploadImage } from '../../services/organizations'
import { ApiError } from '../../services/http'
import { changeEmailSchema, profileSchema, type ChangeEmailValues, type ProfileValues } from '../../lib/schemas'
import { applyServerErrors } from '../../lib/forms'
import { timeZoneOptions } from '../../lib/india'
import { useAuth } from '../../lib/useAuth'
import { useSeo } from '../../lib/useSeo'
import type { AuthUser } from '../../types'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, PasswordInput, Select } from '../../components/ui/Form'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { UserAvatar } from '../../components/app/UserAvatar'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { formatDate } from '../../lib/format'
import './account-settings.css'
import { SaveBar, SettingsSection } from '../../components/app/SettingsSection'
import { PageHeader } from '../../components/app/States'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024

function PhotoUploader({ user }: { user: AuthUser }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const notify = useToast()
  const [removing, setRemoving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError('Use a PNG, JPG or WebP image.')
    if (file.size > MAX_PHOTO_BYTES) return setError('Keep the photo under 2 MB.')
    try {
      setProgress(0)
      const fileId = await uploadImage(file, setProgress)
      await updateProfile({ avatarFileId: fileId })
      notify({ title: 'Photo updated' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setProgress(null)
    }
  }

  return <section className="account-profile-banner" aria-label="Your profile overview">
    <div className="profile-identity">
      <div className="profile-avatar-frame"><UserAvatar name={user.fullName} url={user.avatarUrl} size="lg" />{user.emailVerified && <span className="profile-avatar-mark" title="Email verified"><Check className="size-3" aria-hidden="true" /></span>}</div>
      <div className="profile-identity-details"><p className="text-[11px] font-medium text-muted">Your personal profile</p><h2 className="mt-1 break-words text-lg font-semibold tracking-tight text-ink">{user.fullName}</h2><p className="mt-1 break-all text-xs leading-5 text-muted">{user.jobRole || user.email}</p><div className="mt-3 flex flex-wrap gap-2"><StatusChip tone={user.emailVerified ? 'success' : 'warning'} icon={BadgeCheck}>{user.emailVerified ? 'Email verified' : 'Email not verified'}</StatusChip>{user.organization && <StatusChip tone="violet" icon={BriefcaseBusiness}>{user.organization.role.replaceAll('_', ' ')}</StatusChip>}</div></div>
      <div className="profile-photo-actions"><div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
        <Button variant="secondary" size="sm" disabled={removing} onClick={() => inputRef.current?.click()} loading={progress !== null}><ImageUp className="size-4" aria-hidden="true" />{progress !== null ? `Uploading ${Math.round(progress * 100)}%` : user.avatarUrl ? 'Change photo' : 'Upload photo'}</Button>
        {user.avatarUrl && <Button variant="ghost" size="sm" disabled={progress !== null} loading={removing} onClick={async () => { setRemoving(true); setError(null); try { await updateProfile({ avatarFileId: null }); notify({ title: 'Photo removed' }) } catch { setError('Couldn’t remove the photo. Try again.') } finally { setRemoving(false) } }}>Remove photo</Button>}
      </div><p className="text-[11px] text-muted">PNG, JPG or WebP · up to 2 MB</p>{progress !== null && <div role="progressbar" aria-label="Profile photo upload" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} className="h-1 overflow-hidden rounded-full bg-brand-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}</div>
    </div>
    {error && <div className="px-5 pb-5"><Notice tone="danger" title="Photo couldn’t be updated">{error}</Notice></div>}
    <div className="profile-banner-facts">{user.organization && <span><Building2 className="size-3.5 shrink-0" aria-hidden="true" />{user.organization.name}</span>}{user.createdAt && <span><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />Joined {formatDate(user.createdAt)}</span>}<span><Globe2 className="size-3.5 shrink-0" aria-hidden="true" />{user.timezone || 'Workspace time zone'}</span></div>
  </section>

}

function ProfileForm({ user }: { user: AuthUser }) {
  const notify = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const [zones] = useState(() => timeZoneOptions(user.timezone ?? undefined))
  const defaults: ProfileValues = { fullName: user.fullName, jobRole: user.jobRole ?? '', phone: user.phone ?? '', timezone: user.timezone ?? '' }
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults })

  const leaveGuard = useUnsavedChanges(isDirty, () => {}, isSubmitting, isDirty)

  const onSubmit = async (values: ProfileValues) => {
    setServerError(null)
    try {
      const updated = await updateProfile({ fullName: values.fullName, jobRole: values.jobRole || null, phone: values.phone || null, timezone: values.timezone || null })
      leaveGuard.markSaved(false)
      reset({ fullName: updated.fullName, jobRole: updated.jobRole ?? '', phone: updated.phone ?? '', timezone: updated.timezone ?? '' })
      notify({ title: 'Profile saved' })
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['fullName', 'jobRole', 'phone', 'timezone']))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {leaveGuard.confirmation}
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-5 sm:grid-cols-2"><legend className="sr-only">Personal details</legend>
        <Field label="Full name" error={errors.fullName?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} {...register('fullName')} />}
        </Field>
        <Field label="Job title" optional error={errors.jobRole?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization-title" aria-describedby={describedBy} invalid={invalid} {...register('jobRole')} />}
        </Field>
        <Field label="Phone" optional error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => (
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id={id}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={() => {
                    field.onBlur()
                    if (field.value) void trigger('phone')
                  }}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            />
          )}
        </Field>
        <Field label="Time zone" error={errors.timezone?.message} hint="Used for your reminders and “today”.">
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} {...register('timezone')}>
              <option value="">Same as workspace</option>
              {zones.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          )}
        </Field>
      </fieldset>
      {serverError && (
        <div className="mt-5">
          <Notice tone="danger" title="Profile not saved">{serverError}</Notice>
        </div>
      )}
      <div className="mt-6">
        <SaveBar dirty={isDirty} saving={isSubmitting} saveLabel="Save profile" onDiscard={() => { reset(defaults); setServerError(null) }} />
      </div>
    </form>
  )
}

function ChangeEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailValues>({ resolver: zodResolver(changeEmailSchema), defaultValues: { newEmail: '', password: '' } })

  function close() {
    reset()
    setServerError(null)
    onClose()
  }

  const onSubmit = async (values: ChangeEmailValues) => {
    setServerError(null)
    try {
      const { pendingEmail } = await requestEmailChange(values)
      await fetchMe().catch(() => {})
      notify({ title: 'Check your new inbox', description: `We sent a confirmation link to ${pendingEmail}.` })
      close()
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['newEmail', 'password']))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Change your email"
      icon={Mail}
      busy={isSubmitting}
      description="We’ll send a confirmation link to the new address. You keep signing in with your current email until you confirm."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="change-email-form" loading={isSubmitting}>
            Send confirmation
          </Button>
        </>
      }
    >
      <form id="change-email-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="New email" error={errors.newEmail?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} disabled={isSubmitting} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} {...register('newEmail')} />}
        </Field>
        <Field label="Current password" error={errors.password?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} disabled={isSubmitting} autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...register('password')} />}
        </Field>
        {serverError && <FormAlert>{serverError}</FormAlert>}
      </form>
    </Dialog>
  )
}

function EmailSection({ user }: { user: AuthUser }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [error, setError] = useState('')

  async function discard() {
    setDiscarding(true); setError('')
    try {
      await discardEmailChange()
      await fetchMe()
      notify({ title: 'Email change cancelled' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t cancel the email change. Try again.')
    } finally {
      setDiscarding(false)
    }
  }

  return (
    <>
      <div className="account-email-address">
        <div className="account-email-identity"><span className="account-help-icon"><Mail className="size-4" aria-hidden="true" /></span><div><p className="break-all text-sm font-semibold text-ink">{user.email}</p><p className="mt-1 text-xs leading-5 text-muted">Your sign-in email and account notifications.</p><div className="mt-2"><StatusChip tone={user.emailVerified ? 'success' : 'warning'} icon={BadgeCheck}>{user.emailVerified ? 'Verified address' : 'Verification needed'}</StatusChip></div></div></div>
        <Button variant="secondary" size="sm" disabled={user.hasPassword === false} onClick={() => setOpen(true)}>Change email<ArrowRight className="size-3.5" aria-hidden="true" /></Button>
      </div>
      {user.pendingEmail && <Notice tone="warning" icon={MailWarning} className="mt-4" title="Confirm your new email" actions={<Button variant="secondary" size="sm" onClick={discard} loading={discarding}>Cancel change</Button>}>Check <strong className="break-all font-semibold">{user.pendingEmail}</strong> for a confirmation link. Keep signing in with your current email until you confirm.</Notice>}
      {user.hasPassword === false && <Notice title="Set a password to change your email" className="mt-4" actions={<Button size="sm" variant="secondary" to="/app/settings/security">Open Security<ArrowRight className="size-3.5" aria-hidden="true" /></Button>}>Your account uses Google sign-in. Add a password in Security before changing your sign-in email.</Notice>}
      {error && <Notice tone="danger" title="Email change couldn’t be cancelled" className="mt-4">{error}</Notice>}
      <ChangeEmailDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default function ProfileSettings() {
  useSeo({ title: 'Profile settings', noindex: true })
  const { user } = useAuth()
  if (!user) return null
  return <div className="account-settings space-y-6">
    <PageHeader title="Profile" description="Make your workspace feel a little more like you." />
    <PhotoUploader user={user} />
    <div className="account-settings-grid">
      <div className="account-settings-main">
        <SettingsSection icon={UserRound} title="Personal details" description="Your name, contact details and preferences." actions={<StatusChip tone="neutral">Your account</StatusChip>}><ProfileForm key={user.id} user={user} /></SettingsSection>
        <SettingsSection icon={Mail} title="Email address" description="Manage the address you use to sign in."><EmailSection user={user} /></SettingsSection>
      </div>
      <aside className="account-settings-aside" aria-label="Profile help">
        <SettingsSection icon={Sparkles} title="A profile that feels like you"><ul className="account-help-list">{[
          { icon: UserRound, title: 'Be easy to recognise', text: 'A name and photo help teammates find the right person.' },
          { icon: BriefcaseBusiness, title: 'Share your role', text: 'Add your job title so your team knows what you do.' },
          { icon: Clock3, title: 'Keep time on your side', text: 'Your time zone controls reminders and what counts as today.' },
        ].map(({ icon: Icon, title, text }) => <li key={title}><span className="account-help-icon"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-xs font-semibold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div></li>)}</ul></SettingsSection>
        {user.organization && <SettingsSection icon={Building2} title="Your workspace"><dl className="account-facts"><div><dt>Workspace</dt><dd>{user.organization.name}</dd></div><div><dt>Workspace role</dt><dd className="capitalize">{user.organization.role.replaceAll('_', ' ')}</dd></div><div><dt>Personal time zone</dt><dd>{user.timezone || 'Same as workspace'}</dd></div></dl></SettingsSection>}
        <Notice title="Looking for sign-in protection?" icon={ShieldCheck} actions={<Button size="sm" variant="secondary" to="/app/settings/security">Open Security<ArrowRight className="size-3.5" aria-hidden="true" /></Button>}>Manage your password, two-factor authentication and signed-in devices in Security.</Notice>
      </aside>
    </div>
  </div>
}
