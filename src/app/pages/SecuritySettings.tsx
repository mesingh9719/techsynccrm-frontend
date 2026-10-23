import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import {
  changePassword,
  deleteAccount,
  disableTwoFactor,
  getTwoFactorStatus,
  listSessions,
  regenerateRecoveryCodes,
  revokeOtherSessions,
  revokeSession,
  type Reauth,
} from '../../services/account'
import { forgotPassword, fetchMe } from '../../services/auth'
import { ApiError } from '../../services/http'
import { changePasswordSchema, type ChangePasswordValues } from '../../lib/schemas'
import { applyServerErrors } from '../../lib/forms'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useSeo } from '../../lib/useSeo'
import { formatDate } from '../../lib/format'
import type { UserSession } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, PasswordInput } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton, PageHeader } from '../../components/app/States'
import { SettingsSection } from '../../components/app/SettingsSection'
import { RecoveryCodes, TwoFactorSetup } from '../../components/app/TwoFactorSetup'

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function timeAgo(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

const firstError = (err: unknown, fallback: string) => (err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : fallback)

function SetPasswordPrompt() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('')
  return <div className="max-w-md space-y-3"><p className="text-sm leading-6 text-muted">You signed up with Google and have no TechSync password yet. Set one through your verified email before using password-protected security, email-change or account-deletion actions.</p>{sent ? <p role="status" className="text-sm text-brand-700">Check your email for the password setup link. It signs out existing sessions after you set a password.</p> : <Button variant="secondary" loading={busy} onClick={async () => { if (!user) return; setBusy(true); setError(''); try { await forgotPassword(user.email); setSent(true) } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t send the link.') } finally { setBusy(false) } }}>Email me a password setup link</Button>}{error && <FormAlert>{error}</FormAlert>}</div>
}

// ---------- Password ----------

function PasswordForm() {
  const notify = useToast()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })

  const guard = useUnsavedChanges(isDirty, () => {}, isSubmitting, isDirty)

  const onSubmit = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
    setServerError(null)
    try {
      await changePassword({ currentPassword, newPassword })
      reset()
      void queryClient.invalidateQueries({ queryKey: qk.me.sessions })
      notify({ title: 'Password changed', description: 'Other devices have been signed out.' })
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['currentPassword', 'newPassword']))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-md gap-5">
      {guard.confirmation}
      <Field label="Current password" error={errors.currentPassword?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...register('currentPassword')} />}
      </Field>
      <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters, with a letter and a number.">
        {({ id, describedBy, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('newPassword')} />}
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('confirm')} />}
      </Field>
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <div>
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  )
}

// ---------- Two-factor ----------

/** Password + current code (or a recovery code) before disabling 2FA or replacing recovery codes. */
function ReauthDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger'
  onConfirm: (values: Reauth) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    setPassword('')
    setCode('')
    setError(null)
    setUseRecovery(false)
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password || !code.trim()) return setError('Enter your password and a code')
    setBusy(true)
    setError(null)
    try {
      await onConfirm(useRecovery ? { password, recoveryCode: code.trim() } : { password, code: code.replace(/\s/g, '') })
      close()
    } catch (err) {
      setError(firstError(err, 'Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="reauth-form" loading={busy} className={tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : undefined}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reauth-form" onSubmit={submit} noValidate className="space-y-5">
        <Field label="Password">
          {({ id }) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field
          label={useRecovery ? 'Recovery code' : 'Code from your authenticator app'}
          labelAside={
            <button type="button" onClick={() => setUseRecovery((v) => !v)} className="text-sm font-medium text-brand-700 hover:underline">
              {useRecovery ? 'Use app code' : 'Use a recovery code'}
            </button>
          }
        >
          {({ id }) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={useRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              className="font-mono tracking-widest"
              placeholder={useRecovery ? 'abcde-12345' : '123456'}
            />
          )}
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
      </form>
    </Dialog>
  )
}

function TwoFactorSection() {
  const queryClient = useQueryClient()
  const notify = useToast()
  const { user } = useAuth()
  const status = useQuery({ queryKey: qk.me.twoFactor, queryFn: getTwoFactorStatus })
  const [dialog, setDialog] = useState<'setup' | 'disable' | 'codes' | null>(null)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.me.twoFactor })

  if (status.isPending) return <Skeleton className="h-16" />
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />
  const { enabled, enabledAt, recoveryCodesRemaining } = status.data
  const required = user?.organization?.require2fa

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {enabled ? <ShieldCheck className="mt-1 size-5 text-success" aria-hidden="true" /> : <ShieldOff className="mt-1 size-5 text-muted" aria-hidden="true" />}
          <div>
            <p className="font-medium text-ink">
              {enabled ? 'On' : 'Off'}
              {enabled && enabledAt && <span className="font-normal text-muted"> · since {formatDate(enabledAt)}</span>}
            </p>
            <p className="text-sm text-muted">
              {enabled
                ? `${recoveryCodesRemaining} recovery code${recoveryCodesRemaining === 1 ? '' : 's'} left.`
                : 'Protect your account with a code from your phone when you sign in.'}
            </p>
            {enabled && recoveryCodesRemaining <= 3 && (
              <p className="mt-1 text-sm text-amber-700">You’re running low on recovery codes — generate new ones.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setDialog('codes')}>
                New recovery codes
              </Button>
              {!required && (
                <Button variant="ghost" size="sm" onClick={() => setDialog('disable')}>
                  Turn off
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" onClick={() => setDialog('setup')}>
              Turn on
            </Button>
          )}
        </div>
      </div>
      {enabled && required && <p className="mt-3 text-xs text-muted">Your workspace requires two-factor authentication, so it can’t be turned off.</p>}

      <Dialog open={dialog === 'setup'} onClose={() => setDialog(null)} title="Turn on two-factor authentication">
        {dialog === 'setup' && (
          <TwoFactorSetup
            onComplete={() => {
              setDialog(null)
              void refresh()
              notify({ title: 'Two-factor authentication is on' })
            }}
          />
        )}
      </Dialog>

      <ReauthDialog
        open={dialog === 'disable'}
        onClose={() => setDialog(null)}
        title="Turn off two-factor authentication?"
        description="Your account will be protected by your password alone."
        confirmLabel="Turn off"
        tone="danger"
        onConfirm={async (values) => {
          await disableTwoFactor(values)
          await fetchMe().catch(() => {})
          void refresh()
          notify({ title: 'Two-factor authentication is off' })
        }}
      />

      <ReauthDialog
        open={dialog === 'codes'}
        onClose={() => setDialog(null)}
        title="Generate new recovery codes"
        description="Your current recovery codes will stop working."
        confirmLabel="Generate codes"
        onConfirm={async (values) => {
          const { recoveryCodes } = await regenerateRecoveryCodes(values)
          setNewCodes(recoveryCodes)
          void refresh()
        }}
      />

      <Dialog open={Boolean(newCodes)} onClose={() => setNewCodes(null)} title="Your new recovery codes">
        {newCodes && <RecoveryCodes codes={newCodes} onDone={() => setNewCodes(null)} />}
      </Dialog>
    </>
  )
}

// ---------- Sessions ----------

function SessionRow({ session, onRevoke, busy }: { session: UserSession; onRevoke: () => void; busy: boolean }) {
  const Icon = /Android|iOS/.test(session.device.os) ? Smartphone : Laptop
  return (
    <li className="flex items-center gap-3 py-3">
      <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          {session.device.label}
          {session.current && <Badge tone="success">This device</Badge>}
        </p>
        <p className="text-xs text-muted">
          {session.ip ?? 'Unknown IP'} · active {timeAgo(session.lastActiveAt)} · signed in {formatDate(session.startedAt)}
        </p>
      </div>
      {!session.current && (
        <Button variant="ghost" size="sm" onClick={onRevoke} loading={busy}>
          Sign out
        </Button>
      )}
    </li>
  )
}

function SessionsSection() {
  const queryClient = useQueryClient()
  const notify = useToast()
  const sessions = useQuery({ queryKey: qk.me.sessions, queryFn: listSessions })
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me.sessions }),
    onError: (err) => notify({ tone: 'error', title: 'Couldn’t sign out that device', description: firstError(err, 'Please try again.') }),
  })
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.me.sessions })
      notify({ title: 'Signed out of all other devices' })
    },
  })

  if (sessions.isPending) return <Skeleton className="h-24" />
  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
  const others = sessions.data.filter((s) => !s.current).length

  return (
    <>
      <ul className="divide-y divide-zinc-100">
        {sessions.data.map((s) => (
          <SessionRow key={s.id} session={s} busy={revoke.isPending && revoke.variables === s.id} onRevoke={() => revoke.mutate(s.id)} />
        ))}
      </ul>
      {others > 0 && (
        <Button variant="secondary" size="sm" className="mt-4" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
          Sign out of all other devices
        </Button>
      )}
    </>
  )
}

// ---------- Delete account ----------

function DeleteAccountSection() {
  const navigate = useNavigate()
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password) return setError('Enter your password')
    setBusy(true)
    setError(null)
    try {
      await deleteAccount(password)
      notify({ title: 'Your account has been deleted' })
      navigate('/', { replace: true })
    } catch (err) {
      setError(firstError(err, 'Couldn’t delete your account. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="text-sm text-muted">
        Permanently removes your personal details and signs you out everywhere. Records you own in each workspace are handed to its owner. If you own a workspace, transfer it or delete it first.
      </p>
      <Button variant="secondary" className="mt-5 text-red-700" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Delete your account?"
        description="This can’t be undone."
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="delete-account-form" loading={busy} className="bg-red-600 hover:bg-red-700">
              Delete account
            </Button>
          </>
        }
      >
        <form id="delete-account-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="Enter your password to confirm">
            {({ id }) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          {error && <FormAlert>{error}</FormAlert>}
        </form>
      </Dialog>
    </>
  )
}

export default function SecuritySettings() {
  const { user } = useAuth()
  useSeo({ title: 'Security settings', noindex: true })
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Protect your account and manage active sessions." />
      <SettingsSection title="Password">
        {user?.hasPassword === false ? <SetPasswordPrompt /> : <PasswordForm />}
      </SettingsSection>
      <SettingsSection title="Two-factor authentication" description="A second step at sign-in, using an authenticator app on your phone.">
        <TwoFactorSection />
      </SettingsSection>
      <SettingsSection title="Where you’re signed in" description="Sign out of any device you don’t recognise, then change your password.">
        <SessionsSection />
      </SettingsSection>
      <SettingsSection title="Delete account" tone="danger">
        <DeleteAccountSection />
      </SettingsSection>
    </div>
  )
}
