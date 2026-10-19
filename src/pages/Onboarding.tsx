import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, CircleCheck } from 'lucide-react'
import { completeOnboarding } from '../services/auth'
import { ApiError } from '../services/http'
import { companySizes, industries, onboardingGoals, onboardingSchema, type OnboardingValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../components/ui/Form'
import { RequireStage } from '../components/auth/Guards'
import type { AuthUser } from '../types'

const roleSuggestions = ['Founder / Owner', 'Sales manager', 'Sales executive', 'Marketing', 'Operations']

const steps: { title: string; description: string; fields: FieldPath<OnboardingValues>[] }[] = [
  { title: 'About you', description: 'So we can tailor TechSync to how you work.', fields: ['jobRole', 'phone'] },
  { title: 'Your company', description: 'We’ll set up your workspace with a pipeline for your industry.', fields: ['company', 'industry', 'teamSize'] },
  { title: 'Your goals', description: 'Pick what matters most — we’ll show you where to start.', fields: ['goals'] },
]

const allFields = steps.flatMap((s) => s.fields)

function OnboardingForm({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const justVerified = Boolean((location.state as { justVerified?: boolean } | null)?.justVerified)
  const [step, setStep] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      jobRole: user.jobRole ?? '',
      phone: user.phone ?? '',
      // The company step creates the workspace, so it always starts empty.
      company: '',
      goals: user.goals ?? [],
    },
  })

  const jobRole = useWatch({ control, name: 'jobRole' })
  const teamSize = useWatch({ control, name: 'teamSize' })
  const goals = useWatch({ control, name: 'goals' })
  const isLast = step === steps.length - 1

  async function next() {
    if (await trigger(steps[step].fields, { shouldFocus: true })) setStep((s) => s + 1)
  }

  const onSubmit = async (values: OnboardingValues) => {
    setServerError(null)
    try {
      await completeOnboarding(values)
      navigate('/app', { replace: true, state: { welcome: true } })
    } catch (err) {
      setServerError(applyServerErrors(err, setError, allFields))
      // Jump back to the first step with a server-side field error.
      if (err instanceof ApiError) {
        const failed = steps.findIndex((s) => s.fields.some((f) => f in err.fields))
        if (failed >= 0) setStep(failed)
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      {justVerified && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          Email verified — welcome, {user.fullName.split(' ')[0]}! Let’s set up your workspace.
        </p>
      )}

      <ol className="flex items-center gap-2" aria-label="Onboarding progress">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2" aria-current={i === step ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200',
              )}
            >
              {i < step ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('hidden text-sm sm:inline', i === step ? 'font-medium text-zinc-900' : 'text-zinc-500')}>{s.title}</span>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', i < step ? 'bg-brand-600' : 'bg-zinc-200')} aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <form
        // Enter on an earlier step means "Continue", not "submit everything".
        onSubmit={
          isLast
            ? handleSubmit(onSubmit)
            : (e) => {
                e.preventDefault()
                void next()
              }
        }
        noValidate className="mt-8 rounded-3xl bg-white p-6 shadow-card ring-1 ring-zinc-200 sm:p-10">
        <p className="font-mono text-xs font-medium tracking-wider text-zinc-500 uppercase">
          Step {step + 1} of {steps.length}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{steps[step].title}</h1>
        <p className="mt-1.5 text-zinc-600">{steps[step].description}</p>

        {serverError && (
          <div className="mt-6">
            <FormAlert>{serverError}</FormAlert>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {step === 0 && (
            <>
              <Field label="Your role" error={errors.jobRole?.message}>
                {({ id, describedBy, invalid }) => (
                  <>
                    <Input id={id} autoComplete="organization-title" placeholder="e.g. Founder, Sales manager" aria-describedby={describedBy} invalid={invalid} {...register('jobRole')} />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {roleSuggestions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setValue('jobRole', r, { shouldValidate: true })}
                          className={cn(
                            'rounded-full px-3 py-1 text-sm ring-1 transition-colors',
                            jobRole === r ? 'bg-zinc-900 text-white ring-zinc-900' : 'text-zinc-600 ring-zinc-200 hover:ring-zinc-300',
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </Field>
              <Field label="Phone" optional error={errors.phone?.message} hint="For onboarding help over WhatsApp or a call. We never share it.">
                {({ id, describedBy, invalid }) => (
                  <Input id={id} type="tel" autoComplete="tel" placeholder="+91 98450 12345" aria-describedby={describedBy} invalid={invalid} {...register('phone')} />
                )}
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Company name" error={errors.company?.message}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} autoComplete="organization" autoFocus aria-describedby={describedBy} invalid={invalid} {...register('company')} />
                )}
              </Field>
              <Field label="Industry" error={errors.industry?.message}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="" {...register('industry')}>
                    <option value="" disabled>
                      Choose your industry
                    </option>
                    {industries.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <fieldset aria-describedby={errors.teamSize ? 'teamsize-error' : undefined}>
                <legend className="mb-2 text-sm font-medium text-zinc-800">Team size</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {companySizes.map((size) => (
                    <label
                      key={size}
                      className={cn(
                        'flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm ring-1 transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                        teamSize === size ? 'bg-zinc-900 font-medium text-white ring-zinc-900' : 'bg-white text-zinc-700 ring-zinc-300 hover:ring-zinc-400',
                      )}
                    >
                      <input type="radio" value={size} className="sr-only" {...register('teamSize')} />
                      {size}
                    </label>
                  ))}
                </div>
                {errors.teamSize && (
                  <p id="teamsize-error" role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.teamSize.message}
                  </p>
                )}
              </fieldset>
            </>
          )}

          {step === 2 && (
            <fieldset aria-describedby={errors.goals ? 'goals-error' : undefined}>
              <legend className="sr-only">Goals</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {onboardingGoals.map((g) => {
                  const checked = goals?.includes(g.value)
                  return (
                    <label
                      key={g.value}
                      className={cn(
                        'relative flex cursor-pointer flex-col rounded-xl p-4 ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                        checked ? 'bg-brand-50/60 ring-brand-400' : 'ring-zinc-200 hover:ring-zinc-300',
                      )}
                    >
                      <input type="checkbox" value={g.value} className="sr-only" {...register('goals')} />
                      <span className="pr-6 font-medium text-zinc-900">{g.label}</span>
                      <span className="mt-1 text-sm text-zinc-500">{g.description}</span>
                      <span
                        className={cn(
                          'absolute top-4 right-4 flex size-5 items-center justify-center rounded-md ring-1',
                          checked ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-zinc-300',
                        )}
                        aria-hidden="true"
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    </label>
                  )
                })}
              </div>
              {errors.goals && (
                <p id="goals-error" role="alert" className="mt-2 text-sm text-red-600">
                  {errors.goals.message}
                </p>
              )}
            </fieldset>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-zinc-100 pt-6">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isSubmitting ? 'Setting up…' : 'Finish setup'}
            </Button>
          ) : (
            // type="submit" so Enter advances too; the form's onSubmit routes to next() before the last step.
            <Button type="submit" size="lg">
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

export default function Onboarding() {
  useSeo({ title: 'Set up your workspace', noindex: true })
  const { user } = useAuth()
  return <RequireStage path="/onboarding">{user && <OnboardingForm user={user} />}</RequireStage>
}
