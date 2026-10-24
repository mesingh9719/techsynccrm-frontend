import { useAuth } from '../../lib/useAuth'
import { emitAppEvent } from '../../lib/appEvents'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '../crm/hooks'
import { emailKey, gmailMe, startGmail } from './api'
import { gmailConnectionError } from './content'

export function useGmail() {
  const orgId = useOrgId(), { user } = useAuth()
  return useQuery({ queryKey: [...emailKey(orgId), 'me', user?.id], queryFn: gmailMe, enabled: Boolean(user?.organization), staleTime: 10000, refetchOnWindowFocus: true, refetchInterval: 30000 })
}
export function useConnectGmail() {
  const orgId = useOrgId(), { user } = useAuth(), client = useQueryClient(), popup = useRef<Window | null>(null)
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
      emitAppEvent({ type: 'toast', title: result.status === 'connected' ? 'Gmail connected' : 'Gmail connection incomplete', tone: result.status === 'connected' ? 'success' : 'error', ...(result.status !== 'connected' && { description: gmailConnectionError(result.status) }) })
      refresh(); setConnecting(false)
    }
    window.addEventListener('message', onMessage)
    const interval = window.setInterval(() => {
      if (pending) return
      if (++ticks > 120) { setError('The Gmail connection has not finished. Return to the Google window or try connecting again.'); setConnecting(false); return }
      pending = true
      // Google can sever window.opener through COOP, making popup.closed true while it is open.
      // Read the authenticated server state instead of using that browser flag as completion.
      void client.fetchQuery({ queryKey: [...emailKey(orgId), 'me', user?.id], queryFn: gmailMe, staleTime: 0 }).then((state) => {
        if (!disposed && state.enabled && state.entitled && state.account && ['connected', 'syncing', 'delayed'].includes(state.account.status)) { refresh(); setConnecting(false) }
      }).catch(() => { /* Keep the draft and allow the next bounded poll to recover. */ }).finally(() => { pending = false })
    }, 2000)
    return () => { disposed = true; window.removeEventListener('message', onMessage); window.clearInterval(interval) }
  }, [connecting, orgId, client, user?.id])
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
  function cancel() { try { popup.current?.close() } catch { /* Google may have isolated the popup. */ } setConnecting(false); setError(null) }
  return { connect, connecting, error, cancel }
}
