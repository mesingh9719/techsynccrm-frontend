import { useId, useRef, useState, type ComponentType, type FocusEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  CircleCheck,
  Crown,
  Inbox,
  KanbanSquare,
  Megaphone,
  MessageCircle,
  PenLine,
  ReceiptText,
  Repeat,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { completeOnboarding } from '../services/auth'
import { ApiError } from '../services/http'
import { companyName, companySizes, isOptionalMobile, onboardingGoals, onboardingSchema, type OnboardingValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import { IndustryIcon, searchIndustries, useIndustries, type Industry } from '../lib/industries'
import { Button } from '../components/ui/Button'
import { Field, FormAlert, Input } from '../components/ui/Form'
import { PhoneInput } from '../components/ui/PhoneInput'
import { RequireStage } from '../components/auth/Guards'
import { Facebook } from '../features/leads/BrandIcons'
import { FacebookConnectStep } from '../features/onboarding/FacebookConnectStep'
import type { AuthUser } from '../types'

type Icon = ComponentType<{ className?: string }>
type TeamSize = (typeof companySizes)[number]

const roles: { label: string; icon: Icon }[] = [
  { label: 'Founder / Owner', icon: Crown },
  { label: 'Sales manager', icon: Target },
  { label: 'Sales executive', icon: Briefcase },
  { label: 'Marketing', icon: Megaphone },
  { label: 'Operations', icon: Wrench },
]

const teamSizeLabels: Record<TeamSize, string> = {
  '1–10': 'Small team',
  '11–50': 'Growing',
  '51–200': 'Mid-size',
  '201–500': 'Large',
  '500+': 'Enterprise',
}

const goalIcons: Record<(typeof onboardingGoals)[number]['value'], Icon> = {
  capture_leads: Inbox,
  manage_pipeline: KanbanSquare,
  whatsapp: MessageCircle,
  automate_followups: Repeat,
  quotes_invoices: ReceiptText,
  reports: BarChart3,
}

// Mirrors backend/src/config/pipelineTemplates.js so the preview shows the stages the workspace really gets.
// Keyed by template; each industry (industries table) names its template.
const defaultStages = ['New', 'Qualified', 'Proposal sent', 'Negotiation']
const pipelineStages: Record<string, string[]> = {
  retail: ['New enquiry', 'Sample/visit', 'Quotation sent', 'Negotiation'],
  manufacturing: ['RFQ received', 'Technical discussion', 'Quotation sent', 'Negotiation', 'PO pending'],
  services: ['Discovery', 'Proposal sent', 'Negotiation', 'Contract sent'],
  real_estate: ['Enquiry', 'Site visit scheduled', 'Site visit done', 'Negotiation', 'Booking'],
  education: ['Enquiry', 'Counselling', 'Application', 'Fee pending'],
  healthcare: ['Enquiry', 'Consultation', 'Proposal', 'Negotiation'],
}

const steps: { title: string; short: string; caption: string; description: string; icon: Icon; fields: FieldPath<OnboardingValues>[] }[] = [
  { title: 'Tell us about you', short: 'About you', caption: 'Your role', description: 'So we can tailor TechSync to how you work.', icon: UserRound, fields: ['jobRole', 'phone'] },
  {
    title: 'Set up your company',
    short: 'Your company',
    caption: 'Name, industry and size',
    description: 'We’ll build your workspace with a pipeline made for your industry.',
    icon: Building2,
    fields: ['company', 'industryId', 'teamSize'],
  },
  { title: 'What do you want to achieve?', short: 'Your goals', caption: 'Where to start', description: 'Pick everything that matters — we’ll show you where to start.', icon: Target, fields: ['goals'] },
  {
    title: 'Connect Facebook Lead Ads',
    short: 'Connect Facebook',
    caption: 'Optional · Pages, forms, campaigns',
    description: 'Your workspace is ready. Capture leads from your Facebook and Instagram ads automatically.',
    icon: Facebook,
    fields: [],
  },
]
const CONNECT_STEP = steps.length - 1
const allFields = steps.flatMap((s) => s.fields)

const tile =
  'cursor-pointer select-none rounded-xl bg-white ring-1 transition-all duration-200 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500'
const tileIdle = 'ring-zinc-200 hover:-translate-y-0.5 hover:shadow-float hover:ring-zinc-300'
const tileActive = 'bg-brand-50/70 ring-2 ring-brand-500 shadow-float'
const tileIcon = (active?: boolean) =>
  cn('flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:size-9', active ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-red-600">
      {message}
    </p>
  )
}

/**
 * Finds industries that aren't tiles. A pick that isn't a tile shows as its own selected tile above
 * the box. Combobox pattern: arrows move, Enter picks (without submitting the step), Esc closes.
 */
function IndustrySearch({ industries, value, onSelect }: { industries: Industry[]; value?: string; onSelect: (id: string) => void }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = searchIndustries(industries, query)
  const picked = industries.find((i) => i.id === value)
  const other = industries.find((i) => i.slug === 'other')
  const pickedFromSearch = picked && !picked.featured ? picked : undefined
  const expanded = open && query.trim() !== ''

  function choose(id: string) {
    onSelect(id)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (results.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
    } else if (e.key === 'Enter') {
      // Enter in the search box picks; it never submits the step.
      e.preventDefault()
      if (expanded && results[active]) choose(results[active].id)
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {pickedFromSearch && (
        <div className={cn(tile, tileActive, 'flex h-16 items-center gap-3 px-3.5')}>
          <span className={tileIcon(true)}>
            <IndustryIcon icon={pickedFromSearch.icon} className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-900">{pickedFromSearch.name}</span>
          <Check className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="sr-only">selected</span>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search all industries"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={expanded && results[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          maxLength={60}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          // Delay so a click on an option lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={`Don’t see yours? Search ${industries.length - 1} industries — e.g. pharma, gym, CA`}
          className="block h-11 w-full rounded-xl border border-line bg-white pr-10 pl-10 text-sm text-ink shadow-card transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-zinc-700"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {expanded && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Industries"
            className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl bg-white p-1.5 shadow-float ring-1 ring-zinc-200"
          >
            {results.length ? (
              results.map((r, i) => {
                return (
                  <li
                    key={r.id}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(r.id)}
                    onMouseEnter={() => setActive(i)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm', i === active ? 'bg-brand-50 text-brand-900' : 'text-zinc-800')}
                  >
                    <span className={tileIcon(i === active)}>
                      <IndustryIcon icon={r.icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    {r.id === value && <Check className="size-4 shrink-0 text-brand-600" aria-hidden="true" />}
                  </li>
                )
              })
            ) : (
              <li role="option" aria-selected={false} aria-disabled="true" className="px-2.5 py-2 text-sm text-zinc-500">
                No match.
                {other && (
                  <>
                    {' '}
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(other.id)} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                      Choose {other.name}
                    </button>{' '}
                    for a general sales pipeline.
                  </>
                )}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

function OnboardingForm({ user, onLaunch }: { user: AuthUser; onLaunch: (launching: boolean) => void }) {
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
    setFocus,
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

  const [jobRole, phone, company, industryId, teamSize, goals] = useWatch({ control, name: ['jobRole', 'phone', 'company', 'industryId', 'teamSize', 'goals'] })
  const { industries, isPending: industriesLoading, isError: industriesFailed, refetch: retryIndustries } = useIndustries()
  const industry = industries.find((i) => i.id === industryId)
  // Continue stays disabled while a filled-in field is invalid; empty required fields still get their message on Continue.
  const phoneInvalid = step === 0 && !isOptionalMobile(phone ?? '')
  const companyInvalid = step === 1 && Boolean(company?.trim()) && !companyName.safeParse(company).success
  const customRole = Boolean(jobRole?.trim()) && !roles.some((r) => r.label === jobRole)
  const current = steps[step]
  const StepIcon = current.icon
  const finishing = step === CONNECT_STEP - 1
  const launched = step === CONNECT_STEP
  const orgId = user.organization?.id

  async function next() {
    if (await trigger(current.fields, { shouldFocus: true })) setStep((s) => s + 1)
  }

  const onSubmit = async (values: OnboardingValues) => {
    setServerError(null)
    // Creating the workspace advances the account past onboarding; stay for the optional connect step.
    onLaunch(true)
    try {
      await completeOnboarding(values)
      setStep(CONNECT_STEP)
    } catch (err) {
      onLaunch(false)
      setServerError(applyServerErrors(err, setError, allFields))
      // Jump back to the first step with a server-side field error.
      if (err instanceof ApiError) {
        const failed = steps.findIndex((s) => s.fields.some((f) => f in err.fields))
        if (failed >= 0) setStep(failed)
      }
    }
  }

  const finish = () => navigate('/app/setup', { replace: true, state: { welcome: true } })

  return (
    <div className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 -top-48 -z-10 h-[36rem] bg-[radial-gradient(55%_60%_at_50%_0%,var(--color-brand-200),transparent_70%)] opacity-60"
        aria-hidden="true"
      />

      <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-12">
        <div className="grid overflow-hidden rounded-[1.25rem] bg-white shadow-frame lg:min-h-[44rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Rail
            user={user}
            step={step}
            justVerified={justVerified}
            company={company}
            industry={industry}
            teamSize={teamSize}
          />

          <form
            // Enter on an earlier step means "Continue", not "submit everything".
            onSubmit={
              finishing
                ? handleSubmit(onSubmit)
                : (e) => {
                    e.preventDefault()
                    // The connect step holds Facebook controls; leaving it is an explicit click.
                    if (!launched) void next()
                  }
            }
            noValidate
            className="flex min-w-0 flex-col"
          >
            <div className="border-b border-zinc-100 px-6 pt-5 pb-4 lg:hidden">
              <div className="flex gap-1.5" aria-hidden="true">
                {steps.map((s, i) => (
                  <span key={s.short} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-brand-600' : 'bg-zinc-200')} />
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                Welcome, {user.fullName.split(' ')[0]} · {current.short}
              </p>
            </div>

            <div key={step} className="flex-1 animate-fade-up px-5 py-8 sm:px-10 sm:py-10">
              <div className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-float">
                  <StepIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium tracking-wider text-brand-700 uppercase">
                    Step {step + 1} of {steps.length}
                    {launched && ' · Optional'}
                  </p>
                  <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-zinc-950">{current.title}</h1>
                </div>
              </div>
              <p className="mt-3 text-zinc-600">{current.description}</p>

              {serverError && (
                <div className="mt-6">
                  <FormAlert>{serverError}</FormAlert>
                </div>
              )}

              <div className="mt-8 space-y-8">
                {step === 0 && (
                  <>
                    <div>
                      <p className="mb-3 text-sm font-medium text-zinc-800" id="role-picker">
                        What best describes you?
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3" role="group" aria-labelledby="role-picker">
                        {roles.map(({ label, icon: RoleIcon }) => {
                          const active = jobRole === label
                          return (
                            <button
                              key={label}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setValue('jobRole', label, { shouldValidate: true })}
                              className={cn(tile, 'flex h-16 items-center gap-2.5 px-3 text-left sm:gap-3 sm:px-3.5', active ? tileActive : tileIdle)}
                            >
                              <span className={tileIcon(active)}>
                                <RoleIcon className="size-[18px]" />
                              </span>
                              <span className={cn('min-w-0 text-[13px] leading-tight sm:text-sm', active ? 'font-semibold text-brand-900' : 'font-medium text-zinc-800')}>{label}</span>
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          aria-pressed={customRole}
                          onClick={() => {
                            if (!customRole) setValue('jobRole', '')
                            setFocus('jobRole')
                          }}
                          className={cn(tile, 'flex h-16 items-center gap-2.5 px-3 text-left sm:gap-3 sm:px-3.5', customRole ? tileActive : tileIdle)}
                        >
                          <span className={tileIcon(customRole)}>
                            <PenLine className="size-[18px]" />
                          </span>
                          <span className={cn('min-w-0 text-[13px] leading-tight sm:text-sm', customRole ? 'font-semibold text-brand-900' : 'font-medium text-zinc-800')}>Something else</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Your role" error={errors.jobRole?.message}>
                        {({ id, describedBy, invalid }) => (
                          <Input
                            id={id}
                            autoComplete="organization-title"
                            placeholder="e.g. Business development lead"
                            aria-describedby={describedBy}
                            invalid={invalid}
                            {...register('jobRole')}
                          />
                        )}
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
                                // Continue stays disabled while the number is invalid, so say why once they leave the field.
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
                    </div>
                    <p className="-mt-4 text-sm text-zinc-500">Your phone is only used for onboarding help over WhatsApp or a call. We never share it.</p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <Field label="Company name" error={errors.company?.message}>
                      {({ id, describedBy, invalid }) => (
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                          <Input
                            id={id}
                            autoComplete="organization"
                            autoFocus
                            maxLength={80}
                            placeholder="e.g. Sharma Traders"
                            aria-describedby={describedBy}
                            invalid={invalid}
                            className="pl-10"
                            {...register('company', {
                              // Say why Continue is disabled once they leave the field.
                              onBlur: (e: FocusEvent<HTMLInputElement>) => {
                                if (e.target.value.trim()) void trigger('company')
                              },
                            })}
                          />
                        </div>
                      )}
                    </Field>

                    <fieldset aria-describedby={errors.industryId ? 'industry-error' : undefined} aria-busy={industriesLoading || undefined}>
                      <legend className="mb-3 text-sm font-medium text-zinc-800">Industry</legend>
                      {industriesFailed ? (
                        <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200" role="alert">
                          We couldn’t load the industry list.
                          <button type="button" onClick={() => void retryIndustries()} className="font-medium underline underline-offset-2">
                            Try again
                          </button>
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                          {industriesLoading
                            ? Array.from({ length: 7 }, (_, i) => <span key={i} className={cn('h-16 animate-pulse rounded-xl bg-zinc-100', i === 6 && 'col-span-2 sm:col-span-3')} />)
                            : industries
                                .filter((i) => i.featured)
                                .map(({ id: value, name, icon, slug }) => {
                                  const active = industryId === value
                                  return (
                                    <label
                                      key={value}
                                      className={cn(
                                        tile,
                                        'flex h-16 items-center gap-2.5 px-3 sm:gap-3 sm:px-3.5',
                                        // "Other" spans the last row so the grid stays even.
                                        slug === 'other' && 'col-span-2 sm:col-span-3',
                                        active ? tileActive : tileIdle,
                                      )}
                                    >
                                      <input type="radio" value={value} className="sr-only" {...register('industryId')} />
                                      <span className={tileIcon(active)}>
                                        <IndustryIcon icon={icon} className="size-[18px]" />
                                      </span>
                                      <span className={cn('min-w-0 text-[13px] leading-tight sm:text-sm', active ? 'font-semibold text-brand-900' : 'font-medium text-zinc-800')}>
                                        {slug === 'other' ? `${name} — a general sales pipeline` : name}
                                      </span>
                                    </label>
                                  )
                                })}
                        </div>
                      )}
                      {!industriesLoading && !industriesFailed && (
                        <IndustrySearch
                          industries={industries}
                          value={industryId}
                          onSelect={(id) => setValue('industryId', id, { shouldValidate: true, shouldDirty: true })}
                        />
                      )}
                      <FieldError id="industry-error" message={errors.industryId?.message} />
                    </fieldset>

                    <fieldset aria-describedby={errors.teamSize ? 'teamsize-error' : undefined}>
                      <legend className="mb-3 text-sm font-medium text-zinc-800">Team size</legend>
                      <div className="grid grid-cols-5 gap-2 sm:gap-3">
                        {companySizes.map((size) => {
                          const active = teamSize === size
                          return (
                            <label key={size} className={cn(tile, 'flex h-20 flex-col items-center justify-center px-1 text-center', active ? tileActive : tileIdle)}>
                              <input type="radio" value={size} className="sr-only" {...register('teamSize')} />
                              <Users className={cn('size-4', active ? 'text-brand-600' : 'text-zinc-400')} aria-hidden="true" />
                              <span className={cn('mt-1 text-sm', active ? 'font-semibold text-brand-900' : 'font-medium text-zinc-900')}>{size}</span>
                              <span className="hidden text-xs text-zinc-500 sm:block">{teamSizeLabels[size]}</span>
                            </label>
                          )
                        })}
                      </div>
                      <FieldError id="teamsize-error" message={errors.teamSize?.message} />
                    </fieldset>
                  </>
                )}

                {step === 2 && (
                  <fieldset aria-describedby={errors.goals ? 'goals-error' : 'goals-hint'}>
                    <legend className="sr-only">Goals</legend>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p id="goals-hint" className="text-sm font-medium text-zinc-800">
                        Select all that apply
                      </p>
                      <span
                        className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors', goals?.length ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500')}
                        aria-live="polite"
                      >
                        {goals?.length ?? 0} selected
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {onboardingGoals.map((g) => {
                        const GoalIcon = goalIcons[g.value]
                        const checked = Boolean(goals?.includes(g.value))
                        return (
                          <label key={g.value} className={cn(tile, 'relative flex min-h-24 items-start gap-3.5 p-4', checked ? tileActive : tileIdle)}>
                            <input type="checkbox" value={g.value} className="sr-only" {...register('goals')} />
                            <span className={cn(tileIcon(checked), 'size-10 sm:size-10')}>
                              <GoalIcon className="size-5" />
                            </span>
                            <span className="pr-6">
                              <span className="block font-medium text-zinc-900">{g.label}</span>
                              <span className="mt-0.5 block text-sm leading-snug text-zinc-500">{g.description}</span>
                            </span>
                            <span
                              className={cn(
                                'absolute top-4 right-4 flex size-5 items-center justify-center rounded-full ring-1 transition-colors',
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
                    <FieldError id="goals-error" message={errors.goals?.message} />
                  </fieldset>
                )}

                {launched && orgId && <FacebookConnectStep orgId={orgId} />}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-surface-subtle px-6 py-4 sm:px-10">
              {step > 0 && !launched ? (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
              ) : launched ? (
                <span className="hidden text-sm text-zinc-500 sm:inline">You can connect later from Integrations.</span>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-4">
                {!launched && (
                  <span className="hidden text-xs text-zinc-500 md:inline" aria-hidden="true">
                    Press <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">Enter ↵</kbd>
                  </span>
                )}
                {finishing ? (
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    {isSubmitting ? 'Creating workspace…' : 'Create workspace'}
                    {!isSubmitting && <Sparkles className="size-4" aria-hidden="true" />}
                  </Button>
                ) : launched ? (
                  <Button size="lg" onClick={finish}>
                    Go to my workspace
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                ) : (
                  // type="submit" so Enter advances too; the form's onSubmit routes to next() before the last form step.
                  <Button type="submit" size="lg" disabled={phoneInvalid || companyInvalid}>
                    Continue
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/** Brand rail: greeting, vertical stepper and a live preview of the workspace being created. */
function Rail({
  user,
  step,
  justVerified,
  company,
  industry,
  teamSize,
}: {
  user: AuthUser
  step: number
  justVerified: boolean
  company?: string
  industry?: Industry
  teamSize?: TeamSize
}) {
  const pipeline = industry?.pipelineTemplate
  const stages = (pipeline && pipelineStages[pipeline]) || defaultStages
  const name = company?.trim()

  return (
    <aside className="relative hidden flex-col overflow-hidden bg-zinc-950 p-8 text-white lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:28px_28px]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -top-32 -left-24 size-80 rounded-full bg-brand-600/45 blur-3xl" aria-hidden="true" />

      <div className="relative">
        {justVerified ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/30" role="status">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            Email verified
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-sidebar-ink ring-1 ring-white/15">
            <Sparkles className="size-3.5 text-highlight" aria-hidden="true" />
            Workspace setup
          </p>
        )}
        <p className="mt-5 font-display text-2xl leading-tight font-semibold">Welcome, {user.fullName.split(' ')[0]}.</p>
        <p className="mt-1.5 text-sm text-sidebar-muted">Let’s build your workspace — it takes about a minute.</p>
      </div>

      <ol className="relative mt-9 space-y-1" aria-label="Onboarding progress">
        {steps.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <li key={s.short} className="relative flex gap-3.5 pb-5 last:pb-0" aria-current={active ? 'step' : undefined}>
              {i < steps.length - 1 && (
                <span className={cn('absolute top-8 bottom-0 left-[15px] w-px', done ? 'bg-brand-400' : 'bg-white/15')} aria-hidden="true" />
              )}
              <span
                className={cn(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done ? 'bg-brand-500 text-white' : active ? 'bg-white text-zinc-950 ring-4 ring-white/15' : 'bg-white/5 text-sidebar-muted ring-1 ring-white/20',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className="pt-1">
                <span className={cn('block text-sm font-medium', active ? 'text-white' : done ? 'text-sidebar-ink' : 'text-sidebar-muted')}>
                  {s.short}
                  <span className="sr-only">{done ? ' (done)' : active ? ' (current)' : ''}</span>
                </span>
                <span className="block text-xs text-sidebar-muted">{s.caption}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="relative mt-auto pt-8" aria-hidden="true">
        <div className="rounded-card bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-highlight font-display font-bold text-zinc-950">{initials(name ?? '')}</span>
            <span className="min-w-0">
              <span className={cn('block truncate font-semibold', !name && 'text-white/50')}>{name || 'Your company'}</span>
              <span className="block truncate text-xs text-sidebar-muted">{[industry?.name ?? 'Industry', teamSize ? `${teamSize} people` : 'Team size'].join(' · ')}</span>
            </span>
          </div>
          <p className="mt-4 text-[11px] font-medium tracking-wider text-sidebar-muted uppercase">{pipeline === 'education' ? 'Admissions' : 'Sales pipeline'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...stages, 'Won'].map((stage, i, all) => (
              <span
                key={`${industry?.id ?? 'default'}-${stage}`}
                className={cn(
                  'animate-fade-in rounded-md px-2 py-1 text-[11px] font-medium',
                  i === all.length - 1 ? 'bg-highlight/90 text-zinc-950' : 'bg-white/10 text-sidebar-ink',
                )}
              >
                {stage}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function Onboarding() {
  useSeo({ title: 'Set up your workspace', noindex: true })
  const { user } = useAuth()
  const [launching, setLaunching] = useState(false)
  return (
    <RequireStage path="/onboarding" stay={launching}>
      {user && <OnboardingForm user={user} onLaunch={setLaunching} />}
    </RequireStage>
  )
}
