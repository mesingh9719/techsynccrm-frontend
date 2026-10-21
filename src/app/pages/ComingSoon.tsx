import { useMatches } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { useSeo } from '../../lib/useSeo'
import { Button } from '../../components/ui/Button'

export interface RouteHandle {
  title?: string
  description?: string
  /** Roadmap module that builds this page, e.g. "M08". */
  module?: string
}

/** Placeholder for app sections that aren't built yet. Title/description come from the route's `handle`. */
export default function ComingSoon() {
  const matches = useMatches()
  const handle = ([...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)?.handle ?? {}) as RouteHandle
  const title = handle.title ?? 'Coming soon'
  useSeo({ title, noindex: true })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <span className="flex size-12 items-center justify-center rounded-card bg-surface shadow-card ring-1 ring-line">
        <Construction className="size-6 text-brand-700" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">{title} is on its way</h1>
      <p className="mt-2 max-w-md text-muted">
        {handle.description ?? 'We’re building this part of TechSync right now. It will appear here as soon as it’s ready.'}
      </p>
      {import.meta.env.DEV && handle.module && <p className="mt-3 font-mono text-xs text-muted">Roadmap module {handle.module}</p>}
      <Button to="/app" variant="secondary" className="mt-8">
        Back to home
      </Button>
    </div>
  )
}
