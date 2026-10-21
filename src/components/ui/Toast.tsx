import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, CircleAlert, X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Toast {
  id: number
  title: string
  description?: string
  action?: { label: string; onClick: () => void | Promise<void> }
  tone: 'success' | 'error'
}

type Notify = (toast: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => void

const ToastContext = createContext<Notify | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const layer = useRef<HTMLDivElement>(null)
  const timers = useRef<Set<number>>(new Set())
  useEffect(() => () => { for (const timer of timers.current) window.clearTimeout(timer) }, [])
  useEffect(() => {
    const element = layer.current
    if (!element) return
    const raise = () => {
      if (!toasts.length) { if (element.matches(':popover-open')) element.hidePopover?.(); return }
      if (element.matches(':popover-open')) element.hidePopover?.()
      element.showPopover?.()
    }
    raise()
    window.addEventListener('techsync:overlay-open', raise)
    return () => window.removeEventListener('techsync:overlay-open', raise)
  }, [toasts.length])

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const notify = useCallback<Notify>(
    ({ tone = 'success', ...toast }) => {
      const id = Date.now() + Math.random()
      setToasts((all) => [...all.slice(-2), { id, tone, ...toast }])
      const timer = window.setTimeout(() => { dismiss(id); timers.current.delete(timer) }, toast.action || tone === 'error' ? 10000 : 6000)
      timers.current.add(timer)
    },
    [dismiss],
  )

  const value = useMemo(() => notify, [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={layer}
        popover="manual"
        style={{ margin: 0, padding: 0, border: 0, background: 'transparent', color: 'inherit' }}
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[var(--z-toast)] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl bg-white p-4 shadow-float ring-1 ring-zinc-200"
          >
            {t.tone === 'success' ? (
              <CircleCheck className="mt-1 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-1 size-5 shrink-0 text-red-600" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">{t.title}</p>
              {t.description && <p className={cn('mt-1 text-sm text-zinc-600')}>{t.description}</p>}
              {t.action && <button type="button" className="mt-2 text-sm font-medium text-brand-700" onClick={() => { void t.action?.onClick(); dismiss(t.id) }}>{t.action.label}</button>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="icon-button -m-2"
              aria-label="Dismiss notification"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
