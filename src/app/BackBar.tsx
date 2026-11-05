import { useState } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'
import { mainNav, settingsNav, settingsNavItem } from './navigation'

interface Parent {
  to: string
  label: string
}

const HOME: Parent = { to: '/app', label: mainNav.find((item) => item.key === 'home')?.label ?? 'Dashboard' }
const SETTINGS: Parent = { to: settingsNavItem.to, label: settingsNavItem.label }
const navLabel = (to: string, fallback: string) => mainNav.find((item) => item.to === to)?.label ?? fallback

/** Nested pages whose parent isn't simply "the path one level up". */
const nestedParents: { pattern: string; parent: Parent }[] = [
  { pattern: '/app/settings/forms/:id', parent: { to: '/app/settings/forms', label: 'Web forms' } },
  { pattern: '/app/import', parent: { to: '/app/settings/data', label: 'Import & export' } },
  { pattern: '/app/leads/:id', parent: { to: '/app/leads', label: navLabel('/app/leads', 'Leads') } },
  { pattern: '/app/deals/:id', parent: { to: '/app/deals', label: navLabel('/app/deals', 'Pipeline') } },
  { pattern: '/app/campaigns/:id', parent: { to: '/app/campaigns', label: 'Campaigns' } },
  { pattern: '/app/contacts/:id', parent: { to: '/app/contacts', label: 'Contacts' } },
  { pattern: '/app/companies/:id', parent: { to: '/app/companies', label: 'Companies' } },
]

/** Where "back" goes from a page: nested page → its list, settings page → Settings, module → Dashboard. */
function parentOf(pathname: string): Parent | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/app') return null
  for (const { pattern, parent } of nestedParents) if (matchPath(pattern, path)) return parent
  if (path.startsWith(`${SETTINGS.to}/`)) return SETTINGS
  const segments = path.split('/').filter(Boolean)
  if (segments.length <= 2) return HOME
  // Unknown deeper page: one level up, named after the nav or settings item there if there is one.
  const up = `/${segments.slice(0, -1).join('/')}`
  const label = mainNav.find((item) => item.to === up)?.label ?? settingsNav.find((item) => item.to === up)?.label ?? 'Back'
  return { to: up, label }
}

/**
 * Breadcrumb above nested pages (a record under its list, a settings page under Settings). Top-level
 * modules get none — the sidebar already says where you are. When the previous page was the parent it
 * uses browser history instead, so list filters and scroll survive.
 */
export function BackBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [trail, setTrail] = useState({ current: pathname, previous: null as string | null })
  if (trail.current !== pathname) setTrail({ current: pathname, previous: trail.current })

  const parent = parentOf(pathname)
  if (!parent || parent === HOME) return null
  const wide = pathname.startsWith(SETTINGS.to)
  // On desktop a settings page's sidebar header already links back to Settings; skip the duplicate.
  const inSettingsRail = parent === SETTINGS

  return (
    <nav aria-label="Breadcrumb" className={cn('mx-auto -mb-4 w-full px-4 pt-4 sm:px-6 lg:px-8', wide ? 'max-w-wide' : 'max-w-app', inSettingsRail && 'lg:hidden')}>
      <ol className="crumbs">
        <li>
          <a
            href={parent.to}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0
              if (canGoBack && trail.previous === parent.to) navigate(-1)
              else navigate(parent.to)
            }}
          >
            {parent.label}
          </a>
        </li>
        <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
      </ol>
    </nav>
  )
}
