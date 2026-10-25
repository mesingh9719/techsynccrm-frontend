import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { googleKey, googleMe, type GoogleService } from './api'
import { googleAccessIssue, googleSetupMessages } from './connectionStatus'

export function GoogleSetupDetails({ missing }: { missing: string[] }) {
  const messages = googleSetupMessages(missing)
  if (!messages.length) return null
  return <div className="space-y-2 text-sm"><p className="font-medium">Administrator setup checks</p><ul className="list-disc space-y-1 pl-5">{messages.map((message) => <li className="break-words" key={message}>{message}</li>)}</ul><p className="text-muted">Use the existing Google OAuth client for the Workspace settings, then restart the API and worker after updating the server configuration.</p></div>
}

export function GoogleServiceGate({ service, children }: { service: GoogleService; children: ReactNode }) {
  const orgId = useOrgId(), { user } = useAuth(), allowed = useCan('google.connect.own'), manage = useCan('google.connections.manage')
  const state = useQuery({ queryKey: [...googleKey(orgId), 'me', user?.id], queryFn: googleMe, enabled: allowed })
  if (!allowed) return <p className="surface p-5 text-sm text-muted">Your role cannot use Google workspace tools.</p>
  if (state.isPending) return <p role="status" className="p-5 text-sm text-muted">Checking Google connection…</p>
  if (state.isError) return <FormAlert>Couldn’t check Google access. <button className="underline" onClick={() => void state.refetch()}>Retry</button></FormAlert>
  const issue = googleAccessIssue(state.data, service)
  if (issue) return <div className="surface space-y-3 p-5">
    <h2 className="font-medium">{issue.title}</h2>
    <p className="text-sm leading-6 text-muted">{issue.message}</p>
    {manage && issue.kind === 'setup' && <GoogleSetupDetails missing={state.data.setup.missing} />}
    <div className="flex flex-wrap gap-3"><Button to="/app/settings/google" size="sm">Google connections</Button>{manage && <Button to="/app/settings/google-team" size="sm" variant="secondary">Team & Google</Button>}</div>
  </div>
  return children
}
