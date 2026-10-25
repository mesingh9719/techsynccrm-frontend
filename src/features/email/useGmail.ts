import { useAuth } from '../../lib/useAuth'
import { emitAppEvent } from '../../lib/appEvents'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '../crm/hooks'
import { emailKey, gmailMe, startGmail, type GmailState } from './api'
import { gmailPopupChannel, gmailPopupMarker, popupResult, popupResultKey, prunePopupResults, removePopupResult, type GmailPopupAttempt } from './gmailPopup'
import { gmailConnectionError } from './content'

export function useGmail() {
  const orgId = useOrgId(), { user } = useAuth()
  return useQuery({ queryKey: [...emailKey(orgId), 'me', user?.id], queryFn: gmailMe, enabled: Boolean(user?.organization), staleTime: 10000, refetchOnWindowFocus: true, refetchInterval: 30000 })
}
const mailboxStamp = (state: GmailState) => state.account ? `${state.account.id}:${state.account.connectedAt || state.account.createdAt}` : ''
const connectedMailbox = (state: GmailState) => Boolean(state.enabled && state.entitled && state.account && ['connected', 'syncing', 'delayed'].includes(state.account.status))
const closePopup = (opened: Window | null) => { try { opened?.close() } catch { /* COOP can sever the original window handle. */ } }
interface Attempt extends GmailPopupAttempt { baseline: string; started: boolean; finishing: boolean }

export function useConnectGmail() {
  const orgId = useOrgId(), { user } = useAuth(), client = useQueryClient(), popup = useRef<Window | null>(null), attempt = useRef<Attempt | null>(null)
  const [connecting, setConnecting] = useState(false), [error, setError] = useState<string | null>(null)
  useEffect(() => () => {
    if (attempt.current) removePopupResult(attempt.current.popupId)
    attempt.current = null; closePopup(popup.current); popup.current = null
  }, [orgId, user?.id])
  useEffect(() => {
    const current = attempt.current
    if (!connecting || !current) return
    let ticks = 0, pending = false, disposed = false
    const refresh = () => { void client.invalidateQueries({ queryKey: emailKey(orgId) }) }
    const finish = async (status: string, verifiedState?: GmailState) => {
      if (disposed || attempt.current !== current || current.finishing) return
      current.finishing = true
      let success = status === 'connected', message = success ? null : gmailConnectionError(status)
      if (success) {
        try {
          const state = verifiedState || await gmailMe()
          if (!connectedMailbox(state)) { success = false; message = 'Google returned, but the mailbox is not connected. Refresh the status or reconnect.' }
        } catch { success = false; message = 'Couldn’t refresh your Gmail connection. Use Refresh status to check it.' }
      }
      if (disposed || attempt.current !== current) return
      setError(message)
      emitAppEvent({ type: 'toast', title: success ? 'Gmail connected' : 'Gmail connection incomplete', tone: success ? 'success' : 'error', ...(message && { description: message }) })
      closePopup(popup.current); popup.current = null; attempt.current = null
      removePopupResult(current.popupId); refresh(); setConnecting(false)
    }
    const receive = (value: unknown) => {
      const result = popupResult(value, current)
      if (result) void finish(result.status)
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin === window.location.origin && event.source === popup.current) receive(event.data)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== popupResultKey(current.popupId) || !event.newValue) return
      try { receive(JSON.parse(event.newValue)) } catch { /* Ignore unrelated or malformed browser messages. */ }
    }
    let channel: BroadcastChannel | undefined
    try { channel = new BroadcastChannel(gmailPopupChannel); channel.onmessage = (event: MessageEvent<unknown>) => receive(event.data) } catch { /* Storage and server polling remain available. */ }
    window.addEventListener('message', onMessage); window.addEventListener('storage', onStorage)
    try { receive(JSON.parse(localStorage.getItem(popupResultKey(current.popupId)) || 'null')) } catch { /* Optional storage. */ }
    const interval = window.setInterval(() => {
      if (pending || !current.started || current.finishing) return
      if (++ticks > 120) {
        setError('The Gmail connection has not finished. Try connecting again.'); closePopup(popup.current); popup.current = null
        attempt.current = null; removePopupResult(current.popupId); setConnecting(false); return
      }
      pending = true
      // A reconnect may start with an already connected mailbox. Only a fresh server
      // connection timestamp/identity confirms completion when all browser channels fail.
      void client.fetchQuery({ queryKey: [...emailKey(orgId), 'me', user?.id], queryFn: gmailMe, staleTime: 0 }).then((state) => {
        if (!disposed && connectedMailbox(state) && mailboxStamp(state) !== current.baseline) void finish('connected', state)
      }).catch(() => { /* Preserve the page/draft; the next bounded poll can recover. */ }).finally(() => { pending = false })
    }, 2000)
    return () => { disposed = true; channel?.close(); window.removeEventListener('message', onMessage); window.removeEventListener('storage', onStorage); window.clearInterval(interval) }
  }, [connecting, orgId, client, user?.id])
  async function connect(input: Parameters<typeof startGmail>[0]) {
    if (attempt.current) return
    setError(null); prunePopupResults()
    const opened = window.open('', '_blank', 'popup,width=620,height=760')
    if (!opened) { setError('Allow a popup to connect Gmail, then try again.'); return }
    const current: Attempt = { popupId: crypto.randomUUID(), workspace: orgId, createdAt: Date.now(), baseline: '', started: false, finishing: false }
    popup.current = opened; attempt.current = current; setConnecting(true)
    try { opened.sessionStorage.setItem(gmailPopupMarker, JSON.stringify(current)) } catch { /* The server also returns the attempt identifier. */ }
    try {
      current.baseline = mailboxStamp(await gmailMe())
      if (attempt.current !== current) return
      const result = await startGmail({ ...input, popupId: current.popupId }), url = new URL(result.url)
      if (attempt.current !== current) return
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('The Gmail connection address is invalid.')
      current.started = true; opened.location.href = url.toString()
    } catch (err) {
      closePopup(opened)
      if (attempt.current === current) { attempt.current = null; popup.current = null; removePopupResult(current.popupId); setConnecting(false); setError(err instanceof Error ? err.message : 'Gmail could not connect.') }
    }
  }
  function cancel() {
    if (attempt.current) removePopupResult(attempt.current.popupId)
    attempt.current = null; closePopup(popup.current); popup.current = null; setConnecting(false); setError(null)
  }
  return { connect, connecting, error, cancel }
}
