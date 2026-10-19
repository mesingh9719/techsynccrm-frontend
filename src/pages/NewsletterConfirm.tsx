import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { confirmNewsletter, unsubscribeNewsletter } from '../services/api'
import { ApiError } from '../services/http'
import { useSeo } from '../lib/useSeo'
import { Button } from '../components/ui/Button'

function StatusCard({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:py-24">
      <div className="rounded-3xl bg-white p-8 text-center shadow-card ring-1 ring-zinc-200 sm:p-10" role="status">
        {icon}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
        {children}
      </div>
    </div>
  )
}

const successIcon = (
  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
    <CircleCheck className="size-6 text-emerald-600" aria-hidden="true" />
  </span>
)

const errorIcon = (
  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
    <CircleAlert className="size-6 text-red-600" aria-hidden="true" />
  </span>
)

const loadingIcon = <LoaderCircle className="mx-auto size-7 animate-spin text-brand-600" aria-hidden="true" />

const errorMessage = (err: unknown) => (err instanceof ApiError && err.status !== 0 && err.status < 500 ? err.message : 'Something went wrong. Please try again.')

/** /newsletter/confirm?token=… — the link from the double opt-in email. */
export default function NewsletterConfirm() {
  useSeo({ title: 'Confirm subscription', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<{ status: 'loading' | 'done' | 'error'; message?: string }>({ status: token ? 'loading' : 'error' })

  useEffect(() => {
    if (!token) return
    let active = true
    confirmNewsletter(token)
      .then(() => active && setState({ status: 'done' }))
      .catch((err) => active && setState({ status: 'error', message: errorMessage(err) }))
    return () => {
      active = false
    }
  }, [token])

  if (state.status === 'loading') return <StatusCard icon={loadingIcon} title="Confirming your subscription…" />
  if (state.status === 'error') {
    return (
      <StatusCard icon={errorIcon} title="We couldn’t confirm this link">
        <p className="mt-2 text-zinc-600">{state.message ?? 'This link is incomplete. Please use the full link from your email.'}</p>
        <Button to="/blog" variant="secondary" className="mt-8">
          Go to the blog
        </Button>
      </StatusCard>
    )
  }
  return (
    <StatusCard icon={successIcon} title="You’re subscribed">
      <p className="mt-2 text-zinc-600">Thanks for confirming. Our next issue will land in your inbox — practical sales advice, about twice a month.</p>
      <Button to="/blog" className="mt-8">
        Read the latest posts
      </Button>
    </StatusCard>
  )
}

/**
 * /newsletter/unsubscribe?token=… — requires a click rather than unsubscribing on page load,
 * because email security scanners open links automatically.
 */
export function NewsletterUnsubscribe() {
  useSeo({ title: 'Unsubscribe', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; message?: string }>({ status: 'idle' })

  async function onUnsubscribe() {
    setState({ status: 'loading' })
    try {
      await unsubscribeNewsletter(token)
      setState({ status: 'done' })
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err) })
    }
  }

  if (!token) {
    return (
      <StatusCard icon={errorIcon} title="This link is incomplete">
        <p className="mt-2 text-zinc-600">Please use the full unsubscribe link from one of our emails.</p>
      </StatusCard>
    )
  }
  if (state.status === 'done') {
    return (
      <StatusCard icon={successIcon} title="You’ve been unsubscribed">
        <p className="mt-2 text-zinc-600">You won’t receive the TechSync newsletter any more. Changed your mind? You can subscribe again from the footer of any page.</p>
        <Button to="/" variant="secondary" className="mt-8">
          Back to home
        </Button>
      </StatusCard>
    )
  }
  return (
    <StatusCard icon={state.status === 'error' ? errorIcon : null} title="Unsubscribe from the newsletter?">
      <p className="mt-2 text-zinc-600">{state.status === 'error' ? state.message : 'You’ll stop receiving TechSync newsletter emails.'}</p>
      <Button onClick={onUnsubscribe} loading={state.status === 'loading'} className="mt-8">
        Unsubscribe
      </Button>
    </StatusCard>
  )
}
