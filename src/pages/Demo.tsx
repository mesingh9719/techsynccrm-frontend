import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus, CircleCheck, Clock, MonitorPlay, Users, Video } from 'lucide-react'
import { solutions, testimonials } from '../services/content'
import { getDemoSlots, requestDemo, type DemoSlotAvailability, type DemoSlotReason } from '../services/api'
import { ApiError } from '../services/http'
import { applyServerErrors } from '../lib/forms'
import { companySizes, demoInterests, demoSchema, demoSlots, type DemoValues } from '../lib/schemas'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Badge'
import { Field, FormAlert, Input, Select, Textarea } from '../components/ui/Form'
import { Container, Eyebrow } from '../components/ui/Section'
import { Honeypot } from '../components/ui/Honeypot'
import { useSpamGuard } from '../lib/useSpamGuard'

const agenda = [
  { icon: Users, title: 'Understand your sales process', text: 'Ten minutes on how your team finds, follows up and closes deals today.' },
  { icon: MonitorPlay, title: 'A tailored walkthrough', text: 'See TechSync set up for your industry, with your pipeline stages.' },
  { icon: Clock, title: 'Plan your rollout', text: 'Pricing, migration from Excel or another CRM, and a go-live date.' },
]

/** Bookings open this many days ahead (matches DEMO_MAX_DAYS_AHEAD on the backend). */
const MAX_DAYS_AHEAD = 30

const slotReasonLabel: Record<DemoSlotReason, string> = {
  full: 'Fully booked',
  too_soon: 'Too soon to book',
  unavailable: 'Not available',
}

const demoFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'companySize', 'role', 'interests', 'date', 'slot', 'notes'] as const

function toLocalISODate(d: Date) {
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

/** Builds a downloadable .ics invite for the booked slot (30 minutes, IST). */
function buildIcs(values: DemoValues) {
  const [time, meridiem] = values.slot.split(' ')
  const [hour, m] = time.split(':').map(Number)
  const h = meridiem === 'PM' && hour !== 12 ? hour + 12 : hour
  const start = new Date(`${values.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:30`)
  const end = new Date(start.getTime() + 30 * 60000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TechSync CRM//Demo//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@techsynccrm.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    'SUMMARY:TechSync CRM demo',
    `DESCRIPTION:Personalised demo for ${values.company}. A video link will be emailed to ${values.email}.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export default function Demo() {
  useSeo({
    title: 'Book a demo',
    description: 'Book a free 30-minute TechSync CRM demo tailored to your industry and sales process. Available Monday to Saturday.',
  })
  const [params] = useSearchParams()
  const industry = solutions.industries.find((i) => i.id === params.get('industry'))
  const [booked, setBooked] = useState<{ values: DemoValues; id: string } | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [today] = useState(() => toLocalISODate(new Date()))
  const [maxDate] = useState(() => toLocalISODate(new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000)))
  const [slotInfo, setSlotInfo] = useState<{ date: string; slots: DemoSlotAvailability[] } | null>(null)
  const [slotsVersion, setSlotsVersion] = useState(0)
  const { honeypotRef, spamFields } = useSpamGuard()
  const quote = testimonials[2]

  const {
    register,
    handleSubmit,
    control,
    setError,
    getValues,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<DemoValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      role: '',
      interests: [],
      date: '',
      notes: industry ? `We're in ${industry.name.toLowerCase()}.` : '',
    },
  })

  const selectedInterests = useWatch({ control, name: 'interests' })
  const selectedSlot = useWatch({ control, name: 'slot' })
  const selectedDate = useWatch({ control, name: 'date' })

  // Live availability for the chosen date. It's a hint only — the server re-checks when booking.
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate ?? '')) return
    const controller = new AbortController()
    getDemoSlots(selectedDate, controller.signal)
      .then(({ slots }) => {
        setSlotInfo({ date: selectedDate, slots })
        const current = slots.find((s) => s.label === getValues('slot'))
        if (current && !current.available) resetField('slot')
      })
      .catch(() => {})
    return () => controller.abort()
  }, [selectedDate, slotsVersion, getValues, resetField])

  const availability = slotInfo?.date === selectedDate ? new Map(slotInfo.slots.map((s) => [s.label, s])) : null

  const onSubmit = async (values: DemoValues) => {
    setServerError(null)
    try {
      const { confirmationId } = await requestDemo(values, spamFields())
      setBooked({ values, id: confirmationId })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      // Someone took the last seat in this slot: refresh availability so it shows as full.
      if (err instanceof ApiError && err.code === 'SLOT_FULL') setSlotsVersion((v) => v + 1)
      const known = err instanceof ApiError && err.status >= 400 && err.status < 500
      setServerError(known ? applyServerErrors(err, setError, [...demoFields]) : 'We couldn’t book your demo just now. Please try again in a moment.')
    }
  }

  function downloadInvite() {
    if (!booked) return
    const blob = new Blob([buildIcs(booked.values)], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'techsync-demo.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (booked) {
    const { values, id } = booked
    const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${values.date}T00:00:00`))
    return (
      <Container className="py-20 sm:py-28">
        <div className="mx-auto max-w-xl text-center" role="status">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
            <CircleCheck className="size-7 text-success" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">You’re booked, {values.firstName}!</h1>
          <p className="mt-3 text-lg text-zinc-600">We’ve sent a calendar invite and video link to {values.email}.</p>
          <dl className="mt-10 grid gap-px overflow-hidden rounded-dialog bg-zinc-200 text-left ring-1 ring-zinc-200 sm:grid-cols-3">
            <div className="bg-white p-5">
              <dt className="text-xs text-zinc-500">Date</dt>
              <dd className="mt-1 font-medium text-zinc-900">{dateLabel}</dd>
            </div>
            <div className="bg-white p-5">
              <dt className="text-xs text-zinc-500">Time</dt>
              <dd className="mt-1 font-medium text-zinc-900">{values.slot} IST · 30 min</dd>
            </div>
            <div className="bg-white p-5">
              <dt className="text-xs text-zinc-500">Confirmation</dt>
              <dd className="mt-1 font-mono font-medium text-zinc-900">{id}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={downloadInvite} size="lg">
              <CalendarPlus className="size-4" aria-hidden="true" />
              Add to calendar
            </Button>
            <Button to="/features" variant="secondary" size="lg">
              Explore features meanwhile
            </Button>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 hidden h-[520px] bg-canvas lg:block" aria-hidden="true" />
      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
          <div className="lg:pt-6">
            <Eyebrow>Book a demo</Eyebrow>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl sm:leading-[1.08]">
              See TechSync working for {industry ? industry.name.toLowerCase() : 'your business'}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-zinc-600">
              A free, 30-minute video call with a product specialist — no slides, no pressure. Just your questions and a CRM set up the way you sell.
            </p>

            <ul className="mt-10 space-y-6">
              {agenda.map((a) => (
                <li key={a.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-card ring-1 ring-zinc-200">
                    <a.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-zinc-950">{a.title}</h2>
                    <p className="mt-1 text-zinc-600">{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <figure className="mt-12 hidden rounded-dialog border-l-2 border-brand-500 bg-white p-6 shadow-card ring-1 ring-zinc-200 lg:block">
              <blockquote className="leading-relaxed text-zinc-700">“{quote.quote}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <Avatar name={quote.name} size="sm" />
                <span className="text-sm">
                  <span className="font-medium text-zinc-900">{quote.name}</span>
                  <span className="text-zinc-500"> · {quote.role}</span>
                </span>
              </figcaption>
            </figure>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-labelledby="demo-form-title"
            className="rounded-dialog bg-white p-6 shadow-float ring-1 ring-zinc-200 sm:p-10"
          >
            <Honeypot ref={honeypotRef} />
            <div className="flex items-center justify-between gap-4">
              <h2 id="demo-form-title" className="text-xl font-semibold text-zinc-950">
                Pick a time that works
              </h2>
              <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
                <Video className="size-4" aria-hidden="true" />
                Google Meet or Zoom
              </span>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} autoComplete="given-name" aria-describedby={describedBy} invalid={invalid} {...register('firstName')} />}
              </Field>
              <Field label="Last name" error={errors.lastName?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} autoComplete="family-name" aria-describedby={describedBy} invalid={invalid} {...register('lastName')} />}
              </Field>
              <Field label="Work email" error={errors.email?.message}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} type="email" autoComplete="email" placeholder="you@company.com" aria-describedby={describedBy} invalid={invalid} {...register('email')} />
                )}
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} type="tel" autoComplete="tel" placeholder="+91 98450 12345" aria-describedby={describedBy} invalid={invalid} {...register('phone')} />
                )}
              </Field>
              <Field label="Company" error={errors.company?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-describedby={describedBy} invalid={invalid} {...register('company')} />}
              </Field>
              <Field label="Team size" error={errors.companySize?.message}>
                {({ id, describedBy, invalid }) => (
                  <Select id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="" {...register('companySize')}>
                    <option value="" disabled>
                      Select
                    </option>
                    {companySizes.map((s) => (
                      <option key={s} value={s}>
                        {s} employees
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Your role" error={errors.role?.message} className="sm:col-span-2">
                {({ id, describedBy, invalid }) => (
                  <Input id={id} autoComplete="organization-title" placeholder="e.g. Founder, Sales Manager" aria-describedby={describedBy} invalid={invalid} {...register('role')} />
                )}
              </Field>
            </div>

            <fieldset className="mt-6" aria-describedby={errors.interests ? 'interests-error' : undefined}>
              <legend className="mb-3 text-sm font-medium text-zinc-800">What would you like to see?</legend>
              <div className="flex flex-wrap gap-2">
                {demoInterests.map((interest) => {
                  const checked = selectedInterests?.includes(interest)
                  return (
                    <label
                      key={interest}
                      className={cn(
                        'inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-sm ring-1 transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                        checked ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-zinc-700 ring-zinc-300 hover:ring-zinc-400',
                      )}
                    >
                      <input type="checkbox" value={interest} className="sr-only" {...register('interests')} />
                      {interest}
                    </label>
                  )
                })}
              </div>
              {errors.interests && (
                <p id="interests-error" role="alert" className="mt-2 text-sm text-red-600">
                  {errors.interests.message}
                </p>
              )}
            </fieldset>

            <div className="mt-6 grid gap-5 sm:grid-cols-[180px_1fr]">
              <Field label="Date" error={errors.date?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} type="date" min={today} max={maxDate} aria-describedby={describedBy} invalid={invalid} {...register('date')} />}
              </Field>
              <fieldset aria-describedby={errors.slot ? 'slot-error' : undefined}>
                <legend className="mb-2 text-sm font-medium text-zinc-800">Time (IST)</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {demoSlots.map((slot) => {
                    const info = availability?.get(slot)
                    const unavailable = info ? !info.available : false
                    const reason = info?.reason ? slotReasonLabel[info.reason] : undefined
                    return (
                      <label
                        key={slot}
                        title={reason}
                        className={cn(
                          'flex h-11 items-center justify-center rounded-lg text-sm tabular-nums ring-1 transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                          unavailable
                            ? 'cursor-not-allowed bg-zinc-50 text-zinc-400 line-through ring-zinc-200'
                            : selectedSlot === slot
                              ? 'cursor-pointer bg-zinc-900 font-medium text-white ring-zinc-900'
                              : 'cursor-pointer bg-white text-zinc-700 ring-zinc-300 hover:ring-zinc-400',
                        )}
                      >
                        <input type="radio" value={slot} disabled={unavailable} className="sr-only" {...register('slot')} />
                        {slot}
                        {reason && <span className="sr-only"> ({reason})</span>}
                      </label>
                    )
                  })}
                </div>
                {errors.slot && (
                  <p id="slot-error" role="alert" className="mt-2 text-sm text-red-600">
                    {errors.slot.message}
                  </p>
                )}
              </fieldset>
            </div>

            <Field label="Anything we should know?" optional error={errors.notes?.message} className="mt-6">
              {({ id, describedBy, invalid }) => (
                <Textarea id={id} rows={3} className="min-h-24" placeholder="Current tools, team structure, must-haves…" aria-describedby={describedBy} invalid={invalid} {...register('notes')} />
              )}
            </Field>

            {serverError && (
              <div className="mt-6">
                <FormAlert>{serverError}</FormAlert>
              </div>
            )}

            <Button type="submit" size="lg" loading={isSubmitting} className="mt-8 w-full">
              {isSubmitting ? 'Booking…' : 'Book my demo'}
            </Button>
            <p className="mt-4 text-center text-xs text-zinc-500">
              By booking, you agree to our{' '}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-zinc-800">
                Privacy Policy
              </Link>
              . We’ll never share your details.
            </p>
          </form>
        </div>
      </Container>
    </div>
  )
}
