import { getChecklist } from '../../services/organizations'
import { useGmail } from '../email/useGmail'
import { listLeads } from '../leads/api'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { listInvitations, listMembers } from '../../services/team'
import { captureKeys, captureLive, makeCaptureApi } from '../capture/api'
import { getFacebookStatus } from '../facebook/api'

export function useSetupProgress() {
  const gmail = useGmail(), canConnectEmail = useCan('email.connect')
  const { user } = useAuth(),
    allowed = useCan('settings.workspace.manage'),
    canInvite = useCan('members.invite'),
    canCreateLead = useCan('leads.create')
  const orgId = user?.organization?.id ?? 'none'
  const canImport = useCan('records.import'), canConfigurePipeline = useCan('settings.pipelines.manage')
  const checklist = useQuery({ queryKey: qk.org(orgId).checklist, queryFn: getChecklist })
  const facebook = useQuery({
    queryKey: ['org', orgId, 'facebook', 'status'],
    queryFn: getFacebookStatus,
    enabled: allowed,
  })
  const members = useQuery({
    queryKey: qk.org(orgId).members('active'),
    queryFn: () => listMembers({ status: 'active' }),
    enabled: canInvite,
  })
  const invitations = useQuery({ queryKey: qk.org(orgId).invitations, queryFn: listInvitations, enabled: canInvite })
  const scope = `${orgId}:${user?.id}`
  const forms = useQuery({
    queryKey: [...captureKeys(scope), 'forms'],
    queryFn: makeCaptureApi(scope).listForms,
    enabled: allowed && captureLive,
  })
  const sourceConnected =
    Boolean(captureLive && forms.data?.some((f) => f.isActive)) ||
    Boolean(facebook.data?.connected && facebook.data.pages.some((p) => p.enabled && p.forms.some((f) => f.enabled)))
  const firstLead = useQuery({ queryKey: qk.org(orgId).leads.list({ limit: 1, counts: true }), queryFn: () => listLeads({ limit: 1, counts: true }), enabled: canCreateLead })
  const items = [
    ...(canConnectEmail && gmail.data?.enabled && gmail.data.entitled && gmail.data.tenantEnabled !== false ? [{ key: 'gmail', title: 'Connect your Gmail', description: 'Use your work address to email leads from TechSync.', done: Boolean(gmail.data.account && ['connected', 'syncing', 'delayed'].includes(gmail.data.account.status)), href: '/app/settings/gmail' }] : []),
    {
      key: 'workspace',
      title: 'Make this workspace yours',
      description: 'Your business name and preferences.',
      done: Boolean(user?.organization),
      href: '/app/setup?step=0',
    },
    ...(allowed
      ? [
          {
            key: 'source',
            title: 'Connect your first lead source',
            description: 'Bring enquiries into one inbox automatically.',
            done: sourceConnected,
            href: '/app/setup?step=1',
          },
        ]
      : []),
    ...(canInvite
      ? [
          {
            key: 'team',
            title: 'Bring your team along',
            description: 'Invite someone to follow up with you.',
            done: Boolean((members.data?.length ?? 0) > 1 || invitations.data?.some((i) => i.status === 'pending')),
            href: '/app/setup?step=2',
          },
        ]
      : []),
    ...(canCreateLead ? [{ key: 'first-lead', title: 'Add your first lead', description: 'Start with a real enquiry and assign the next step.', done: (firstLead.data?.counts?.all ?? firstLead.data?.items.length ?? 0) > 0, href: '/app/leads?create=true' }] : []),
    ...(canConfigurePipeline ? [{ key: 'pipeline', title: 'Set up your pipeline', description: 'Use the default stages or adapt them to your business.', done: Boolean(checklist.data?.items.find(i => i.key === 'first_pipeline')?.done), href: '/app/settings/pipelines' }] : []),
    ...(canImport ? [{ key: 'import', title: 'Import your existing enquiries', description: 'Map your spreadsheet and review duplicates before importing.', done: Boolean(checklist.data?.items.find(i => i.key === 'import_leads')?.done), href: '/app/import?entity=lead' }] : []),
  ]
  return {
    items,
    sourceConnected,
    canInvite,
    canImport,
    canCreateLead,
    canConfigurePipeline,
    allowed,
    sourceError: facebook.isError || forms.isError,
  }
}
