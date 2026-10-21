import { lazy, Suspense, useEffect, useState } from 'react'
import { onAppEvent } from '../../lib/appEvents'
import { useToast } from '../ui/Toast'
import type { UpgradePrompt } from './UpgradeDialog'

// Loaded on first use: it pulls in the pricing content.
const UpgradeDialog = lazy(() => import('./UpgradeDialog').then((m) => ({ default: m.UpgradeDialog })))

/**
 * Renders UI requested from outside React (lib/appEvents.ts) — toasts and the upgrade dialog raised
 * by the global API error handler. Mounted once, inside the router so dialogs can link to pages.
 */
export function GlobalUi() {
  const notify = useToast()
  const [upgrade, setUpgrade] = useState<UpgradePrompt | null>(null)

  useEffect(
    () =>
      onAppEvent((event) => {
        if (event.type === 'toast') notify({ title: event.title, description: event.description, tone: event.tone })
        if (event.type === 'upgrade') {
          const { type: _type, ...prompt } = event
          setUpgrade(prompt)
        }
      }),
    [notify],
  )

  if (!upgrade) return null
  return (
    <Suspense fallback={null}>
      <UpgradeDialog prompt={upgrade} onClose={() => setUpgrade(null)} />
    </Suspense>
  )
}
