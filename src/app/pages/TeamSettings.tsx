import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { PageHeader } from '../../components/app/States'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { cn } from '../../lib/cn'
import { Button } from '../../components/ui/Button'
import { InviteDrawer } from '../../features/team/InviteDrawer'
import { InvitationsTab } from '../../features/team/InvitationsTab'
import { MembersTab } from '../../features/team/MembersTab'
import { TeamsTab } from '../../features/team/TeamsTab'
import { RolesTab } from '../../features/team/roles/RolesTab'

/** Settings → Team & roles: tab shell. The tabs live in features/team. `?tab=roles&role=manager` deep-links. */

const tabs = [
  { key: 'members', label: 'Members' },
  { key: 'roles', label: 'Roles' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'teams', label: 'Teams' },
] as const
type TabKey = (typeof tabs)[number]['key']

export default function TeamSettings() {
  useSeo({ title: 'Team & roles', noindex: true })
  const { user } = useAuth()
  const canInvite = useCan('members.invite')
  const [params, setParams] = useSearchParams()
  const [inviting, setInviting] = useState(false)
  const orgId = user?.organization?.id
  if (!orgId) return null
  const visibleTabs = tabs.filter((t) => t.key !== 'invitations' || canInvite)
  const tab: TabKey = visibleTabs.find((t) => t.key === params.get('tab'))?.key ?? 'members'

  function go(next: { tab?: TabKey; role?: string | null }) {
    setParams(
      (current) => {
        const out = new URLSearchParams(current)
        if (next.tab) {
          if (next.tab === 'members') out.delete('tab')
          else out.set('tab', next.tab)
          if (next.tab !== 'roles') out.delete('role')
        }
        if (next.role !== undefined) {
          if (next.role) out.set('role', next.role)
          else out.delete('role')
        }
        return out
      },
      { replace: true },
    )
  }

  return (
    <div>
      <PageHeader title="Team & roles" description="Invite teammates, decide what each role can do, and organize your sales teams." />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Team" className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`team-tab-${t.key}`}
              aria-selected={tab === t.key}
              tabIndex={tab === t.key ? 0 : -1}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const current = visibleTabs.findIndex((item) => item.key === tab)
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? visibleTabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length
                go({ tab: visibleTabs[next].key })
                document.getElementById(`team-tab-${visibleTabs[next].key}`)?.focus()
              }}
              aria-controls="team-tabpanel"
              onClick={() => go({ tab: t.key })}
              className={cn('shrink-0 rounded-lg px-3 py-2 text-sm font-medium', tab === t.key ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canInvite && (
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Invite people
          </Button>
        )}
      </div>
      <div id="team-tabpanel" role="tabpanel" aria-labelledby={`team-tab-${tab}`} className="mt-6">
        {tab === 'members' && <MembersTab orgId={orgId} onViewRole={(roleId) => go({ tab: 'roles', role: roleId })} />}
        {tab === 'roles' && <RolesTab orgId={orgId} roleId={params.get('role')} onRoleChange={(role) => go({ role })} />}
        {tab === 'invitations' && <InvitationsTab orgId={orgId} />}
        {tab === 'teams' && <TeamsTab orgId={orgId} />}
      </div>
      <InviteDrawer open={inviting} onClose={() => setInviting(false)} orgId={orgId} />
    </div>
  )
}
