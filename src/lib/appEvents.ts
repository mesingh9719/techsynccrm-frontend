/**
 * A tiny app-wide event channel so code outside React components (the query client's global error
 * handler, services) can ask the UI to show a toast or the upgrade dialog. `GlobalUi` listens.
 */

export type AppEvent =
  | { type: 'toast'; title: string; description?: string; tone?: 'success' | 'error' }
  | { type: 'upgrade'; reason: 'limit' | 'feature'; message?: string; feature?: string; requiredPlan?: string; resource?: string }

type Listener = (event: AppEvent) => void

const listeners = new Set<Listener>()

export function emitAppEvent(event: AppEvent) {
  listeners.forEach((listener) => listener(event))
}

export function onAppEvent(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
