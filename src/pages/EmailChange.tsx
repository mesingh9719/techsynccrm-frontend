import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, LoaderCircle, ShieldAlert } from 'lucide-react'
import { cancelEmailChange, confirmEmailChange, fetchMe } from '../services/auth'
import { ApiError, clearSession } from '../services/http'
import { useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { Button } from '../components/ui/Button'

function Card({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
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

const ok = (
  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
    <CircleCheck className="size-6 text-emerald-600" aria-hidden="true" />
  </span>
)
const bad = (
  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
    <CircleAlert className="size-6 text-red-600" aria-hidden="true" />
  </span>
)
const message = (err: unknown) => (err instanceof ApiError && err.status !== 0 && err.status < 500 ? err.message : 'Something went wrong. Please try again.')

// The link can be opened twice in React StrictMode; reuse the in-flight request per token.
const confirmRequests = new Map<string, ReturnType<typeof confirmEmailChange>>()

/** /confirm-email-change?token=… — from the new inbox. */
export default function ConfirmEmailChange() {
  useSeo({ title: 'Confirm email', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user } = useAuth()
  const [state, setState] = useState<{ status: 'loading' | 'done' | 'error'; text?: string }>({ status: token ? 'loading' : 'error', text: 'This link is incomplete.' })

  useEffect(() => {
    if (!token) return
    let active = true
    let request = confirmRequests.get(token)
    if (!request) {
      request = confirmEmailChange(token)
      confirmRequests.set(token, request)
    }
    request
      .then(async ({ email }) => {
        await fetchMe().catch(() => {})
        if (active) setState({ status: 'done', text: email })
      })
      .catch((err) => active && setState({ status: 'error', text: message(err) }))
    return () => {
      active = false
    }
  }, [token])

  if (state.status === 'loading') return <Card icon={<LoaderCircle className="mx-auto size-7 animate-spin text-brand-600" aria-hidden="true" />} title="Confirming your new email…" />
  if (state.status === 'error') {
    return (
      <Card icon={bad} title="We couldn’t confirm this email">
        <p className="mt-2 text-zinc-600">{state.text} You can start the change again from your profile.</p>
        <Button to={user ? '/app/settings/profile' : '/login'} variant="secondary" className="mt-8">
          {user ? 'Go to profile' : 'Sign in'}
        </Button>
      </Card>
    )
  }
  return (
    <Card icon={ok} title="Email updated">
      <p className="mt-2 text-zinc-600">
        You’ll sign in with <strong className="font-medium text-zinc-900">{state.text}</strong> from now on.
      </p>
      <Button to={user ? '/app' : '/login'} className="mt-8">
        {user ? 'Back to TechSync' : 'Sign in'}
      </Button>
    </Card>
  )
}

/**
 * /cancel-email-change?token=… — "this wasn't me" from the old inbox. Needs a click (email scanners
 * open links), then cancels or reverts the change and signs out every device.
 */
export function CancelEmailChange() {
  useSeo({ title: 'Cancel email change', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; text?: string; reverted?: boolean }>({ status: 'idle' })

  async function cancel() {
    setState({ status: 'loading' })
    try {
      const { email, reverted } = await cancelEmailChange(token)
      clearSession()
      setState({ status: 'done', text: email, reverted })
    } catch (err) {
      setState({ status: 'error', text: message(err) })
    }
  }

  if (state.status === 'done') {
    return (
      <Card icon={ok} title={state.reverted ? 'Your email has been restored' : 'Email change cancelled'}>
        <p className="mt-2 text-zinc-600">
          Your account uses <strong className="font-medium text-zinc-900">{state.text}</strong>. We’ve signed out every device — sign in again, and if you didn’t ask for this change,{' '}
          <Link to="/login?mode=reset" className="font-medium text-brand-700 hover:underline">
            reset your password
          </Link>
          .
        </p>
        <Button to="/login" className="mt-8">
          Sign in
        </Button>
      </Card>
    )
  }
  return (
    <Card
      icon={
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
          <ShieldAlert className="size-6 text-amber-600" aria-hidden="true" />
        </span>
      }
      title="Didn’t ask to change your email?"
    >
      <p className="mt-2 text-zinc-600">{state.status === 'error' ? state.text : 'We’ll stop the change, keep your current email, and sign out every device in case someone else has your password.'}</p>
      {token && (
        <Button onClick={cancel} loading={state.status === 'loading'} className="mt-8">
          Cancel the change
        </Button>
      )}
    </Card>
  )
}
