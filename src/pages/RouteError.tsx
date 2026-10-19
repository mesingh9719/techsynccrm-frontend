import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { LogoMark } from '../components/ui/Brand'

/** Fallback for errors thrown while rendering or loading a route (e.g. a failed chunk download). */
export function RouteError() {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : null
  if (import.meta.env.DEV) console.error(error)

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-10" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">
          {status === 404 ? 'Page not found' : 'Something went wrong'}
        </h1>
        <p className="mt-3 text-zinc-600">
          {status === 404
            ? 'The page you’re looking for doesn’t exist.'
            : 'An unexpected error occurred while loading this page. Reloading usually fixes it.'}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Reload page
          </button>
          <Link to="/" reloadDocument className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-white">
            Go to homepage
          </Link>
        </div>
      </div>
    </main>
  )
}
