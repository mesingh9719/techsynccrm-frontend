import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { ArrowRight, Check, Clock3, Fingerprint, Globe2, KeyRound, Laptop, LockKeyhole, LogOut, Mail, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from 'lucide-react'
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
  type TwoFactorStatus,
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
import { Notice, StatusChip } from '../../components/ui/Signal'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, PasswordInput } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { SettingsSection } from '../../components/app/SettingsSection'
import './account-settings.css'
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
  return <div className="space-y-4"><Notice tone="violet" title="You sign in with Google" icon={KeyRound}>Add a TechSync password to use password-protected account settings. We’ll send a setup link to <strong className="break-all">{user?.email}</strong>.</Notice>{sent ? <Notice tone="success" title="Check your inbox" icon={Mail}>Your password setup link is on its way. Setting a password signs out your existing sessions.</Notice> : <Button variant="secondary" loading={busy} onClick={async () => { if (!user) return; setBusy(true); setError(''); try { await forgotPassword(user.email); setSent(true) } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t send the link.') } finally { setBusy(false) } }}><Mail className="size-4" aria-hidden="true" />Email me a password setup link</Button>}{error && <Notice tone="danger" title="Setup link couldn’t be sent">{error}</Notice>}</div>
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
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })

  const newPassword = useWatch({ control, name: 'newPassword' })
  const rules = [{ label: '8–72 characters', met: newPassword.length >= 8 && newPassword.length <= 72 }, { label: 'One letter', met: /[A-Za-z]/.test(newPassword) }, { label: 'One number', met: /[0-9]/.test(newPassword) }]
  const guard = useUnsavedChanges(isDirty, () => {}, isSubmitting, isDirty)

  const onSubmit = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
    setServerError(null)
    try {
      await changePassword({ currentPassword, newPassword })
      reset()
      guard.markSaved(false)
      void queryClient.invalidateQueries({ queryKey: qk.me.sessions })
      notify({ title: 'Password changed', description: 'Other devices have been signed out.' })
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['currentPassword', 'newPassword']))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="account-password-form">
      {guard.confirmation}
      <Field label="Current password" className="account-full-width" error={errors.currentPassword?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} disabled={isSubmitting} autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...register('currentPassword')} />}
      </Field>
      <Field label="New password" error={errors.newPassword?.message} hint="Use a password you don’t use elsewhere.">
        {({ id, describedBy, invalid }) => <PasswordInput id={id} disabled={isSubmitting} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('newPassword')} />}
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} disabled={isSubmitting} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('confirm')} />}
      </Field>
      <ul className="account-full-width flex flex-wrap gap-2" aria-label="New password requirements">{rules.map((rule) => <li key={rule.label}><StatusChip tone={rule.met ? 'success' : 'neutral'} icon={rule.met ? Check : undefined}><span className="sr-only">{rule.met ? 'Met: ' : 'Required: '}</span>{rule.label}</StatusChip></li>)}</ul>
      {serverError && <Notice tone="danger" title="Password not changed" className="account-full-width">{serverError}</Notice>}
      <div className="account-form-footer account-full-width"><p className="max-w-xs text-xs leading-5 text-muted">Updating your password also signs out your other devices.</p><Button type="submit" loading={isSubmitting} disabled={!isDirty}><KeyRound className="size-3.5" aria-hidden="true" />Change password</Button></div>
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
      icon={ShieldCheck}
      busy={busy}
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
          {({ id }) => <PasswordInput id={id} disabled={busy} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field
          label={useRecovery ? 'Recovery code' : 'Code from your authenticator app'}
          labelAside={
            <button type="button" disabled={busy} onClick={() => setUseRecovery((v) => !v)} className="text-sm font-medium text-brand-700 hover:underline">
              {useRecovery ? 'Use app code' : 'Use a recovery code'}
            </button>
          }
        >
          {({ id }) => (
            <Input
              id={id}
              disabled={busy}
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

function TwoFactorSection({ status }: { status: UseQueryResult<TwoFactorStatus> }) {
  const queryClient = useQueryClient()
  const notify = useToast()
  const { user } = useAuth()
  const [dialog, setDialog] = useState<'setup' | 'disable' | 'codes' | null>(null)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.me.twoFactor })

  if (status.isPending) return <Skeleton className="h-16" />
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />
  const { enabled, enabledAt, recoveryCodesRemaining } = status.data
  const required = user?.organization?.require2fa

  return (
    <>
      <div className="account-factor-summary">
        <div className="flex min-w-0 items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl border ${enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{enabled ? <ShieldCheck className="size-5" aria-hidden="true" /> : <ShieldOff className="size-5" aria-hidden="true" />}</span><div><p className="text-sm font-semibold text-ink">{enabled ? 'An extra layer of protection' : 'Add an extra layer of protection'}</p><p className="mt-1 text-xs leading-5 text-muted">{enabled && enabledAt ? `Protecting your account since ${formatDate(enabledAt)}.` : enabled ? 'Your authenticator app helps protect each sign-in.' : 'Use a code from your authenticator app when you sign in.'}</p><div className="mt-3 flex flex-wrap gap-2"><StatusChip tone={enabled ? 'success' : 'warning'} icon={enabled ? ShieldCheck : ShieldOff}>{enabled ? 'Two-factor is on' : 'Two-factor is off'}</StatusChip>{enabled && <StatusChip tone={recoveryCodesRemaining <= 3 ? 'warning' : 'info'} icon={KeyRound}>{recoveryCodesRemaining} recovery {recoveryCodesRemaining === 1 ? 'code' : 'codes'} left</StatusChip>}{required && <StatusChip tone="violet" icon={LockKeyhole}>Required by workspace</StatusChip>}</div></div></div>
        <div className="flex flex-wrap gap-2">{enabled ? <><Button variant="secondary" size="sm" onClick={() => setDialog('codes')}><KeyRound className="size-3.5" aria-hidden="true" />New recovery codes</Button>{!required && <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => setDialog('disable')}>Turn off</Button>}</> : <Button size="sm" onClick={() => setDialog('setup')}><ShieldCheck className="size-3.5" aria-hidden="true" />Turn on</Button>}</div>
      </div>
      {enabled && recoveryCodesRemaining <= 3 && <Notice tone="warning" title="Your recovery codes are running low" className="mt-4">Generate a fresh set and store it somewhere safe. Each code can be used once if you lose access to your authenticator app.</Notice>}
      {enabled && required && <Notice title="Protection required by your workspace" className="mt-4" icon={LockKeyhole}>Your workspace requires two-factor authentication, so it can’t be turned off.</Notice>}

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
  const Icon = /Android|iOS|iPhone|iPad/i.test(session.device.os) ? Smartphone : Laptop
  return (
    <li className="account-session" data-current={session.current}>
      <span className="account-session-icon"><Icon className="size-5" aria-hidden="true" /></span>
      <div className="account-session-details"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink"><span className="break-words">{session.device.label}</span>{session.current && <StatusChip tone="success" icon={Check}>This device</StatusChip>}</p><div className="account-session-meta"><span><Globe2 className="size-3 shrink-0" aria-hidden="true" />{session.ip ?? 'Unknown IP'}</span><span><Clock3 className="size-3 shrink-0" aria-hidden="true" /><time dateTime={session.lastActiveAt} title={formatDate(session.lastActiveAt)}>Active {timeAgo(session.lastActiveAt)}</time></span></div><p className="mt-1.5 text-[11px] text-muted">Signed in {formatDate(session.startedAt)}</p></div>
      {!session.current && <Button variant="ghost" size="sm" aria-label={`Sign out ${session.device.label}`} onClick={onRevoke} loading={busy}><LogOut className="size-3.5" aria-hidden="true" />Sign out</Button>}
    </li>
  )
}

function SessionsSection({ sessions }: { sessions: UseQueryResult<UserSession[]> }) {
  const queryClient = useQueryClient()
  const notify = useToast()
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
    onError: (err) => notify({ tone: 'error', title: 'Couldn’t sign out other devices', description: firstError(err, 'Please try again.') }),
  })

  if (sessions.isPending) return <Skeleton className="h-24" />
  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
  const others = sessions.data.filter((s) => !s.current).length

  return (
    <>
      <ul className="account-session-list" aria-label="Signed-in devices">
        {sessions.data.map((s) => (
          <SessionRow key={s.id} session={s} busy={revoke.isPending && revoke.variables === s.id} onRevoke={() => revoke.mutate(s.id)} />
        ))}
      </ul>
      {!sessions.data.length && <Notice title="No active sessions to display">Refresh your security settings to check again.</Notice>}
      {sessions.data.length > 0 && <div className="account-session-footer"><p className="text-xs text-muted">{sessions.data.length} active {sessions.data.length === 1 ? 'session' : 'sessions'}{others ? ` · ${others} on other devices` : ' · You’re up to date'}</p>{others > 0 && <Button variant="secondary" size="sm" loading={revokeOthers.isPending} disabled={revoke.isPending} onClick={() => revokeOthers.mutate()}><LogOut className="size-3.5" aria-hidden="true" />Sign out of all other devices</Button>}</div>}
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
        <Trash2 className="size-4" aria-hidden="true" />Delete my account
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Delete your account?"
        icon={Trash2}
        busy={busy}
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
            {({ id }) => <PasswordInput id={id} disabled={busy} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
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
  const twoFactor = useQuery({ queryKey: qk.me.twoFactor, queryFn: getTwoFactorStatus })
  const sessions = useQuery({ queryKey: qk.me.sessions, queryFn: listSessions })
  const factorEnabled = twoFactor.data?.enabled
  const refreshing = twoFactor.isFetching || sessions.isFetching
  return <div className="account-settings space-y-6">
    <header className="account-settings-header"><div><p className="account-settings-eyebrow">Your account · Protection & access</p><h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Security</h1><p className="mt-2 text-sm text-muted">Keep your account protected and your devices in view.</p></div><Button variant="secondary" size="sm" loading={refreshing} onClick={() => Promise.all([twoFactor.refetch(), sessions.refetch()])}><RefreshCw className="size-3.5" aria-hidden="true" />Refresh security</Button></header>
    <nav className="security-overview" aria-label="Security overview">
      <a className="security-stat" href="#password-settings" data-tone={user?.hasPassword === false ? 'violet' : 'success'}><span className="security-stat-icon"><KeyRound className="size-4" aria-hidden="true" /></span><div><p className="security-stat-title">Sign-in method</p><p className="security-stat-value">{user?.hasPassword === false ? 'Google sign-in' : 'Password set'}</p></div></a>
      <a className="security-stat" href="#two-factor-settings" data-tone={twoFactor.isError || twoFactor.isPending ? 'neutral' : factorEnabled ? 'success' : 'warning'}><span className="security-stat-icon"><ShieldCheck className="size-4" aria-hidden="true" /></span><div><p className="security-stat-title">Two-factor authentication</p><p className="security-stat-value">{twoFactor.isPending ? 'Checking…' : twoFactor.isError ? 'Status unavailable' : factorEnabled ? 'Turned on' : 'Not turned on'}</p></div></a>
      <a className="security-stat" href="#session-settings" data-tone="info"><span className="security-stat-icon"><Laptop className="size-4" aria-hidden="true" /></span><div><p className="security-stat-title">Active sessions</p><p className="security-stat-value">{sessions.isPending ? 'Checking…' : sessions.isError ? 'Status unavailable' : `${sessions.data.length} signed in`}</p></div></a>
    </nav>
    <div className="account-settings-grid">
      <div className="account-settings-main">
        <SettingsSection id="password-settings" icon={KeyRound} title="Password" description="Keep your sign-in details up to date." actions={<StatusChip tone={user?.hasPassword === false ? 'violet' : 'success'} icon={LockKeyhole}>{user?.hasPassword === false ? 'Google sign-in' : 'Password set'}</StatusChip>}>{user?.hasPassword === false ? <SetPasswordPrompt /> : <PasswordForm />}</SettingsSection>
        <SettingsSection id="two-factor-settings" icon={ShieldCheck} title="Two-factor authentication" description="A second step at sign-in, using your authenticator app."><TwoFactorSection status={twoFactor} /></SettingsSection>
        <SettingsSection id="session-settings" icon={Laptop} title="Where you’re signed in" description="Review the devices with access to your account." actions={sessions.data && <StatusChip tone="info" icon={Laptop}>{sessions.data.length} active</StatusChip>}><SessionsSection sessions={sessions} /></SettingsSection>
        <SettingsSection icon={Trash2} title="Delete account" tone="danger" description="Permanently remove your personal account."><DeleteAccountSection /></SettingsSection>
      </div>
      <aside className="account-settings-aside" aria-label="Security help">
        <SettingsSection icon={Fingerprint} title="Small habits, safer account"><ul className="account-help-list">{[
          { icon: KeyRound, title: 'Use a unique password', text: 'A password manager can help you create and remember it.' },
          { icon: ShieldCheck, title: 'Keep a second step', text: 'Two-factor authentication adds a code from your own device.' },
          { icon: Laptop, title: 'Know your devices', text: 'Sign out of shared computers when you’re finished working.' },
        ].map(({ icon: Icon, title, text }) => <li key={title}><span className="account-help-icon"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-xs font-semibold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div></li>)}</ul></SettingsSection>
        <Notice title="Keep recovery codes somewhere safe" tone="violet" icon={KeyRound}>Store them in a password manager so you can sign in if your authenticator app is unavailable.</Notice>
        <Notice title="Don’t recognise a device?" icon={Laptop}>Sign out of that session, then update your password.</Notice>
        <div className="rounded-xl border border-line bg-surface p-4"><p className="text-xs font-semibold text-ink">Your personal details</p><p className="mt-1 text-xs leading-5 text-muted">Manage your name, photo and sign-in email in Profile.</p><Button variant="secondary" size="sm" className="mt-3 w-full" to="/app/settings/profile">Open Profile<ArrowRight className="size-3.5" aria-hidden="true" /></Button></div>
      </aside>
    </div>
  </div>
}
