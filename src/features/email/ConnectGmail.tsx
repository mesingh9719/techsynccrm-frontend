import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input, Textarea } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { useConnectGmail } from './useGmail'
import { splitExclusions } from './content'
import type { GmailState } from './api'

export function ConnectGmail({ state, returnTo }: { state: GmailState; returnTo: string }) {
  const connect = useConnectGmail(), canConnect = useCan('email.connect')
  const [consent, setConsent] = useState(false), [backfill, setBackfill] = useState(false)
  const [excludeAddresses, setExcludeAddresses] = useState(state.account?.excludedAddresses.join(', ') ?? ''), [excludeDomains, setExcludeDomains] = useState(state.account?.excludedDomains.join(', ') ?? '')
  if (!canConnect) return <p className="text-sm text-muted">Your role can read permitted email history. Sending and connecting require an employee role.</p>
  if (!state.entitled) return <div className="space-y-3"><p className="text-sm text-muted">Gmail sending and replies are included in Growth and above. Existing email history remains available.</p><Button variant="secondary" to="/app/settings/plan">View plan</Button></div>
  if (!state.enabled) return <div className="space-y-2"><p className="font-medium text-ink">Gmail setup is pending</p><p className="text-sm leading-6 text-muted">Your workspace can use Gmail after the service is configured. You can continue logging emails or opening your email app.</p></div>
  return <div className="space-y-4">
    <div className="flex gap-3"><Mail className="mt-1 size-5 shrink-0 text-brand-700" /><div><p className="font-medium text-ink">Connect your work Gmail</p><p className="mt-1 text-sm leading-6 text-muted">Send from your own address and bring matching lead replies into this timeline. Google grants mailbox access; TechSync imports messages matching CRM leads and conversations, rather than your whole inbox.</p></div></div>
    <p className="text-sm leading-6 text-muted">People who can view a record can read its shared email history. A known lead may also email you personally, so use a work mailbox and exclude private addresses. History is kept for up to 365 days. Disconnect stops future access; deleting imported history is a separate action.</p>
    <label className="block text-sm text-ink">Exclude email addresses<Textarea aria-label="Exclude email addresses" rows={2} value={excludeAddresses} onChange={(e) => setExcludeAddresses(e.target.value)} placeholder="Private addresses, separated by commas" /></label>
    <label className="block text-sm text-ink">Exclude domains<Input aria-label="Exclude domains" value={excludeDomains} onChange={(e) => setExcludeDomains(e.target.value)} placeholder="example.com, another.com" /></label>
    <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />Import up to 500 matching messages from the last 30 days. Otherwise, start with new messages.</label>
    <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I understand that matched work emails will be shared with people who can access the CRM record.</label>
    {connect.error && <FormAlert>{connect.error}</FormAlert>}
    <div className="flex flex-wrap items-center gap-3"><Button disabled={!consent || connect.connecting} onClick={() => connect.connect({ consentVersion: state.consentVersion, returnTo, backfillDays: backfill ? 30 : 0, excludedAddresses: splitExclusions(excludeAddresses), excludedDomains: splitExclusions(excludeDomains) })}>{connect.connecting ? 'Waiting for Google…' : state.account ? 'Reconnect Gmail' : 'Connect Gmail'}</Button><Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 hover:underline">Privacy policy</Link></div>
  </div>
}
