import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { pricing } from '../services/content'
import { signup } from '../services/auth'
import { passwordStrength, signupSchema, type SignupValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import type { PlanId } from '../types'

/** Plans you can sign up for (Enterprise is sold by our team). */
type SignupPlan = Exclude<PlanId, 'enterprise'>
import { Button } from '../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, PasswordInput } from '../components/ui/Form'
import { useToast } from '../components/ui/Toast'
import { AuthShell, Divider, SocialAuthButtons } from '../components/layout/AuthShell'
import { GuestOnly } from '../components/auth/Guards'

const selectablePlans = pricing.plans.filter((p) => p.id !== 'enterprise')

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']

function StrengthMeter({ value }: { value: string }) {
  const score = passwordStrength(value)
  if (!value) return null
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < score ? strengthColors[score] : 'bg-zinc-200')} />
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Password strength: <span className="font-medium text-zinc-700">{strengthLabels[score]}</span>
      </p>
    </div>
  )
}

function SignupForm() {
  const notify = useToast()
  const [params] = useSearchParams()
  const planParam = params.get('plan')
  const initialPlan: SignupPlan = selectablePlans.some((p) => p.id === planParam) ? (planParam as SignupPlan) : 'growth'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', plan: initialPlan, terms: false },
  })

  const plan = useWatch({ control, name: 'plan' })
  const password = useWatch({ control, name: 'password' })

  // On success the session is set and <GuestOnly> moves the user on to /verify-email.
  const onSubmit = async (values: SignupValues) => {
    setServerError(null)
    try {
      const { verificationEmailSent } = await signup(values)
      if (!verificationEmailSent) {
        notify({ title: 'Account created', description: 'We couldn’t send the verification email — use “Resend email” on the next screen.', tone: 'error' })
      }
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['fullName', 'email', 'password', 'plan']))
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Start your free trial</h1>
      <p className="mt-2 text-zinc-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>

      <div className="mt-8">
        <SocialAuthButtons
          label="Sign up"
          onSelect={(p) => notify({ title: `${p} sign-up isn’t available yet`, description: 'Please sign up with your email for now.' })}
        />
      </div>
      <Divider>or sign up with your email</Divider>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label="Create account">
        {serverError && <FormAlert>{serverError}</FormAlert>}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-800">Plan</legend>
          <div className="grid grid-cols-3 gap-2">
            {selectablePlans.map((p) => {
              const checked = plan === p.id
              const price = p.price.INR
              return (
                <label
                  key={p.id}
                  className={cn(
                    'relative cursor-pointer rounded-xl p-3 ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                    checked ? 'bg-brand-50/60 ring-brand-400' : 'ring-zinc-200 hover:ring-zinc-300',
                  )}
                >
                  <input type="radio" value={p.id} checked={checked} onChange={() => setValue('plan', p.id as SignupPlan)} name="plan" className="sr-only" />
                  <span className="block text-sm font-medium text-zinc-900">{p.name}</span>
                  <span className="block text-xs text-zinc-500">{price && price.monthly > 0 ? `₹${price.annual}/user` : 'Free'}</span>
                  {checked && <Check className="absolute top-2.5 right-2.5 size-4 text-brand-700" aria-hidden="true" />}
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {plan === 'starter'
              ? 'Free forever for up to 2 users and 1,000 contacts.'
              : `14-day ${selectablePlans.find((p) => p.id === plan)?.name ?? ''} trial, then Starter unless you upgrade. No credit card needed.`}
          </p>
        </fieldset>

        <Field label="Full name" error={errors.fullName?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} {...register('fullName')} />}
        </Field>
        <Field label="Email" error={errors.email?.message} hint="We’ll send a link to confirm it’s you.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" autoComplete="email" placeholder="you@company.com" aria-describedby={describedBy} invalid={invalid} {...register('email')} />
          )}
        </Field>
        <Field label="Password" error={errors.password?.message} hint={!password ? 'At least 8 characters, with a letter and a number.' : undefined}>
          {({ id, describedBy, invalid }) => (
            <>
              <PasswordInput id={id} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('password')} />
              <StrengthMeter value={password} />
            </>
          )}
        </Field>
        <div>
          <Checkbox
            invalid={Boolean(errors.terms)}
            aria-describedby={errors.terms ? 'terms-error' : undefined}
            label={
              <>
                I agree to the{' '}
                <Link to="/terms" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
              </>
            }
            {...register('terms')}
          />
          {errors.terms && (
            <p id="terms-error" role="alert" className="mt-2 ml-[30px] text-sm text-red-600">
              {errors.terms.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating your account…' : 'Create free account'}
        </Button>
      </form>
    </div>
  )
}

export default function Signup() {
  useSeo({
    title: 'Start your free trial',
    description: 'Create your TechSync CRM account. Free for up to 2 users; 14-day trial on paid plans. No credit card required.',
    noindex: true,
  })
  return (
    <GuestOnly>
      <AuthShell quoteIndex={0}>
        <SignupForm />
      </AuthShell>
    </GuestOnly>
  )
}
