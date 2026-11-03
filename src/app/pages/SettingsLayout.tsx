import { useAuth } from '../../lib/useAuth'
import { hasPermission } from '../../lib/permissions'
import { useSeo } from '../../lib/useSeo'
import { useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGroup, MotionConfig, motion, type Transition } from 'motion/react'
import { ChevronDown, ChevronRight, LayoutGrid, Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { PageHeader } from '../../components/app/States'
import { settingsGroupMeta, settingsNav, type SettingsGroupMeta, type SettingsNavItem } from '../navigation'
import { useSettingsStatus, type SettingsStatus } from './settingsStatus'
import './settings-layout.css'

const ROOT = '/app/settings'
/** Shared-layout id: the clicked card's surface morphs into the sidebar's active pill (and back). */
const MORPH_ID = 'settings-active'
const spring: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }
const ease = [0.22, 1, 0.36, 1] as const

const accentStyle = (group: SettingsGroupMeta) => ({ '--settings-accent': group.accent }) as CSSProperties
const isSettingsPage = (item: SettingsNavItem) => item.to.startsWith(`${ROOT}/`)

function useVisibleNav() {
  const { user } = useAuth()
  return settingsNav.filter((item) => !item.permission || hasPermission(user?.organization?.permissions, item.permission))
}

function matchesTerm(item: SettingsNavItem, term: string) {
  return `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(term)
}

function SearchField({ value, onChange, onSubmit, className }: { value: string; onChange: (v: string) => void; onSubmit: () => void; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
          if (e.key === 'Escape') onChange('')
        }}
        placeholder="Find a setting"
        aria-label="Find a setting"
        className="settings-search"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="compact-control absolute top-1/2 right-1 -translate-y-1/2 rounded-control p-1.5 text-muted hover:text-ink" aria-label="Clear search">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function StatusBadge({ status, soon }: { status?: SettingsStatus; soon?: boolean }) {
  if (soon) return <span className="settings-badge" data-tone="neutral">Soon</span>
  if (!status) return null
  return (
    <span className="settings-badge" data-tone={status.tone}>
      {status.tone === 'success' && <span className="settings-badge-dot" aria-hidden="true" />}
      {status.text}
    </span>
  )
}

/* ── Home: every settings page as a card, grouped by module ─────────────────────────────── */

function SettingsCard({ item, status, morph, index, onOpen }: { item: SettingsNavItem; status?: SettingsStatus; morph: boolean; index: number; onOpen: (item: SettingsNavItem) => void }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease, delay: Math.min(index * 0.03, 0.45) }}
      className="min-w-0"
    >
      <Link
        to={item.to}
        className="settings-tile"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !isSettingsPage(item)) return
          // Tag this card as the morph source before the route (and the sidebar) renders.
          flushSync(() => onOpen(item))
        }}
      >
        <motion.span layoutId={morph ? MORPH_ID : undefined} transition={spring} className="settings-tile-bg" style={{ borderRadius: 12 }} aria-hidden="true" />
        <span className="settings-tile-top">
          <span className="settings-tile-icon" aria-hidden="true">
            <item.icon className="size-5" />
          </span>
          <StatusBadge status={status} soon={!item.ready} />
        </span>
        <span className="settings-tile-title">
          {item.label}
          <ChevronRight className="settings-tile-arrow size-4" aria-hidden="true" />
        </span>
        <span className="settings-tile-description">{item.description}</span>
      </Link>
    </motion.li>
  )
}

function SettingsHome({ nav, morphKey, onOpen }: { nav: SettingsNavItem[]; morphKey: string | null; onOpen: (item: SettingsNavItem) => void }) {
  useSeo({ title: 'Settings', noindex: true })
  const navigate = useNavigate()
  const status = useSettingsStatus()
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const shown = term ? nav.filter((item) => matchesTerm(item, term)) : nav
  let index = 0

  return (
    <div className="settings-home">
      <PageHeader
        title="Settings"
        description="Manage your account, workspace, sales setup and connections."
        className="settings-home-header"
        actions={
          <SearchField
            value={query}
            onChange={setQuery}
            className="settings-home-search"
            onSubmit={() => {
              const first = shown[0]
              if (!first) return
              if (isSettingsPage(first)) flushSync(() => onOpen(first))
              navigate(first.to)
            }}
          />
        }
      />

      {shown.length === 0 && <p className="settings-home-empty">No settings match “{query.trim()}”.</p>}

      {settingsGroupMeta.map((group) => {
        const items = shown.filter((item) => item.group === group.key)
        if (!items.length) return null
        const headingId = `settings-group-${group.key.replace(/\W+/g, '-').toLowerCase()}`
        return (
          <section key={group.key} className="settings-module" style={accentStyle(group)} aria-labelledby={headingId}>
            <div className="settings-module-header">
              <span className="settings-module-icon" aria-hidden="true">
                <group.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 id={headingId} className="settings-module-title">{group.key}</h2>
                <p className="settings-module-description">{group.description}</p>
              </div>
            </div>
            <ul className="settings-tiles">
              {items.map((item) => (
                <SettingsCard key={item.key} item={item} status={status[item.key]} morph={morphKey === item.key} index={index++} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/* ── Sub-page: grouped sidebar + the page ───────────────────────────────────────────────── */

function NavItem({ item, active, showDescription }: { item: SettingsNavItem; active: boolean; showDescription?: boolean }) {
  return (
    <NavLink to={item.to} className={cn('settings-link', active && 'is-active')} aria-current={active ? 'page' : undefined} title={item.description}>
      {active && <motion.span layoutId={MORPH_ID} transition={spring} className="settings-link-pill" style={{ borderRadius: 8 }} aria-hidden="true" />}
      <span className="settings-link-icon" aria-hidden="true">
        <item.icon className="size-4" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {showDescription && <span className="block truncate text-xs font-normal text-muted">{item.description}</span>}
      </span>
      {!item.ready && <span className="settings-soon relative">Soon</span>}
    </NavLink>
  )
}

function SettingsSidebar({ nav, current }: { nav: SettingsNavItem[]; current?: SettingsNavItem }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  // Picking a search result navigates; start the next visit with the full list again.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setQuery('')
  }
  const term = query.trim().toLowerCase()
  const matches = term ? nav.filter((item) => matchesTerm(item, term)) : []
  let index = 0

  return (
    <motion.aside
      className="settings-nav"
      aria-label="Settings"
      // Opacity only: a moving parent would bend the active pill's morph from the clicked card.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease }}
    >
      <Link to={ROOT} className="settings-back">
        <span className="settings-back-icon" aria-hidden="true">
          <LayoutGrid className="size-3.5" />
        </span>
        <span className="flex-1">Settings</span>
        <span className="text-xs font-medium text-muted">All</span>
      </Link>
      <SearchField value={query} onChange={setQuery} className="mt-3" onSubmit={() => matches[0] && navigate(matches[0].to)} />

      <nav className="mt-4" aria-label="Settings sections">
        {term ? (
          matches.length ? (
            <ul className="space-y-0.5">
              {matches.map((item) => (
                <li key={item.key}>
                  <NavItem item={item} active={item === current} showDescription />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-muted">No settings match “{query.trim()}”.</p>
          )
        ) : (
          settingsGroupMeta.map((group) => {
            const items = nav.filter((item) => item.group === group.key)
            if (!items.length) return null
            return (
              <div key={group.key} className="settings-group" style={accentStyle(group)}>
                <p className="settings-group-label">{group.key}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <motion.li
                      key={item.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, ease, delay: 0.05 + Math.min(index++ * 0.018, 0.35) }}
                    >
                      <NavItem item={item} active={item === current} />
                    </motion.li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </nav>
    </motion.aside>
  )
}

function SettingsJump({ nav, current }: { nav: SettingsNavItem[]; current?: SettingsNavItem }) {
  const navigate = useNavigate()
  return (
    <>
      {/* Phones and tablets: one native picker instead of a sideways-scrolling strip of links. */}
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
          {!current && <option value="">Choose a section</option>}
          {settingsGroupMeta.map((group) => (
            <optgroup key={group.key} label={group.key}>
              {nav
                .filter((item) => item.group === group.key)
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
    </>
  )
}

/**
 * Settings shell. At /app/settings: a module-by-module grid of cards. On a sub-page: a grouped,
 * searchable sidebar (a native “jump to” picker on phones and tablets) beside the page. The clicked
 * card morphs into the sidebar's active item, and back when returning to the grid.
 */
export default function SettingsLayout() {
  const { pathname } = useLocation()
  const nav = useVisibleNav()
  const isHome = pathname.replace(/\/+$/, '') === ROOT
  const current = nav.find((item) => isSettingsPage(item) && (pathname === item.to || pathname.startsWith(`${item.to}/`)))
  // The card that morphs: the one just clicked, or (back on the grid) the page we came from.
  const [morphKey, setMorphKey] = useState<string | null>(null)
  if (!isHome && current && morphKey !== current.key) setMorphKey(current.key)

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="settings">
        {isHome ? (
          <div className="app-page max-w-wide">
            <SettingsHome nav={nav} morphKey={morphKey} onOpen={(item) => setMorphKey(item.key)} />
          </div>
        ) : (
          <div className="settings-shell app-page max-w-wide">
            <SettingsSidebar nav={nav} current={current} />
            <div className="settings-content">
              <SettingsJump nav={nav} current={current} />
              <motion.div
                key={pathname}
                className="settings-page"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease, delay: 0.04 }}
              >
                <Outlet />
              </motion.div>
            </div>
          </div>
        )}
      </LayoutGroup>
    </MotionConfig>
  )
}
