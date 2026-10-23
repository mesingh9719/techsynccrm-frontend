import { useState, type FormEvent } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { loginSecondFactor } from '../../services/auth'
import { ApiError } from '../../services/http'
import type { AuthUser } from '../../types'
import { Button } from '../ui/Button'
import { Field, FormAlert, Input } from '../ui/Form'

/**
 * Second sign-in step for accounts with two-factor authentication. On success the session is set
 * and <GuestOnly> moves the user on. An expired challenge sends them back to the password step.
 */
export function SecondFactorForm({ challengeToken, onRestart, onSuccess }: { challengeToken: string; onRestart: (message: string) => void; onSuccess?: (user: AuthUser) => void }) {
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
      const user = await loginSecondFactor(challengeToken, mode === 'code' ? { code: clean.replace(/\s/g, '') } : { recoveryCode: clean })
      onSuccess?.(user)
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

