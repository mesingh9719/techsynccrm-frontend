import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Bell,
  ChartColumn,
  Contact,
  Inbox,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  SquareKanban,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { LogoMark } from '../ui/Brand'
import { Avatar } from '../ui/Badge'
import { DemoAnalyticsView, DemoLeadsTable, DemoPipelineBoard } from './demo'

type View = 'pipeline' | 'leads' | 'analytics'

const views: { id: View; label: string; icon: LucideIcon; title: string; hint: string }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: SquareKanban, title: 'Deals · New business', hint: 'Drag a deal to a new stage' },
  { id: 'leads', label: 'Leads', icon: UserPlus, title: 'Leads · All sources', hint: 'Search or filter the list' },
  { id: 'analytics', label: 'Analytics', icon: ChartColumn, title: 'Reports · Owner dashboard', hint: 'Hover the chart for detail' },
]

const sidebar: { label: string; icon: LucideIcon; view?: View }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Leads', icon: UserPlus, view: 'leads' },
  { label: 'Deals', icon: SquareKanban, view: 'pipeline' },
  { label: 'Contacts', icon: Contact },
  { label: 'Inbox', icon: Inbox },
  { label: 'Reports', icon: ChartColumn, view: 'analytics' },
]

/** Browser-style frame around an app screen. */
export function AppWindow({ children, url = 'app.techsynccrm.com', className }: { children: ReactNode; url?: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-white shadow-frame', className)}>
      <div className="flex h-10 items-center gap-3 border-b border-zinc-200/80 bg-zinc-50/80 px-4">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-zinc-300" />
          <span className="size-2.5 rounded-full bg-zinc-300" />
          <span className="size-2.5 rounded-full bg-zinc-300" />
        </div>
        <div className="mx-auto flex h-6 w-full max-w-xs items-center justify-center rounded-md bg-white px-3 font-mono text-[11px] text-zinc-500 ring-1 ring-zinc-200">
          {url}
        </div>
        <div className="w-12" aria-hidden="true" />
      </div>
      {children}
    </div>
  )
}

export function ProductShowcase({ className }: { className?: string }) {
  const [view, setView] = useState<View>('pipeline')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const baseId = useId()
  const current = views.find((v) => v.id === view)!

  function onTabKey(e: KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    if (!(e.key in keys)) return
    e.preventDefault()
    const next = (index + keys[e.key] + views.length) % views.length
    setView(views[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className={className}>
      <div className="mb-5 flex justify-center">
        <div role="tablist" aria-label="Product preview" className="inline-flex rounded-xl bg-white p-1 shadow-card ring-1 ring-zinc-200">
          {views.map((v, i) => {
            const active = v.id === view
            return (
              <button
                key={v.id}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                id={`${baseId}-tab-${v.id}`}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`${baseId}-panel`}
                tabIndex={active ? 0 : -1}
                onClick={() => setView(v.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors sm:px-4',
                  active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                )}
              >
                <v.icon className="size-4" aria-hidden="true" />
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      <AppWindow>
        <div className="flex">
          <aside className="hidden w-48 shrink-0 border-r border-zinc-200/80 bg-zinc-50/60 p-3 md:block" aria-hidden="true">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <LogoMark className="size-6" />
              <span className="truncate text-[13px] font-semibold text-zinc-900">Kaveri Foods</span>
            </div>
            <nav className="mt-4 space-y-0.5">
              {sidebar.map((item) => {
                const active = item.view === view
                return (
                  <button
                    key={item.label}
                    type="button"
                    tabIndex={-1}
                    disabled={!item.view}
                    onClick={() => item.view && setView(item.view)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors disabled:cursor-default',
                      active ? 'bg-white font-medium text-zinc-900 shadow-card ring-1 ring-zinc-200/80' : 'text-zinc-600 enabled:hover:bg-zinc-100',
                    )}
                  >
                    <item.icon className={cn('size-4', active ? 'text-brand-600' : 'text-zinc-400')} />
                    {item.label}
                  </button>
                )
              })}
            </nav>
            <div className="mt-6 border-t border-zinc-200/80 pt-3">
              <div className="flex items-center gap-2.5 px-2 py-1.5 text-[13px] text-zinc-600">
                <Settings className="size-4 text-zinc-400" />
                Settings
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex h-12 items-center justify-between gap-3 border-b border-zinc-200/80 px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{current.title}</p>
              </div>
              <div className="flex items-center gap-2" aria-hidden="true">
                <div className="hidden h-7 w-44 items-center gap-2 rounded-md bg-zinc-100 px-2.5 text-xs text-zinc-400 lg:flex">
                  <Search className="size-3.5" />
                  Search
                  <kbd className="ml-auto font-mono text-[10px]">⌘K</kbd>
                </div>
                <span className="hidden size-7 items-center justify-center rounded-md text-zinc-500 sm:flex">
                  <Bell className="size-4" />
                </span>
                <span className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-600 px-2.5 text-xs font-medium text-white">
                  <Plus className="size-3.5" />
                  New
                </span>
                <Avatar name="Neha Verma" size="xs" className="size-7" />
              </div>
            </div>
            <div
              id={`${baseId}-panel`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${view}`}
              className="h-[440px] overflow-y-auto bg-zinc-50/40 p-3 sm:h-[460px] sm:p-4"
            >
              <div key={view} className="h-full animate-fade-in">
                {view === 'pipeline' && <DemoPipelineBoard className="h-full" />}
                {view === 'leads' && <DemoLeadsTable />}
                {view === 'analytics' && <DemoAnalyticsView />}
              </div>
            </div>
          </div>
        </div>
      </AppWindow>
      <p className="mt-4 text-center font-mono text-xs text-zinc-500">
        Interactive preview · {current.hint}
      </p>
    </div>
  )
}
