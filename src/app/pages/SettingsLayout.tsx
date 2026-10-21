import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { settingsNav } from '../navigation'

const groups = ['You', 'Workspace'] as const

/** Settings section: sub-navigation on the left (a scrollable strip on phones), page on the right. */
export default function SettingsLayout() {
  const { pathname } = useLocation()
  const current = settingsNav.find((item) => item.to === pathname)
  return (
    <div className="app-page">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-muted"><Link to="/app" className="hover:text-brand-700">Workspace</Link><span aria-hidden="true">/</span><span>Settings</span>{current && <><span aria-hidden="true">/</span><span aria-current="page">{current.label}</span></>}</nav>
      <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Settings" className="min-w-0 lg:sticky lg:top-24">
          <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-6 lg:overflow-visible lg:px-0">
            {groups.map((group) => (
              <div key={group} className="contents lg:block">
                <p className="hidden px-3 pb-2 text-xs font-medium text-muted lg:block">{group}</p>
                <ul className="contents lg:block lg:space-y-1">
                  {settingsNav
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <li key={item.key} className="shrink-0">
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            cn(
                              'flex min-h-10 items-center justify-between gap-2 rounded-control px-3 py-2 text-sm whitespace-nowrap',
                              isActive ? 'bg-surface font-medium text-ink shadow-card ring-1 ring-line' : 'text-muted hover:bg-zinc-100 hover:text-ink',
                            )
                          }
                        >
                          {item.label}
                          {!item.ready && <span className="text-xs font-medium text-muted">Soon</span>}
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
