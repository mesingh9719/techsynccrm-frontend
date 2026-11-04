import { Navigate, useLocation } from 'react-router-dom'

/** Redirects a retired URL, keeping its query string (e.g. OAuth `?google=connected`) and an optional section hash. */
export function KeepQueryRedirect({ to, hash }: { to: string; hash?: string }) {
  const { search, hash: current } = useLocation()
  return <Navigate to={{ pathname: to, search, hash: current || hash }} replace />
}
