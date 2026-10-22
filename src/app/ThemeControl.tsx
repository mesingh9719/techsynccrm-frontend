import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Menu, MenuLabel } from '../components/app/Menu'
import { cn } from '../lib/cn'
import { resolveTheme, useTheme, type Theme } from '../lib/theme'

const options: { value: Theme; label: string; hint: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', hint: 'Bright surfaces', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night', icon: Moon },
  { value: 'system', label: 'System', hint: 'Match your device', icon: Monitor },
]

/** Top-bar theme dropdown: current mode as the icon, three choices with a check on the active one. */
export function ThemeControl() {
  const { theme, setTheme } = useTheme()
  const Icon = options.find((o) => o.value === theme)!.icon
  return (
    <Menu
      align="end"
      className="w-64"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="icon-button"
          aria-label={`Color theme: ${theme}`}
          title="Color theme"
        >
          <Icon className="size-5" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Appearance</MenuLabel>
          {options.map((option) => {
            const active = option.value === theme
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                tabIndex={-1}
                onClick={() => {
                  setTheme(option.value)
                  close()
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left outline-none hover:bg-zinc-100 focus:bg-zinc-100',
                  active && 'bg-brand-50 hover:bg-brand-50 focus:bg-brand-100',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-control border',
                    active ? 'border-brand-200 bg-surface text-brand-700' : 'border-line bg-surface-subtle text-muted',
                  )}
                >
                  <option.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', active ? 'text-brand-900' : 'text-ink')}>
                    {option.label}
                    {option.value === 'system' && (
                      <span className="ml-1 font-normal text-muted">· {resolveTheme('system')}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">{option.hint}</span>
                </span>
                {active && <Check className="size-4 shrink-0 text-brand-700" aria-hidden="true" />}
              </button>
            )
          })}
        </>
      )}
    </Menu>
  )
}

/** Compact three-way switch, used inside the account menu (the only theme control on phones). */
export function ThemeSegment() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-xs font-medium text-muted">Appearance</p>
      <div className="grid grid-cols-3 gap-1 rounded-control border border-line bg-surface-subtle p-1">
        {options.map((option) => {
          const active = option.value === theme
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              tabIndex={-1}
              onClick={() => setTheme(option.value)}
              className={cn(
                'compact-control flex min-h-9 flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400',
                active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
              )}
            >
              <option.icon className="size-4" aria-hidden="true" />
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
