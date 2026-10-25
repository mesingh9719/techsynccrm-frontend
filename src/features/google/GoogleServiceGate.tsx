import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { googleKey, googleMe, serviceLabels, type GoogleService } from './api'

export function GoogleServiceGate({ service, children }: { service: GoogleService; children: ReactNode }) {
  const orgId = useOrgId(), { user } = useAuth(), allowed = useCan('google.connect.own'), manage = useCan('google.connections.manage')
  const state = useQuery({ queryKey: [...googleKey(orgId), 'me', user?.id], queryFn: googleMe, enabled: allowed })
  if (!allowed) return <p className="surface p-5 text-sm text-muted">Your role cannot use Google workspace tools.</p>
  if (state.isPending) return <p role="status" className="p-5 text-sm text-muted">Checking Google connection…</p>
  if (state.isError) return <FormAlert>Couldn’t check Google access. <button className="underline" onClick={() => void state.refetch()}>Retry</button></FormAlert>
  const entry = state.data.services.find((item) => item.service === service)
  if (!state.data.setup.ready || !entry?.available || !entry.tenantEnabled || !entry.enabled || state.data.connection?.status !== 'connected') return <div className="surface space-y-3 p-5">
    <h2 className="font-medium">Connect {serviceLabels[service]}</h2>
    <p className="text-sm leading-6 text-muted">{!state.data.setup.ready ? 'Your administrator needs to finish Google Workspace setup.' : !entry?.available || !entry.tenantEnabled ? 'Your administrator needs to enable this service for the workspace.' : 'Enable this service for your own Google account in Google connections.'}</p>
    <div className="flex flex-wrap gap-3"><Button to="/app/settings/google" size="sm">Google connections</Button>{manage && <Button to="/app/settings/google-team" size="sm" variant="secondary">Team & Google</Button>}</div>
  </div>
  return children
}
