import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, X } from 'lucide-react'
import { listInvitations, resendInvitation, revokeInvitation } from '../../services/team'
import { roleLabels } from '../../lib/permissions'
import { formatDate } from '../../lib/format'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '../../components/app/States'
import { errorText, useTeamData } from './teamData'

/** Pending invitations: resend or cancel. */
export function InvitationsTab({ orgId }: { orgId: string }) {
  const { keys, invalidate } = useTeamData(orgId)
  const notify = useToast()
  const invitations = useQuery({ queryKey: keys.invitations, queryFn: listInvitations })
  const resend = useMutation({
    mutationFn: resendInvitation,
    onSuccess: async () => {
      await invalidate()
      notify({ title: 'Invitation sent again' })
    },
    onError: (err) => notify({ tone: 'error', title: 'Couldn’t resend', description: errorText(err) }),
  })
  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: async () => {
      await invalidate()
      notify({ title: 'Invitation cancelled' })
    },
  })

  if (invitations.isPending) return <ListSkeleton rows={3} />
  if (invitations.isError) return <ErrorState error={invitations.error} onRetry={() => invitations.refetch()} />
  if (!invitations.data.length) return <EmptyState icon={Send} title="No pending invitations" description="People you invite appear here until they join." />

  return (
    <ul className="divide-y divide-zinc-100 rounded-card bg-surface ring-1 ring-line">
      {invitations.data.map((inv) => (
        <li key={inv.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{inv.email}</p>
            <p className="text-xs text-muted">
              {inv.roleName ?? roleLabels[inv.role]} · invited by {inv.invitedByName ?? 'someone'} · {inv.status === 'expired' ? 'expired' : `expires ${formatDate(inv.expiresAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {inv.status === 'expired' && <Badge tone="warning">Expired</Badge>}
            <Button variant="secondary" size="sm" loading={resend.isPending && resend.variables === inv.id} onClick={() => resend.mutate(inv.id)}>
              Resend
            </Button>
            <Button variant="ghost" size="sm" loading={revoke.isPending && revoke.variables === inv.id} onClick={() => revoke.mutate(inv.id)} aria-label={`Cancel invitation for ${inv.email}`}>
              <X className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
