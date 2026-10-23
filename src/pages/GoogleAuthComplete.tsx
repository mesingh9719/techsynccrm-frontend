import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SecondFactorForm } from '../components/auth/SecondFactorForm'
import { AuthShell } from '../components/layout/AuthShell'
import { FormAlert } from '../components/ui/Form'
import { ApiError } from '../services/http'
import { completeGoogleSignIn, googleSignInError, type GoogleResult } from '../services/googleAuth'
import { nextPathFor } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import type { AuthUser } from '../types'

export default function GoogleAuthComplete() {
  useSeo({ title: 'Google sign-in', noindex: true })
  const [params] = useSearchParams(), navigate = useNavigate(), initialError = params.get('error')
  const [error, setError] = useState(initialError ? googleSignInError(initialError) : null)
  const [challenge, setChallenge] = useState<{ token: string; returnTo: string | null } | null>(null)
  const attempt = useRef<Promise<GoogleResult> | null>(null)
  function proceed(user: AuthUser, returnTo: string | null) {
    const next = nextPathFor(user)
    const target = returnTo?.startsWith('/invite') || next === '/app' && returnTo?.startsWith('/app') ? returnTo : next
    navigate(target ?? next, { replace: true })
  }
  useEffect(() => {
    if (initialError) return
    let disposed = false
    // StrictMode may replay the effect; the one-use completion request is shared.
    attempt.current ??= completeGoogleSignIn()
    void attempt.current.then((result) => {
      if (disposed) return
      if (result.twoFactorRequired) setChallenge({ token: result.challengeToken, returnTo: result.returnTo })
      else {
        const next = nextPathFor(result.user), path = result.returnTo
        navigate(path?.startsWith('/invite') || next === '/app' && path?.startsWith('/app') ? path : next, { replace: true })
      }
    }).catch((err) => { if (!disposed) setError(err instanceof ApiError ? googleSignInError(err.code ?? '') : 'Couldn’t finish signing in. Please try again.') })
    return () => { disposed = true }
  }, [initialError, navigate])
  return <AuthShell><div className="mx-auto max-w-md">{challenge ? <SecondFactorForm challengeToken={challenge.token} onRestart={(message) => { setChallenge(null); setError(message) }} onSuccess={(user) => proceed(user, challenge.returnTo)} /> : <><h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{error ? 'Sign-in incomplete' : 'Finishing Google sign-in…'}</h1>{error ? <div className="mt-5 space-y-5"><FormAlert>{error}</FormAlert><div className="flex gap-5 text-sm font-medium text-brand-700"><Link to="/login" className="underline">Back to sign in</Link><Link to="/signup" className="underline">Create an account</Link></div></div> : <p role="status" className="mt-4 text-sm text-muted">Checking your account and restoring your session.</p>}</>}</div></AuthShell>
}
