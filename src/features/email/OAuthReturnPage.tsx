import { useEffect, useRef } from 'react'
import { useSeo } from '../../lib/useSeo'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { gmailConnectionError } from './content'

export default function OAuthReturnPage() {
  useSeo({ title: 'Gmail connection', noindex: true })
  const navigate = useNavigate(), handled = useRef(false)
  const [params] = useSearchParams(), status = params.get('gmail') ?? '', connected = status === 'connected'
  const path = params.get('returnTo') ?? '/app/settings/gmail'
  const returnTo = /^\/app\/(?:leads\/[\w-]+|contacts\/[\w-]+|settings\/(?:gmail|email|team-email))$/.test(path) ? path : '/app/settings/gmail'
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    if (window.opener) {
      window.opener.postMessage({ type: 'techsync:gmail-connected', status }, window.location.origin)
      window.history.replaceState(null, '', window.location.pathname)
      window.close()
    } else {
      navigate(`${returnTo}?gmail=${encodeURIComponent(status)}`, { replace: true })
    }
  }, [status, returnTo, navigate])
  return <main className="mx-auto max-w-lg space-y-4 px-6 py-20"><h1 className="font-display text-2xl font-semibold">{connected ? 'Gmail connected' : 'Gmail connection incomplete'}</h1><p className="text-sm leading-6 text-muted">{connected ? 'You can close this window and return to your draft.' : gmailConnectionError(status)}</p><Link className="text-brand-700 underline" to={returnTo}>Return to TechSync</Link></main>
}
