import { useMatches } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { useSeo } from '../../lib/useSeo'
import { EmptyState, PageHeader } from '../../components/app/States'
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
    <div className="app-page space-y-6">
      <PageHeader title={title} description={handle.description ?? 'This workspace feature is coming soon.'} />
      <EmptyState icon={Construction} title={`${title} is coming soon`} description="Continue managing your leads, pipeline, and follow-ups while this feature is being prepared." action={<Button to="/app" variant="secondary">Back to dashboard</Button>} />
    </div>
  )
}
