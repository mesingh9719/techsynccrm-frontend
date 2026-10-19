import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { navigation, site } from '../../services/site'
import { getIcon } from '../../lib/icons'
import { cn } from '../../lib/cn'
import { nextPathFor, useAuth } from '../../lib/useAuth'
import { Logo } from '../ui/Brand'
import { Button } from '../ui/Button'
import { Container } from '../ui/Section'
import type { NavGroup } from '../../types'

const ANNOUNCEMENT_KEY = 'ts-announcement-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(ANNOUNCEMENT_KEY) === site.announcement.to
  } catch {
    return false
  }
}

function AnnouncementBar() {
  const [hidden, setHidden] = useState(readDismissed)
  if (hidden) return null

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(ANNOUNCEMENT_KEY, site.announcement.to)
    } catch {
      /* storage unavailable — dismiss for this visit only */
    }
  }

  return (
    <div className="relative border-b border-zinc-800 bg-zinc-950 text-zinc-200">
      <Container className="flex h-10 items-center justify-center gap-3 pr-12 text-[13px]">
        <span className="hidden rounded-full bg-brand-500/20 px-2 py-0.5 text-[11px] font-medium text-brand-200 ring-1 ring-brand-400/30 sm:inline">
          {site.announcement.label}
        </span>
        <Link to={site.announcement.to} className="group inline-flex items-center gap-1.5 truncate hover:text-white">
          <span className="truncate">{site.announcement.text}</span>
          <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </Container>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
        aria-label="Dismiss announcement"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function DesktopDropdown({ group, open, onOpen, onClose }: { group: NavGroup; open: boolean; onOpen: () => void; onClose: () => void }) {
  const panelId = useId()
  const closeTimer = useRef<number | undefined>(undefined)
  const { pathname } = useLocation()
  const items = group.items ?? []
  const active = items.some((item) => item.to.split('#')[0] === pathname)
  const wide = items.length > 4

  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(onClose, 120)
  }
  const cancelClose = () => window.clearTimeout(closeTimer.current)

  return (
    <div
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          cancelClose()
          onOpen()
        }
      }}
      onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleClose()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-zinc-100 hover:text-zinc-950',
          active || open ? 'text-zinc-950' : 'text-zinc-600',
        )}
      >
        {group.label}
        <ChevronDown className={cn('size-3.5 text-zinc-400 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn('absolute top-full left-1/2 z-50 -translate-x-1/2 pt-2.5', wide ? 'w-[560px]' : 'w-[340px]')}
      >
        <div className="animate-fade-in rounded-2xl bg-white p-2 shadow-float ring-1 ring-zinc-200/80">
          <ul className={cn('grid gap-0.5', wide && 'grid-cols-2')}>
            {items.map((item) => {
              const Icon = getIcon(item.icon)
              return (
                <li key={item.to}>
                  <Link to={item.to} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-zinc-50">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/80 transition-colors group-hover:bg-white group-hover:text-brand-700">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-zinc-900">{item.label}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-zinc-500">{item.description}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { user } = useAuth()

  return (
    <div
      id="mobile-menu"
      hidden={!open}
      className="fixed inset-x-0 top-[var(--header-bottom,64px)] bottom-0 z-40 overflow-y-auto border-t border-zinc-100 bg-white lg:hidden"
    >
      <Container className="flex min-h-full flex-col py-4">
        <nav aria-label="Mobile">
          <ul className="divide-y divide-zinc-100">
            {navigation.main.map((group) =>
              group.items ? (
                <li key={group.label}>
                  <button
                    type="button"
                    aria-expanded={expanded === group.label}
                    onClick={() => setExpanded(expanded === group.label ? null : group.label)}
                    className="flex w-full items-center justify-between py-4 text-base font-medium text-zinc-900"
                  >
                    {group.label}
                    <ChevronDown className={cn('size-4 text-zinc-400 transition-transform', expanded === group.label && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {expanded === group.label && (
                    <ul className="grid gap-1 pb-4">
                      {group.items.map((item) => {
                        const Icon = getIcon(item.icon)
                        return (
                          <li key={item.to}>
                            <Link to={item.to} onClick={onClose} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] text-zinc-700 hover:bg-zinc-50">
                              <Icon className="size-4 text-zinc-400" aria-hidden="true" />
                              {item.label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={group.label}>
                  <Link to={group.to!} onClick={onClose} className="block py-4 text-base font-medium text-zinc-900">
                    {group.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="mt-auto grid gap-3 pt-8 pb-4">
          {user ? (
            <Button to={nextPathFor(user)} variant="primary" size="lg" onClick={onClose}>
              Open app
            </Button>
          ) : (
            <>
              <Button to="/signup" variant="primary" size="lg" onClick={onClose}>
                Start free trial
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button to="/demo" variant="secondary" size="lg" onClick={onClose}>
                  Book a demo
                </Button>
                <Button to="/login" variant="secondary" size="lg" onClick={onClose}>
                  Log in
                </Button>
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)
  const { status, user } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close any open menu after navigation.
  const [lastKey, setLastKey] = useState(location.key)
  if (lastKey !== location.key) {
    setLastKey(location.key)
    setOpenGroup(null)
    setMobileOpen(false)
  }

  useEffect(() => {
    if (!openGroup && !mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenGroup(null)
        setMobileOpen(false)
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (openGroup && headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenGroup(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [openGroup, mobileOpen])

  // Lock page scroll behind the mobile menu and position it under the header.
  useEffect(() => {
    if (!mobileOpen) return
    const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 64
    document.documentElement.style.setProperty('--header-bottom', `${bottom}px`)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      <AnnouncementBar />
      <header
        ref={headerRef}
        className={cn(
          'sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-200',
          scrolled || mobileOpen ? 'border-zinc-200/80 bg-white/85 backdrop-blur-lg backdrop-saturate-150' : 'border-transparent bg-white',
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-6">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
            {navigation.main.map((group) =>
              group.items ? (
                <DesktopDropdown
                  key={group.label}
                  group={group}
                  open={openGroup === group.label}
                  onOpen={() => setOpenGroup(group.label)}
                  onClose={() => setOpenGroup((g) => (g === group.label ? null : g))}
                />
              ) : (
                <NavLink
                  key={group.label}
                  to={group.to!}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors hover:bg-zinc-100 hover:text-zinc-950',
                      isActive ? 'text-zinc-950' : 'text-zinc-600',
                    )
                  }
                >
                  {group.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className={cn('hidden items-center gap-2 transition-opacity lg:flex', status === 'loading' && 'opacity-0')}>
            {user ? (
              <>
                <Button to="/demo" variant="secondary" size="sm" className="h-9">
                  Book a demo
                </Button>
                <Button to={nextPathFor(user)} variant="dark" size="sm" className="h-9">
                  Open app
                </Button>
              </>
            ) : (
              <>
                <Button to="/login" variant="ghost" size="sm" className="h-9 px-3">
                  Log in
                </Button>
                <Button to="/demo" variant="secondary" size="sm" className="h-9">
                  Book a demo
                </Button>
                <Button to="/signup" variant="dark" size="sm" className="h-9">
                  Start free trial
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </Container>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
