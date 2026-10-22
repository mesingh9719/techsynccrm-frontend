import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck } from 'lucide-react'
import { subscribeNewsletter } from '../../services/api'
import { newsletterSchema, type NewsletterValues } from '../../lib/schemas'
import { Button } from '../ui/Button'
import { FormAlert, Input } from '../ui/Form'
import { Honeypot } from '../ui/Honeypot'
import { useSpamGuard } from '../../lib/useSpamGuard'
import { ApiError } from '../../services/http'

/** Loaded lazily from the footer so form libraries stay out of the initial bundle. */
export default function NewsletterForm() {
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { honeypotRef, spamFields } = useSpamGuard()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterValues>({ resolver: zodResolver(newsletterSchema), defaultValues: { email: '' } })

  const onSubmit = async (values: NewsletterValues) => {
    setServerError(null)
    try {
      await subscribeNewsletter(values, spamFields())
      setDone(true)
    } catch (err) {
      setServerError(err instanceof ApiError && err.status === 429 ? err.message : 'We couldn’t subscribe you just now. Please try again.')
    }
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-700" role="status">
        <CircleCheck className="size-4 text-success" aria-hidden="true" />
        Almost done — check your inbox and click the link to confirm.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm">
      <Honeypot ref={honeypotRef} />
      <label htmlFor="newsletter-email" className="sr-only">
        Work email
      </label>
      <div className="flex gap-2">
        <Input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'newsletter-error' : undefined}
          className="h-10"
          {...register('email')}
        />
        <Button type="submit" variant="dark" loading={isSubmitting} className="h-10 shrink-0">
          Subscribe
        </Button>
      </div>
      {errors.email && (
        <p id="newsletter-error" className="mt-2 text-sm text-red-600" role="alert">
          {errors.email.message}
        </p>
      )}
      {serverError && (
        <div className="mt-2">
          <FormAlert>{serverError}</FormAlert>
        </div>
      )}
    </form>
  )
}
