import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { emailKey } from './api'
import { gmailConnectionError } from './content'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useGmail } from './useGmail'
import { promptDismissed } from './foundationApi'

export function EmailPrompt() {
  const { user } = useAuth()
  return <><OAuthResult /><Prompt key={`${user?.id}:${user?.organization?.id}`} /></>
}
function Prompt() {
  const { user } = useAuth(), canConnect = useCan('email.connect'), query = useGmail()
  const key = `techsync:email-prompt:v1:${user?.organization?.id}:${user?.id}`
  const [dismissed, setDismissed] = useState(() => {
    try { return promptDismissed(localStorage.getItem(key)) } catch { return false }
  })
  if (dismissed || !canConnect || !query.data?.enabled || !query.data.entitled || query.data.tenantEnabled === false || query.data.account && ['connected', 'syncing', 'delayed'].includes(query.data.account.status)) return null
  return <div role="status" className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900 sm:px-6">
    <p>Connect Gmail to email leads from here. <Link className="font-medium underline" to="/app/settings/gmail">Connect Gmail</Link></p>
    <button type="button" aria-label="Dismiss Gmail reminder for 7 days" className="shrink-0 rounded-lg p-2 hover:bg-brand-100" onClick={() => {
      setDismissed(true); try { localStorage.setItem(key, String(Date.now() + 7 * 86400000)) } catch { /* This tab still remembers. */ }
    }}><X className="size-4" aria-hidden="true" /></button>
  </div>
}

function OAuthResult() {
  const [params, setParams] = useSearchParams(), handled = useRef<string | null>(null)
  const { user } = useAuth(), client = useQueryClient(), notify = useToast()
  const orgId = user?.organization?.id, flag = params.get('gmail')
  useEffect(() => {
    if (!flag) { handled.current = null; return }
    if (handled.current === flag) return
    handled.current = flag
    notify({ title: flag === 'connected' ? 'Gmail connected' : 'Gmail connection incomplete', description: flag === 'connected' ? 'Your mailbox is ready.' : gmailConnectionError(flag), tone: flag === 'connected' ? 'success' : 'error' })
    const clean = new URLSearchParams(params); clean.delete('gmail'); clean.delete('workspace')
    setParams(clean, { replace: true })
    if (orgId) void client.invalidateQueries({ queryKey: emailKey(orgId) })
  }, [flag, params, setParams, notify, client, orgId])
  return null
}
