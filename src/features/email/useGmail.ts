import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '../crm/hooks'
import { emailKey, gmailMe, startGmail } from './api'

export function useGmail() {
  const orgId = useOrgId()
  return useQuery({ queryKey: [...emailKey(orgId), 'me'], queryFn: gmailMe, staleTime: 10000, refetchOnWindowFocus: true })
}
export function useConnectGmail() {
  const orgId = useOrgId(), client = useQueryClient(), popup = useRef<Window | null>(null)
  const [connecting, setConnecting] = useState(false), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!connecting) return
    let ticks = 0
    const refresh = () => { void client.invalidateQueries({ queryKey: emailKey(orgId) }) }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== popup.current || !event.data || typeof event.data !== 'object') return
      const result = event.data as { type?: string; status?: string }
      if (result.type !== 'techsync:gmail-connected') return
      if (result.status !== 'connected') setError('Gmail was not connected. Check the Google permissions and try again.')
      refresh(); setConnecting(false)
    }
    window.addEventListener('message', onMessage)
    const interval = window.setInterval(() => {
      refresh()
      if (++ticks > 120 || popup.current?.closed) setConnecting(false)
    }, 2000)
    return () => { window.removeEventListener('message', onMessage); window.clearInterval(interval) }
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
