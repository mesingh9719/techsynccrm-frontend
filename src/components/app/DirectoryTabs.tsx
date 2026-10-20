import { NavLink } from 'react-router-dom'
import { Building2, Users } from 'lucide-react'
import { cn } from '../../lib/cn'

export function DirectoryTabs() {
  return (
    <nav aria-label="Contacts and companies" className="mt-5 flex gap-1 border-b border-zinc-200">
      {[
        { to: '/app/contacts', label: 'Contacts', icon: Users },
        { to: '/app/companies', label: 'Companies', icon: Building2 },
      ].map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium',
              isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-500 hover:text-zinc-900',
            )
          }
        >
          <item.icon className="size-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
