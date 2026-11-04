import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { useOrgId } from '../crm/hooks'
import { emailKey } from '../email/api'
import { googleKey } from '../google/api'
import { CONNECTIONS_PATH, CONNECTIONS_TEAM_PATH } from './paths'
import { useCanManageConnections } from './useCanManageConnections'

type Tab = 'mine' | 'team'

/** Shared title and "My connections / Team & workspace" switcher for the Email & Google area. */
export function ConnectionsHeader({ tab }: { tab: Tab }) {
  const navigate = useNavigate(), client = useQueryClient(), orgId = useOrgId()
  const isAdmin = useCanManageConnections()
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: emailKey(orgId) }), client.invalidateQueries({ queryKey: googleKey(orgId) })])
  return <div className="space-y-4">
    <PageHeader
      title="Email & Google"
      description="Connect your work Gmail and Google account to email leads, book Google Meet calls and work in Google Sheets without leaving TechSync."
      actions={<Button variant="secondary" size="sm" onClick={() => void refresh()}><RefreshCw className="size-3.5" aria-hidden="true" />Refresh status</Button>}
    />
    {isAdmin && <Tabs<Tab> label="Email & Google views" value={tab} onChange={(next) => navigate(next === 'team' ? CONNECTIONS_TEAM_PATH : CONNECTIONS_PATH)} items={[{ value: 'mine', label: 'My connections' }, { value: 'team', label: 'Team & workspace' }]} />}
  </div>
}
