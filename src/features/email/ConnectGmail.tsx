import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Copy, ExternalLink, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useConnectGmail } from './useGmail'
import type { GmailState } from './api'

export function ConnectGmail({ state, returnTo }: { state: GmailState; returnTo: string }) {
  const connect = useConnectGmail(), canConnect = useCan('email.connect'), canManage = useCan('email.connections.manage'), notify = useToast()
  if (!canConnect) return <Notice title="A mailbox connection needs employee access">Your role does not include connecting a mailbox. Ask your administrator for access.</Notice>
  if (state.tenantEnabled === false) return <Notice tone="warning" title="Email connections are turned off">Your administrator can enable email connections in Team &amp; Email.</Notice>
  if (!state.entitled) return <Notice tone="violet" title="Gmail is included in Growth and above" actions={<Button variant="secondary" size="sm" to="/app/settings/plan">View plan<ArrowUpRight className="size-3.5" aria-hidden="true" /></Button>}>Connect your work Gmail when your workspace has an eligible plan.</Notice>
  if (!state.enabled) return <div className="space-y-3"><Notice tone="warning" title="Gmail setup is pending">Your administrator can complete the setup to enable connections.</Notice>{canManage && state.setup && <details className="rounded-xl border border-line bg-surface-subtle p-4 text-xs"><summary className="cursor-pointer font-semibold text-ink">Administrator setup details</summary><ul className="mt-3 space-y-2 text-muted">{[
    { pending: state.setup.missing.includes('enabled'), label: 'Enable email connections on the server' },
    { pending: state.setup.missing.includes('clientId') || state.setup.missing.includes('clientSecret'), label: 'Add the Google OAuth client credentials' },
    { pending: state.setup.missing.includes('redirectUri'), label: 'Configure the Google callback URL' },
    { pending: state.setup.missing.includes('encryption'), label: 'Configure secure connection storage' },
  ].map((item) => <li key={item.label} className="flex items-center gap-2"><span className={`grid size-4 shrink-0 place-items-center rounded-full ${item.pending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{!item.pending && <Check className="size-3" aria-hidden="true" />}</span><span className="flex-1">{item.label}</span><span className="shrink-0 text-[10px] font-medium">{item.pending ? 'Pending' : 'Ready'}</span></li>)}</ul>{state.setup.redirectUri && <div className="mt-4 border-t border-line pt-3"><p className="leading-5 text-muted">Register this exact callback URL in your Google OAuth client.</p><code className="mt-2 block break-all rounded-lg border border-line bg-surface p-2 text-[11px] text-ink">{state.setup.redirectUri}</code><Button variant="ghost" size="sm" className="mt-2" onClick={async () => { try { await navigator.clipboard.writeText(state.setup!.redirectUri!); notify({ title: 'Callback URL copied' }) } catch { notify({ title: 'Couldn’t copy the URL', description: 'Select and copy the callback URL above.', tone: 'error' }) } }}><Copy className="size-3.5" aria-hidden="true" />Copy callback URL</Button></div>}</details>}</div>
  return <div className="space-y-4">
    <div><h2 className="text-sm font-semibold text-ink">Connect your Gmail to email leads from TechSync</h2><p className="mt-2 text-sm leading-6 text-muted">We only request permission to send email on your behalf. You can disconnect anytime.</p></div>
    <div className="flex flex-wrap gap-2"><StatusChip tone="info" icon={ShieldCheck}>Secure Google authorization</StatusChip><StatusChip tone="neutral" icon={Mail}>Gmail &amp; Workspace</StatusChip></div>
    <p className="text-xs leading-5 text-muted">Choose your work Gmail or Google Workspace account. It can be different from the email you use to sign in.</p>
    {connect.error && <Notice tone="danger" title="Gmail wasn’t connected">{connect.error}</Notice>}
    {connect.connecting && <Notice title="Finish connecting in the Google window">Keep this page open. We’ll update your connection when Google finishes.</Notice>}
    <div className="flex flex-wrap items-center gap-3"><Button loading={connect.connecting} onClick={() => connect.connect({ consentVersion: state.consentVersion, returnTo, backfillDays: 0, excludedAddresses: [], excludedDomains: [] })}><Mail className="size-4" aria-hidden="true" />{state.account ? 'Reconnect Gmail' : 'Connect Gmail'}<ArrowUpRight className="size-3.5" aria-hidden="true" /></Button>{connect.connecting ? <Button variant="ghost" size="sm" onClick={connect.cancel}>Cancel connection</Button> : <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-brand-700">Privacy policy<ExternalLink className="size-3" aria-hidden="true" /></Link>}</div>
  </div>
}
