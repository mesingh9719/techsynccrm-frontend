import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert } from 'lucide-react'
import { resetPassword } from '../services/auth'
import { ApiError } from '../services/http'
import { newPasswordSchema, passwordStrength, type NewPasswordValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { Field, FormAlert, PasswordInput } from '../components/ui/Form'
import { AuthShell } from '../components/layout/AuthShell'

const LINK_ERRORS = ['TOKEN_INVALID', 'TOKEN_USED', 'TOKEN_EXPIRED_LINK']

function InvalidLink({ expired }: { expired: boolean }) {
  return (
    <div>
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
        <CircleAlert className="size-6 text-amber-600" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">{expired ? 'This link has expired' : 'This link isn’t valid'}</h1>
      <p className="mt-2 text-zinc-600">
        {expired
          ? 'Password reset links last 1 hour. Request a new one below.'
          : 'It may have already been used, or a newer link was sent. Request a new one to continue.'}
      </p>
      <Button to="/login?mode=reset" className="mt-8">
        Request a new link
      </Button>
    </div>
  )
}

export default function ResetPassword() {
  useSeo({ title: 'Choose a new password', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [linkError, setLinkError] = useState<string | null>(token ? null : 'TOKEN_INVALID')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' } })
  const password = useWatch({ control, name: 'password' })
  const score = passwordStrength(password)

  const onSubmit = async (values: NewPasswordValues) => {
    setServerError(null)
    try {
      await resetPassword(token, values.password)
      navigate('/login', { replace: true, state: { notice: 'Your password has been updated. Log in with your new password.' } })
    } catch (err) {
      if (err instanceof ApiError && err.code && LINK_ERRORS.includes(err.code)) setLinkError(err.code)
      else setServerError(applyServerErrors(err, setError, ['password']))
    }
  }

  return (
    <AuthShell quoteIndex={3}>
      <div className="mx-auto max-w-md">
        {linkError ? (
          <InvalidLink expired={linkError === 'TOKEN_EXPIRED_LINK'} />
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Choose a new password</h1>
            <p className="mt-2 text-zinc-600">For your security, this will sign you out on all other devices.</p>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5" aria-label="Choose a new password">
              {serverError && <FormAlert>{serverError}</FormAlert>}
              <Field label="New password" error={errors.password?.message} hint={!password ? 'At least 8 characters, with a letter and a number.' : undefined}>
                {({ id, describedBy, invalid }) => (
                  <>
                    <PasswordInput id={id} autoComplete="new-password" autoFocus aria-describedby={describedBy} invalid={invalid} {...register('password')} />
                    {password && (
                      <div className="mt-2 flex gap-1" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={cn('h-1 flex-1 rounded-full', i < score ? (score >= 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-zinc-200')} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Field>
              <Field label="Confirm new password" error={errors.confirm?.message}>
                {({ id, describedBy, invalid }) => (
                  <PasswordInput id={id} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('confirm')} />
                )}
              </Field>
              <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
                {isSubmitting ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  )
}
