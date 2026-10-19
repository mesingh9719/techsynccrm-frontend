import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { settingsNav } from '../navigation'

const groups = ['You', 'Workspace'] as const

/** Settings section: sub-navigation on the left (a scrollable strip on phones), page on the right. */
export default function SettingsLayout() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Settings</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings">
          <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-6 lg:overflow-visible lg:px-0">
            {groups.map((group) => (
              <div key={group} className="contents lg:block">
                <p className="hidden px-2.5 pb-1.5 text-xs font-medium text-zinc-500 lg:block">{group}</p>
                <ul className="contents lg:block lg:space-y-0.5">
                  {settingsNav
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <li key={item.key} className="shrink-0">
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap',
                              isActive ? 'bg-white font-medium text-zinc-950 shadow-card ring-1 ring-zinc-200' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                            )
                          }
                        >
                          {item.label}
                          {!item.ready && <span className="text-[10px] font-medium text-zinc-400">Soon</span>}
                        </NavLink>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
