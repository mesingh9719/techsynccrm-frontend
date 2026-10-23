import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '../crm/hooks'
import { emailKey, gmailMe, startGmail } from './api'
import { gmailConnectionError } from './content'

export function useGmail() {
  const orgId = useOrgId()
  return useQuery({ queryKey: [...emailKey(orgId), 'me'], queryFn: gmailMe, staleTime: 10000, refetchOnWindowFocus: true })
}
export function useConnectGmail() {
  const orgId = useOrgId(), client = useQueryClient(), popup = useRef<Window | null>(null)
  const [connecting, setConnecting] = useState(false), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!connecting) return
    let ticks = 0, pending = false, disposed = false
    const refresh = () => { void client.invalidateQueries({ queryKey: emailKey(orgId) }) }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== popup.current || !event.data || typeof event.data !== 'object') return
      const result = event.data as { type?: string; status?: string }
      if (result.type !== 'techsync:gmail-connected') return
      if (result.status !== 'connected') setError(gmailConnectionError(result.status))
      refresh(); setConnecting(false)
    }
    window.addEventListener('message', onMessage)
    const interval = window.setInterval(() => {
      if (pending) return
      if (++ticks > 120) { setError('The Gmail connection has not finished. Return to the Google window or try connecting again.'); setConnecting(false); return }
      pending = true
      // Google can sever window.opener through COOP, making popup.closed true while it is open.
      // Read the authenticated server state instead of using that browser flag as completion.
      void client.fetchQuery({ queryKey: [...emailKey(orgId), 'me'], queryFn: gmailMe, staleTime: 0 }).then((state) => {
        if (!disposed && state.enabled && state.entitled && state.account && ['connected', 'syncing', 'delayed'].includes(state.account.status)) { refresh(); setConnecting(false) }
      }).catch(() => { /* Keep the draft and allow the next bounded poll to recover. */ }).finally(() => { pending = false })
    }, 2000)
    return () => { disposed = true; window.removeEventListener('message', onMessage); window.clearInterval(interval) }
  }, [connecting, orgId, client])
  async function connect(input: Parameters<typeof startGmail>[0]) {
    setError(null)
    const opened = window.open('', '_blank', 'popup,width=620,height=760')
    if (!opened) { setError('Allow a popup to connect Gmail, then try again.'); return }
    popup.current = opened
    try {
      const result = await startGmail(input), url = new URL(result.url)
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('The Gmail connection address is invalid.')
      opened.location.href = url.toString(); setConnecting(true)
    } catch (err) { opened.close(); setError(err instanceof Error ? err.message : 'Gmail could not connect.') }
  }
  return { connect, connecting, error }
}
