import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { useConnectGmail } from './useGmail'
import type { GmailState } from './api'

export function ConnectGmail({ state, returnTo }: { state: GmailState; returnTo: string }) {
  const connect = useConnectGmail(), canConnect = useCan('email.connect')
  if (!canConnect) return <p className="text-sm text-muted">Your role does not include connecting a mailbox. Ask your administrator for access.</p>
  if (state.tenantEnabled === false) return null
  if (!state.entitled) return <div className="space-y-3"><p className="text-sm text-muted">Gmail is included in Growth and above.</p><Button variant="secondary" to="/app/settings/plan">View plan</Button></div>
  if (!state.enabled) return <p role="status" className="text-sm text-muted">Gmail setup is pending. Your administrator can complete the setup to enable connections.</p>
  return <div className="space-y-4">
    <div className="flex gap-3"><Mail className="mt-1 size-5 shrink-0 text-brand-700" aria-hidden="true" /><div><h2 className="font-medium text-ink">Connect your Gmail to email leads from TechSync</h2><p className="mt-1 text-sm leading-6 text-muted">We only request permission to send email on your behalf. You can disconnect anytime.</p></div></div>
    <p className="text-sm text-muted">Choose your work Gmail or Google Workspace account. It can be different from the email you use to sign in.</p>
    {connect.error && <FormAlert>{connect.error}</FormAlert>}
    <div className="flex flex-wrap items-center gap-3"><Button loading={connect.connecting} onClick={() => connect.connect({ consentVersion: state.consentVersion, returnTo, backfillDays: 0, excludedAddresses: [], excludedDomains: [] })}>{state.account ? 'Reconnect Gmail' : 'Connect Gmail'}</Button><Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline">Privacy policy</Link></div>
  </div>
}
