import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { PageHeader } from '../../components/app/States'
import { useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageUp, MailWarning } from 'lucide-react'
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
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { UserAvatar } from '../../components/app/UserAvatar'
import { SettingsSection } from '../../components/app/SettingsSection'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024

function PhotoUploader({ user }: { user: AuthUser }) {
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

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={user.fullName} url={user.avatarUrl} size="lg" />
      <div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={progress !== null}>
            <ImageUp className="size-4" aria-hidden="true" />
            {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : user.avatarUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {user.avatarUrl && (
            <Button variant="ghost" size="sm" onClick={() => updateProfile({ avatarFileId: null }).catch(() => setError('Couldn’t remove the photo.'))}>
              Remove
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">PNG, JPG or WebP, up to 2 MB.</p>
        {error && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults })

  const leaveGuard = useUnsavedChanges(isDirty, () => {}, isSubmitting, isDirty)

  const onSubmit = async (values: ProfileValues) => {
    setServerError(null)
    try {
      const updated = await updateProfile({ fullName: values.fullName, jobRole: values.jobRole || null, phone: values.phone || null, timezone: values.timezone || null })
      reset({ fullName: updated.fullName, jobRole: updated.jobRole ?? '', phone: updated.phone ?? '', timezone: updated.timezone ?? '' })
      notify({ title: 'Profile saved' })
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['fullName', 'jobRole', 'phone', 'timezone']))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {leaveGuard.confirmation}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} {...register('fullName')} />}
        </Field>
        <Field label="Job title" optional error={errors.jobRole?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization-title" aria-describedby={describedBy} invalid={invalid} {...register('jobRole')} />}
        </Field>
        <Field label="Phone" optional error={errors.phone?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} type="tel" autoComplete="tel" placeholder="+91 98450 12345" aria-describedby={describedBy} invalid={invalid} {...register('phone')} />}
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
      </div>
      {serverError && (
        <div className="mt-5">
          <FormAlert>{serverError}</FormAlert>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" disabled={!isDirty || isSubmitting} onClick={() => reset(defaults)}>
          Discard
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
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
          {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} {...register('newEmail')} />}
        </Field>
        <Field label="Current password" error={errors.password?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...register('password')} />}
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

  async function discard() {
    setDiscarding(true)
    try {
      await discardEmailChange()
      await fetchMe()
      notify({ title: 'Email change cancelled' })
    } finally {
      setDiscarding(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-ink">{user.email}</p>
          <p className="text-sm text-muted">You sign in with this email and receive notifications here.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Change email
        </Button>
      </div>
      {user.pendingEmail && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="flex items-start gap-2">
            <MailWarning className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>
              Waiting for you to confirm <strong className="font-medium">{user.pendingEmail}</strong> — check that inbox for the link.
            </span>
          </p>
          <Button variant="ghost" size="sm" onClick={discard} loading={discarding}>
            Cancel change
          </Button>
        </div>
      )}
      <ChangeEmailDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default function ProfileSettings() {
  useSeo({ title: 'Profile settings', noindex: true })
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your personal details and sign-in email." />
      <SettingsSection title="Profile" description="How you appear to your team.">
        <PhotoUploader user={user} />
        <div className="mt-6">
          <ProfileForm key={user.id} user={user} />
        </div>
      </SettingsSection>
      <SettingsSection title="Email address">
        <EmailSection user={user} />
      </SettingsSection>
    </div>
  )
}
