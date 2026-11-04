import { useQuery } from '@tanstack/react-query'
import { assignableRoles, roleDescriptions, roleLabels } from '../../lib/permissions'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { listRoles } from '../../services/roles'
import type { MemberRole, Team } from '../../types'
import { Select } from '../../components/ui/Form'

/** Form pieces shared by the Team settings tabs (Settings → Team & roles). */

/**
 * Role picker: the built-in roles, then the workspace's own roles, with a short explanation.
 * The value is a built-in key (`viewer`) or a custom role id — what the API takes as `role`.
 */
export function RoleSelect({ value, onChange, allowAdmin, id, describedBy }: { value: string; onChange: (role: string) => void; allowAdmin: boolean; id?: string; describedBy?: string }) {
  const { user } = useAuth()
  const orgId = user?.organization?.id ?? 'none'
  const roles = useQuery({ queryKey: qk.org(orgId).roles, queryFn: listRoles })
  const builtIn = assignableRoles.filter((r) => allowAdmin || r !== 'admin')
  const custom = roles.data?.roles.filter((r) => !r.system) ?? []
  const picked = custom.find((r) => r.id === value)
  const description = picked ? picked.description : roleDescriptions[value as MemberRole]
  return (
    <>
      <Select id={id} aria-describedby={describedBy} value={value} onChange={(e) => onChange(e.target.value)}>
        {builtIn.map((r) => (
          <option key={r} value={r}>
            {roleLabels[r]}
          </option>
        ))}
        {custom.length > 0 && (
          <optgroup label="Your roles">
            {custom.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
    </>
  )
}

export function TeamCheckboxes({ teams, value, onChange }: { teams: Team[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (!teams.length) return <p className="text-sm text-muted">No teams yet — create them in the Teams tab.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((t) => {
        const checked = value.includes(t.id)
        return (
          <label
            key={t.id}
            className={cn(
              'inline-flex cursor-pointer items-center rounded-full px-3 py-2 text-sm ring-1 select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
              checked ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface text-ink ring-zinc-300 hover:ring-zinc-400',
            )}
          >
            <input type="checkbox" className="sr-only" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== t.id) : [...value, t.id])} />
            {t.name}
          </label>
        )
      })}
    </div>
  )
}
