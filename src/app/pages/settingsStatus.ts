import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useCan, useEntitlement, useOrg } from '../../lib/useOrg'
import { emailKey, gmailMe } from '../../features/email/api'
import { googleKey, googleMe } from '../../features/google/api'
import { getFacebookStatus } from '../../features/facebook/api'

export type SettingsStatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
export interface SettingsStatus {
  text: string
  tone: SettingsStatusTone
}

const planNames: Record<string, string> = { starter: 'Starter', growth: 'Growth', business: 'Business', enterprise: 'Enterprise' }

/**
 * Short live badges for the Settings home cards (plan, seats, connections). Shares query keys with
 * the pages themselves so opening a card reuses the cache; failures just hide the badge.
 */
export function useSettingsStatus(): Partial<Record<string, SettingsStatus>> {
  const { user } = useAuth()
  const { plan } = useOrg()
  const orgId = user?.organization?.id ?? 'none'
  const seats = useEntitlement('users')
  const canManageWorkspace = useCan('settings.workspace.manage')
  const signedIn = Boolean(user?.organization)

  const gmail = useQuery({ queryKey: [...emailKey(orgId), 'me', user?.id], queryFn: gmailMe, enabled: signedIn, staleTime: 30_000, retry: false })
  const google = useQuery({ queryKey: [...googleKey(orgId), 'me', user?.id], queryFn: googleMe, enabled: signedIn, staleTime: 30_000, retry: false })
  const facebook = useQuery({ queryKey: ['org', orgId, 'facebook', 'status'], queryFn: getFacebookStatus, enabled: canManageWorkspace, staleTime: 30_000, retry: false })

  const status: Partial<Record<string, SettingsStatus>> = {}
  if (plan) status.plan = { text: planNames[plan] ?? plan, tone: 'brand' }
  if (seats.limit !== null && seats.used !== null) {
    status.team = { text: `${seats.used} of ${seats.limit} seats`, tone: seats.used >= seats.limit ? 'warning' : 'neutral' }
  }

  // One badge for the merged Email & Google area: attention first, then how much is connected.
  const mailbox = gmail.data?.account, connection = google.data?.connection
  const mailboxOk = Boolean(mailbox && ['connected', 'syncing', 'delayed'].includes(mailbox.status))
  const googleOk = connection?.status === 'connected'
  if ((mailbox && !mailboxOk && mailbox.status !== 'disconnected') || connection?.status === 'reconnect_required') status.connections = { text: 'Needs attention', tone: 'warning' }
  else if (mailboxOk && googleOk) status.connections = { text: 'Connected', tone: 'success' }
  else if (mailboxOk || googleOk) status.connections = { text: 'Partly set up', tone: 'neutral' }
  else if ((gmail.data?.enabled && gmail.data.entitled) || google.data?.canConnect) status.connections = { text: 'Not connected', tone: 'neutral' }

  if (facebook.data) {
    const forms = facebook.data.pages.filter((p) => p.enabled).flatMap((p) => p.forms)
    if (facebook.data.needsReconnect || forms.some((f) => f.lastError)) status.facebook = { text: 'Needs attention', tone: 'danger' }
    else if (facebook.data.connected) status.facebook = { text: 'Connected', tone: 'success' }
  }
  return status
}
