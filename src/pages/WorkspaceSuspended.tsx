import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { UsersRound } from 'lucide-react'
import { logout } from '../services/auth'
import { listOrganizations } from '../services/organizations'
import { useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { qk } from '../lib/queryKeys'
import { useWorkspaceSwitch } from '../app/useWorkspaceSwitch'
import { Button } from '../components/ui/Button'
import { FullPageSpinner } from '../components/auth/Guards'

/**
 * Where members land (403 SEAT_SUSPENDED) while a workspace that was downgraded has more members
 * than seats and the owner hasn't yet chosen who stays (M06).
 */
export default function WorkspaceSuspended() {
  useSeo({ title: 'Workspace access paused', noindex: true })
  const { status, user } = useAuth()
  const navigate = useNavigate()
  const { switchTo } = useWorkspaceSwitch()
  const [busy, setBusy] = useState<string | null>(null)
  const workspaces = useQuery({ queryKey: qk.workspaces, queryFn: listOrganizations, enabled: Boolean(user) })

  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />

  const others = (workspaces.data ?? []).filter((w) => !w.current)

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
      <div className="rounded-dialog bg-white p-8 shadow-card ring-1 ring-zinc-200 sm:p-10">
        <span className="flex size-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
          <UsersRound className="size-6 text-amber-700" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">Access to {user.organization?.name ?? 'this workspace'} is paused</h1>
        <p className="mt-2 text-zinc-600">
          The workspace moved to a plan with fewer seats than it has members. Until the owner chooses who keeps access, only they and one admin can sign in. Your data
          and records are safe — please contact the workspace owner.
        </p>

        {others.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-medium text-zinc-900">Your other workspaces</p>
            <ul className="mt-2 divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
              {others.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-sm text-zinc-800">{w.name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === w.id}
                    onClick={async () => {
                      setBusy(w.id)
                      await switchTo(w.id).finally(() => setBusy(null))
                    }}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/app', { replace: true })}>
            Try again
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await logout().catch(() => {})
              navigate('/login', { replace: true })
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
