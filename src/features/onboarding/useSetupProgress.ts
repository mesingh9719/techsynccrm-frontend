import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { listInvitations, listMembers } from '../../services/team'
import { captureKeys, captureLive, makeCaptureApi } from '../capture/api'
import { getFacebookStatus } from '../facebook/api'

export function useSetupProgress() {
  const { user } = useAuth(),
    allowed = useCan('settings.workspace.manage'),
    canInvite = useCan('members.invite')
  const orgId = user?.organization?.id ?? 'none',
    key = `techsync:setup:v1:${orgId}:${user?.id}`
  const [sampleViewed, setSampleViewed] = useState(() => {
    try {
      return localStorage.getItem(key) === 'sample-viewed'
    } catch {
      return false
    }
  })
  useEffect(() => {
    const update = () => {
      try {
        setSampleViewed(localStorage.getItem(key) === 'sample-viewed')
      } catch {
        /* Remains local to this tab. */
      }
    }
    update()
    window.addEventListener('techsync:setup', update)
    return () => window.removeEventListener('techsync:setup', update)
  }, [key])
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
  const items = [
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
    {
      key: 'sample',
      title: 'Explore a sample lead',
      description: 'See how a simple follow-up works.',
      done: sampleViewed,
      href: '/app/setup?step=3',
    },
  ]
  return {
    items,
    sourceConnected,
    canInvite,
    allowed,
    markSample: () => {
      setSampleViewed(true)
      try {
        localStorage.setItem(key, 'sample-viewed')
      } catch {
        /* Session state still works. */
      }
      window.dispatchEvent(new Event('techsync:setup'))
    },
    sourceError: facebook.isError,
  }
}
