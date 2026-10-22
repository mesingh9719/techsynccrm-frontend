import { Component, lazy, Suspense, type ComponentProps } from 'react'
import { Button } from '../ui/Button'
import type DataGrid from './DataGrid'

type GridProps = ComponentProps<typeof DataGrid>

function loadGrid(attempt = 0) {
  return lazy(() => {
    if (import.meta.env.DEV && attempt > 0) {
      // A rejected lazy import is cached by React and may be cached by the browser.
      // Request a fresh dev module so Vite resolves the current optimized deps.
      const url = `${import.meta.env.BASE_URL}src/components/data-grid/DataGrid.tsx?grid-retry=${Date.now()}-${attempt}`
      return import(/* @vite-ignore */ url) as Promise<{ default: typeof DataGrid }>
    }
    return import('./DataGrid')
  })
}

const InitialGrid = loadGrid()

export function GridSkeleton() {
  return <div role="status" aria-label="Loading spreadsheet" className="h-96 animate-pulse space-y-4 rounded-xl border border-line bg-surface-subtle p-5">
    {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-5 rounded-control bg-zinc-200/50" />)}
    <span className="sr-only">Loading spreadsheet…</span>
  </div>
}

interface State { error: Error | null; attempt: number; Grid: ReturnType<typeof loadGrid> }

class GridBoundary extends Component<{ gridProps: GridProps }, State> {
  state: State = { error: null, attempt: 0, Grid: InitialGrid }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error('Spreadsheet preview failed.') }
  }

  retry = () => {
    const attempt = this.state.attempt + 1
    this.setState({ error: null, attempt, Grid: loadGrid(attempt) })
  }

  render() {
    if (this.state.error) return <div role="alert" className="space-y-3 rounded-xl border border-line bg-surface-subtle p-5">
      <p className="text-sm font-semibold text-ink">Couldn’t load the spreadsheet preview</p>
      <p className="text-sm text-muted">Your uploaded file and edits are still here. Retry the preview to continue.</p>
      <Button size="sm" variant="secondary" onClick={this.retry}>Retry preview</Button>
    </div>
    const Grid = this.state.Grid
    return <Suspense fallback={<GridSkeleton />}><Grid {...this.props.gridProps} /></Suspense>
  }
}

/** Keep preview failures inside the card; the wizard owns the upload and edits. */
export default function LazyDataGrid(props: GridProps) {
  return <GridBoundary gridProps={props} />
}
