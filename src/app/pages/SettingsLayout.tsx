import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { settingsGroups, settingsNav, type SettingsNavItem } from '../navigation'

function NavItem({ item, showDescription }: { item: SettingsNavItem; showDescription?: boolean }) {
  return (
    <NavLink to={item.to} className={({ isActive }) => cn('settings-link', isActive && 'is-active')} title={item.description}>
      <span className="settings-link-icon" aria-hidden="true">
        <item.icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {showDescription && <span className="block truncate text-xs font-normal text-muted">{item.description}</span>}
      </span>
      {!item.ready && <span className="settings-soon">Soon</span>}
    </NavLink>
  )
}

/**
 * Settings shell: a grouped, searchable sub-navigation on the left (a native “jump to” picker on
 * phones and tablets), the page on the right at a readable width.
 */
export default function SettingsLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  // Picking a search result navigates; start the next visit with the full list again.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setQuery('')
  }
  const current = settingsNav.find((item) => pathname.startsWith(item.to))
  const term = query.trim().toLowerCase()
  const matches = term
    ? settingsNav.filter((item) => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(term))
    : []

  return (
    <div className="settings-shell app-page max-w-wide">
      <aside className="settings-nav" aria-label="Settings">
        <p className="settings-eyebrow">Settings</p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) navigate(matches[0].to)
              if (e.key === 'Escape') setQuery('')
            }}
            placeholder="Find a setting"
            aria-label="Find a setting"
            className="settings-search"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="compact-control absolute top-1/2 right-1 -translate-y-1/2 rounded-control p-1.5 text-muted hover:text-ink" aria-label="Clear search">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="mt-4" aria-label="Settings sections">
          {term ? (
            matches.length ? (
              <ul className="space-y-0.5">
                {matches.map((item) => (
                  <li key={item.key}>
                    <NavItem item={item} showDescription />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-3 text-sm text-muted">No settings match “{query.trim()}”.</p>
            )
          ) : (
            settingsGroups.map((group) => (
              <div key={group} className="settings-group">
                <p className="settings-group-label">{group}</p>
                <ul className="space-y-0.5">
                  {settingsNav
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <li key={item.key}>
                        <NavItem item={item} />
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </nav>
      </aside>

      <div className="settings-content">
        {/* Phones and tablets: one native picker instead of a sideways-scrolling strip of 16 links. */}
        <label className="settings-jump">
          <span className="settings-link-icon" aria-hidden="true">
            {current ? <current.icon className="size-4" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">Settings{current ? ` · ${current.group}` : ''}</span>
            <span className="block truncate font-medium text-ink">{current?.label ?? 'Choose a section'}</span>
          </span>
          <ChevronDown className="size-4 text-muted" aria-hidden="true" />
          <select
            aria-label="Go to settings section"
            value={current?.to ?? ''}
            onChange={(e) => navigate(e.target.value)}
            className="compact-control absolute inset-0 cursor-pointer opacity-0"
          >
            {settingsGroups.map((group) => (
              <optgroup key={group} label={group}>
                {settingsNav
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <option key={item.key} value={item.to}>
                      {item.label}
                      {item.ready ? '' : ' (soon)'}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Outlet />
      </div>
    </div>
  )
}
