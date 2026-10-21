import { useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CircleCheck, KeyRound, MailCheck, ShieldCheck } from 'lucide-react'
import { forgotPassword, login, loginSecondFactor } from '../services/auth'
import { ApiError } from '../services/http'
import { loginSchema, resetSchema, type LoginValues, type ResetValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { useSeo } from '../lib/useSeo'
import { Button } from '../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, PasswordInput } from '../components/ui/Form'
import { useToast } from '../components/ui/Toast'
import { AuthShell, Divider, SocialAuthButtons } from '../components/layout/AuthShell'
import { GuestOnly } from '../components/auth/Guards'

/**
 * Second sign-in step for accounts with two-factor authentication. On success the session is set
 * and <GuestOnly> moves the user on. An expired challenge sends them back to the password step.
 */
function SecondFactorForm({ challengeToken, onRestart }: { challengeToken: string; onRestart: (message: string) => void }) {
  const [mode, setMode] = useState<'code' | 'recovery'>('code')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = value.trim()
    if (mode === 'code' && !/^\d{6}$/.test(clean.replace(/\s/g, ''))) return setError('Enter the 6-digit code from your authenticator app')
    if (mode === 'recovery' && clean.length < 8) return setError('Enter one of your recovery codes')
    setBusy(true)
    setError(null)
    try {
      await loginSecondFactor(challengeToken, mode === 'code' ? { code: clean.replace(/\s/g, '') } : { recoveryCode: clean })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHALLENGE_EXPIRED') return onRestart(err.message)
      setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Something went wrong. Please try again.')
      setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
        {mode === 'code' ? <ShieldCheck className="size-6 text-brand-700" aria-hidden="true" /> : <KeyRound className="size-6 text-brand-700" aria-hidden="true" />}
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">Two-factor authentication</h1>
      <p className="mt-2 text-zinc-600">
        {mode === 'code' ? 'Enter the 6-digit code from your authenticator app.' : 'Enter one of the recovery codes you saved when you turned on 2FA. Each code works once.'}
      </p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5" aria-label="Two-factor authentication">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label={mode === 'code' ? 'Authentication code' : 'Recovery code'}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              autoComplete="one-time-code"
              inputMode={mode === 'code' ? 'numeric' : 'text'}
              maxLength={mode === 'code' ? 7 : 20}
              placeholder={mode === 'code' ? '123456' : 'abcde-12345'}
              className="font-mono tracking-widest"
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Verify and sign in
        </Button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'code' ? 'recovery' : 'code')
          setValue('')
          setError(null)
        }}
        className="mt-5 text-sm font-medium text-brand-700 hover:underline"
      >
        {mode === 'code' ? 'Lost your phone? Use a recovery code' : 'Use your authenticator app instead'}
      </button>
    </>
  )
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const notify = useToast()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const [serverError, setServerError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', remember: true } })

  // On success the session is set and <GuestOnly> routes the user to their next step.
  const onSubmit = async (values: LoginValues) => {
    setServerError(null)
    try {
      const result = await login(values)
      if (result.twoFactorRequired) setChallenge(result.challengeToken)
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['email', 'password']))
    }
  }

  if (challenge) {
    return (
      <SecondFactorForm
        challengeToken={challenge}
        onRestart={(message) => {
          setChallenge(null)
          resetField('password')
          setServerError(message)
        }}
      />
    )
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Welcome back</h1>
      <p className="mt-2 text-zinc-600">
        New to TechSync?{' '}
        <Link to="/signup" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Create a free account
        </Link>
      </p>

      {notice && (
        <p className="mt-6 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">
          <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      <div className="mt-8">
        <SocialAuthButtons
          label="Continue"
          onSelect={(p) => notify({ title: `${p} sign-in isn’t available yet`, description: 'Please sign in with your email for now.' })}
        />
      </div>
      <Divider>or sign in with email</Divider>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label="Sign in">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <Field label="Email" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" autoComplete="email" autoFocus aria-describedby={describedBy} invalid={invalid} {...register('email')} />
          )}
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          labelAside={
            <button type="button" onClick={onForgot} className="text-sm font-medium text-brand-700 hover:underline">
              Forgot password?
            </button>
          }
        >
          {({ id, describedBy, invalid }) => (
            <PasswordInput id={id} autoComplete="current-password" aria-describedby={describedBy} invalid={invalid} {...register('password')} />
          )}
        </Field>
        <Checkbox label="Keep me signed in for 30 days" {...register('remember')} />
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </>
  )
}

function ResetForm({ onBack }: { onBack: () => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { email: '' } })

  const onSubmit = async (values: ResetValues) => {
    setServerError(null)
    try {
      await forgotPassword(values.email)
      setSentTo(values.email)
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['email']))
    }
  }

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </button>
      {sentTo ? (
        <div className="mt-8" role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
            <MailCheck className="size-6 text-brand-700" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">Check your inbox</h1>
          <p className="mt-2 text-zinc-600">
            If an account exists for <span className="font-medium text-zinc-900">{sentTo}</span>, you’ll receive a reset link within a few minutes.
            The link expires in 1 hour.
          </p>
          <p className="mt-4 text-sm text-zinc-500">Don’t see it? Check your spam folder.</p>
        </div>
      ) : (
        <>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-zinc-950">Reset your password</h1>
          <p className="mt-2 text-zinc-600">Enter the email you use for TechSync and we’ll send you a reset link.</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5" aria-label="Reset password">
            {serverError && <FormAlert>{serverError}</FormAlert>}
            <Field label="Email" error={errors.email?.message}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="email" autoComplete="email" autoFocus aria-describedby={describedBy} invalid={invalid} {...register('email')} />
              )}
            </Field>
            <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
              Send reset link
            </Button>
          </form>
        </>
      )}
    </>
  )
}

export default function Login() {
  useSeo({ title: 'Log in', description: 'Sign in to your TechSync CRM workspace.', noindex: true })
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'reset' ? 'reset' : 'login'
  const setMode = (next: 'login' | 'reset') => setParams(next === 'reset' ? { mode: 'reset' } : {}, { replace: true })

  return (
    <GuestOnly>
      <AuthShell quoteIndex={1}>
        <div className="mx-auto max-w-md">
          {mode === 'login' ? <LoginForm onForgot={() => setMode('reset')} /> : <ResetForm onBack={() => setMode('login')} />}
          <p className="mt-10 text-xs leading-relaxed text-zinc-500">
            Protected by encrypted connections and secure, short-lived sessions. See our{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-zinc-800">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    </GuestOnly>
  )
}
