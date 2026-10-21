import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, LoaderCircle, MailCheck, RefreshCw } from 'lucide-react'
import { fetchMe, logout, resendVerification, verifyEmail } from '../services/auth'
import { ApiError } from '../services/http'
import { nextPathFor, useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { Button } from '../components/ui/Button'
import { FullPageSpinner } from '../components/auth/Guards'
import { useToast } from '../components/ui/Toast'

const RESEND_COOLDOWN = 60

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:py-24">
      <div className="rounded-dialog bg-white p-8 text-center shadow-card ring-1 ring-zinc-200 sm:p-10">{children}</div>
    </div>
  )
}

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial)
  useEffect(() => {
    if (seconds <= 0) return
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [seconds])
  return [seconds, setSeconds] as const
}

/** Handles the link from the email: /verify-email?token=… (works even when signed out). */
function ConfirmToken({ token }: { token: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    let active = true
    verifyEmail(token)
      .then((verified) => active && navigate(nextPathFor(verified), { replace: true, state: { justVerified: true } }))
      .catch((err) => active && setError(err instanceof ApiError ? err : new ApiError('Something went wrong.', 0)))
    return () => {
      active = false
    }
  }, [token, navigate])

  // The link was already used, but this browser is signed in and verified — just move on.
  if (error && user?.emailVerified) return <Navigate to={nextPathFor(user)} replace />

  if (!error) {
    return (
      <Card>
        <div role="status" className="py-6">
          <LoaderCircle className="mx-auto size-7 animate-spin text-brand-700" aria-hidden="true" />
          <p className="mt-4 font-medium text-zinc-900">Verifying your email…</p>
        </div>
      </Card>
    )
  }

  const expired = error.code === 'TOKEN_EXPIRED_LINK'
  return (
    <Card>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
        <CircleAlert className="size-6 text-amber-600" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">{expired ? 'This link has expired' : 'This link isn’t valid'}</h1>
      <p className="mt-2 text-zinc-600">
        {expired
          ? 'Verification links last 24 hours. Request a new one and we’ll send it straight away.'
          : 'It may have already been used, or a newer link was sent. Use the most recent email, or request a new link.'}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {user ? (
          <Button to="/verify-email" replace>
            Send a new link
          </Button>
        ) : (
          <Button to="/login" state={{ from: '/verify-email' }}>
            Log in to get a new link
          </Button>
        )}
      </div>
    </Card>
  )
}

/** "Check your inbox" screen for a signed-in, unverified user. */
function CheckInbox() {
  const { status, user } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [cooldown, setCooldown] = useCountdown(RESEND_COOLDOWN)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)

  // Picks up a verification done in another tab or on another device.
  const checkVerified = useCallback(async () => {
    const me = await fetchMe().catch(() => null)
    if (me?.emailVerified) navigate(nextPathFor(me), { replace: true })
    return Boolean(me?.emailVerified)
  }, [navigate])

  useEffect(() => {
    const onFocus = () => void checkVerified()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [checkVerified])

  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: '/verify-email' }} />
  if (user.emailVerified) return <Navigate to={nextPathFor(user)} replace />

  async function resend() {
    setSending(true)
    try {
      const { sentTo, retryAfter } = await resendVerification()
      setCooldown(retryAfter)
      notify({ title: 'Verification email sent', description: `Check ${sentTo}.` })
    } catch (err) {
      if (err instanceof ApiError && err.retryAfter) setCooldown(err.retryAfter)
      notify({ title: 'Couldn’t send the email', description: err instanceof Error ? err.message : undefined, tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  async function iveVerified() {
    setChecking(true)
    const verified = await checkVerified()
    setChecking(false)
    if (!verified) notify({ title: 'Not verified yet', description: 'Open the link in the email we sent, then try again.', tone: 'error' })
  }

  async function switchEmail() {
    await logout().catch(() => {})
    navigate('/signup', { replace: true })
  }

  return (
    <Card>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
        <MailCheck className="size-6 text-brand-700" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-xs font-medium tracking-wider text-zinc-500 uppercase">Step 1 of 2</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Verify your email</h1>
      <p className="mt-3 text-zinc-600">
        We sent a verification link to <span className="font-medium break-all text-zinc-900">{user.email}</span>. Click it to continue setting
        up your workspace.
      </p>

      <div className="mt-8 grid gap-3">
        <Button onClick={iveVerified} loading={checking} size="lg">
          <CircleCheck className="size-4" aria-hidden="true" />
          I’ve verified my email
        </Button>
        <Button variant="secondary" size="lg" onClick={resend} loading={sending} disabled={cooldown > 0}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
        </Button>
      </div>

      <div className="mt-8 space-y-2 border-t border-zinc-100 pt-6 text-sm text-zinc-500">
        <p>Can’t find it? Check your spam or promotions folder.</p>
        <p>
          Wrong email?{' '}
          <button type="button" onClick={switchEmail} className="font-medium text-brand-700 hover:underline">
            Sign up with a different address
          </button>
        </p>
        <p>
          Need help?{' '}
          <Link to="/contact?topic=support" className="font-medium text-brand-700 hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </Card>
  )
}

export default function VerifyEmail() {
  useSeo({ title: 'Verify your email', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token')
  return token ? <ConfirmToken key={token} token={token} /> : <CheckInbox />
}
