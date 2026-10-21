import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, Clock, Headphones, LifeBuoy, Mail, MapPin, MessageSquare } from 'lucide-react'
import { company } from '../services/content'
import { site } from '../services/site'
import { submitContact } from '../services/api'
import { contactSchema, contactTopics, type ContactValues } from '../lib/schemas'
import { useSeo } from '../lib/useSeo'
import { applyServerErrors } from '../lib/forms'
import { ApiError } from '../services/http'
import { Button } from '../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, Select, Textarea } from '../components/ui/Form'
import { Container, PageHero } from '../components/ui/Section'
import { Honeypot } from '../components/ui/Honeypot'
import { useSpamGuard } from '../lib/useSpamGuard'

const channels = [
  { icon: MessageSquare, title: 'Talk to sales', text: 'Pricing, demos and custom plans.', href: `mailto:${site.salesEmail}`, label: site.salesEmail },
  { icon: Headphones, title: 'Customer support', text: 'Mon–Sat, 9am–8pm IST. English & Hindi.', href: `mailto:${site.supportEmail}`, label: site.supportEmail },
  { icon: Mail, title: 'Call us', text: 'Speak to someone right away.', href: `tel:${site.phone.replace(/\s/g, '')}`, label: site.phone },
]

const validTopics = contactTopics.map((t) => t.value) as string[]

export default function Contact() {
  useSeo({
    title: 'Contact us',
    description: 'Get in touch with TechSync CRM sales, support or partnerships. We reply within one business day.',
  })
  const [params] = useSearchParams()
  const initialTopic = params.get('topic')
  const [ticket, setTicket] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const { honeypotRef, spamFields, restartSpamTimer } = useSpamGuard()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      company: '',
      phone: '',
      topic: (initialTopic && validTopics.includes(initialTopic) ? initialTopic : undefined) as ContactValues['topic'],
      message: '',
      consent: false,
    },
  })

  const onSubmit = async (values: ContactValues) => {
    setServerError(null)
    try {
      const { ticketId } = await submitContact(values, spamFields())
      setTicket(ticketId)
    } catch (err) {
      // Validation and rate-limit messages are shown as-is; anything else gets a friendly fallback.
      const known = err instanceof ApiError && err.status >= 400 && err.status < 500
      setServerError(
        known
          ? applyServerErrors(err, setError, ['name', 'email', 'company', 'phone', 'topic', 'message', 'consent'])
          : 'Something went wrong sending your message. Please try again, or email us directly.',
      )
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let’s talk about your business"
        description="Questions about pricing, a feature, or whether TechSync is right for you? Our team replies within one business day — usually much sooner."
      />

      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div className="rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200 sm:p-10">
            {ticket ? (
              <div className="py-10 text-center" role="status">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                  <CircleCheck className="size-6 text-emerald-600" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-2xl font-semibold text-zinc-950">Message received</h2>
                <p className="mx-auto mt-2 max-w-md text-zinc-600">
                  Thanks for reaching out. We’ve sent a confirmation to your inbox and will reply within one business day.
                </p>
                <p className="mt-4 font-mono text-sm text-zinc-500">Reference: {ticket}</p>
                <Button
                  variant="secondary"
                  className="mt-8"
                  onClick={() => {
                    reset()
                    setTicket(null)
                    restartSpamTimer()
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="contact-form-title">
                <h2 id="contact-form-title" className="text-xl font-semibold text-zinc-950">
                  Send us a message
                </h2>
                <p className="mt-1 text-sm text-zinc-500">All fields are required unless marked optional.</p>
                <Honeypot ref={honeypotRef} />

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" error={errors.name?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} {...register('name')} />
                    )}
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} {...register('email')} />
                    )}
                  </Field>
                  <Field label="Company" optional error={errors.company?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} autoComplete="organization" aria-describedby={describedBy} invalid={invalid} {...register('company')} />
                    )}
                  </Field>
                  <Field label="Phone" optional error={errors.phone?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} type="tel" autoComplete="tel" placeholder="+91 98450 12345" aria-describedby={describedBy} invalid={invalid} {...register('phone')} />
                    )}
                  </Field>
                  <Field label="How can we help?" error={errors.topic?.message} className="sm:col-span-2">
                    {({ id, describedBy, invalid }) => (
                      <Select id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="" {...register('topic')}>
                        <option value="" disabled>
                          Choose a topic
                        </option>
                        {contactTopics.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Message" error={errors.message?.message} hint="Tell us about your team and what you’re looking for." className="sm:col-span-2">
                    {({ id, describedBy, invalid }) => (
                      <Textarea id={id} rows={5} aria-describedby={describedBy} invalid={invalid} {...register('message')} />
                    )}
                  </Field>
                  <div className="sm:col-span-2">
                    <Checkbox
                      invalid={Boolean(errors.consent)}
                      aria-describedby={errors.consent ? 'consent-error' : undefined}
                      label={
                        <>
                          I agree to TechSync contacting me about this enquiry, as described in the{' '}
                          <Link to="/privacy" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                            Privacy Policy
                          </Link>
                          .
                        </>
                      }
                      {...register('consent')}
                    />
                    {errors.consent && (
                      <p id="consent-error" role="alert" className="mt-2 ml-[30px] text-sm text-red-600">
                        {errors.consent.message}
                      </p>
                    )}
                  </div>
                </div>

                {serverError && (
                  <div className="mt-6">
                    <FormAlert>{serverError}</FormAlert>
                  </div>
                )}

                <Button type="submit" size="lg" loading={isSubmitting} className="mt-8 w-full sm:w-auto">
                  {isSubmitting ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            )}
          </div>

          <aside className="space-y-8">
            <ul className="space-y-3">
              {channels.map((c) => (
                <li key={c.title}>
                  <a href={c.href} className="group flex gap-4 rounded-dialog bg-white p-5 shadow-card ring-1 ring-zinc-200 transition-shadow hover:shadow-float">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200">
                      <c.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-medium text-zinc-950">{c.title}</span>
                      <span className="block text-sm text-zinc-500">{c.text}</span>
                      <span className="mt-1 block text-sm font-medium text-brand-700 group-hover:underline">{c.label}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="rounded-dialog bg-canvas p-5 ring-1 ring-zinc-200">
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <Clock className="size-4 text-zinc-500" aria-hidden="true" />
                Average first response: 2 hours
              </p>
              <p className="mt-3 flex items-start gap-2 text-sm text-zinc-600">
                <LifeBuoy className="mt-1 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                <span>
                  Looking for a quick answer? Try the{' '}
                  <Link to="/help" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                    Help Center
                  </Link>
                  .
                </span>
              </p>
            </div>

            <div>
              <h2 className="text-sm font-medium text-zinc-900">Our offices</h2>
              <ul className="mt-4 space-y-4">
                {company.offices.map((o) => (
                  <li key={o.city} className="flex gap-3 text-sm">
                    <MapPin className="mt-1 size-4 shrink-0 text-zinc-400" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-zinc-900">{o.city}</p>
                      <address className="text-zinc-600 not-italic">{o.address}</address>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </>
  )
}
