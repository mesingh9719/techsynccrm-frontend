import { useEffect } from 'react'
import { useSeo } from '../../lib/useSeo'
import { Link, useSearchParams } from 'react-router-dom'

export default function OAuthReturnPage() {
  useSeo({ title: 'Gmail connection', noindex: true })
  const [params] = useSearchParams(), connected = params.get('gmail') === 'connected'
  const path = params.get('returnTo') ?? '/app/settings/gmail'
  const returnTo = /^\/app\/(?:leads\/[\w-]+|contacts\/[\w-]+|settings\/gmail)$/.test(path) ? path : '/app/settings/gmail'
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'techsync:gmail-connected', status: connected ? 'connected' : 'failed' }, window.location.origin)
      window.close()
    }
  }, [connected])
  return <main className="mx-auto max-w-lg space-y-4 px-6 py-20"><h1 className="font-display text-2xl font-semibold">{connected ? 'Gmail connected' : 'Gmail connection incomplete'}</h1><p className="text-sm leading-6 text-muted">{connected ? 'You can close this window and return to your draft.' : 'Return to TechSync and try again. Confirm the requested Google permissions and work-mailbox consent.'}</p><Link className="text-brand-700 underline" to={returnTo}>Return to TechSync</Link></main>
}
