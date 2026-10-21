import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, LoaderCircle, Plus } from 'lucide-react'
import { listOrganizations } from '../services/organizations'
import { qk } from '../lib/queryKeys'
import { useAuth } from '../lib/useAuth'
import { roleLabels } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../components/app/Menu'
import { cn } from '../lib/cn'
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog'
import { useWorkspaceSwitch } from './useWorkspaceSwitch'

function WorkspaceMark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-xs font-semibold text-white', className)} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** Shows the active workspace; lists the others to switch to, and creates new ones. */
export function WorkspaceSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { user } = useAuth()
  const notify = useToast()
  const { switchTo } = useWorkspaceSwitch()
  const [creating, setCreating] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const workspaces = useQuery({ queryKey: qk.workspaces, queryFn: listOrganizations, staleTime: 60_000 })
  const current = user?.organization

  if (!current) return null

  async function onSwitch(id: string, close: () => void) {
    if (id === current?.id) return close()
    setSwitchingId(id)
    try {
      await switchTo(id)
      close()
    } catch {
      notify({ tone: 'error', title: 'Couldn’t switch workspace', description: 'Please try again.' })
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <>
      <Menu
        className="w-72"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            title={current.name}
            aria-label={`Switch workspace: ${current.name}`}
            className={cn('workspace-switcher flex min-h-10 w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-subtle', className)}
          >
            <WorkspaceMark name={current.name} />
            <span className={compact ? 'sr-only' : 'min-w-0 flex-1'}>
              <span className="workspace-name block truncate text-sm font-semibold text-ink">{current.name}</span>
              <span className="workspace-plan block truncate text-xs text-muted capitalize">{current.plan} plan</span>
            </span>
            <ChevronsUpDown className={cn("size-4 shrink-0 text-muted", compact && "hidden")} aria-hidden="true" />
            <span className="sr-only">Switch workspace</span>
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuLabel>Workspaces</MenuLabel>
            {workspaces.isPending && (
              <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading…
              </p>
            )}
            {(workspaces.data ?? []).map((ws) => (
              <MenuItem
                key={ws.id}
                onSelect={() => onSwitch(ws.id, close)}
                icon={switchingId === ws.id ? <LoaderCircle className="size-4 animate-spin" /> : ws.id === current.id ? <Check className="size-4 text-brand-700" /> : null}
              >
                <span className="block truncate font-medium text-ink">{ws.name}</span>
                <span className="block text-xs text-muted">{roleLabels[ws.role]}</span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem
              icon={<Plus className="size-4" />}
              onSelect={() => {
                close()
                setCreating(true)
              }}
            >
              Create workspace
            </MenuItem>
          </>
        )}
      </Menu>
      <CreateWorkspaceDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
