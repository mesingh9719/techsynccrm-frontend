import { useCallback, useEffect, useRef } from 'react'

/** Anti-spam fields every public form sends; see backend/src/lib/spam.js. */
export interface SpamGuardFields {
  website: string
  elapsedMs: number
}

/**
 * Bot protection for public forms: a hidden "website" field that people never fill (render
 * `<Honeypot ref={honeypotRef} />` inside the form), and the time from the form appearing to it
 * being submitted (bots submit instantly). Measured as a duration in the browser so clock
 * differences with the server don't matter. Call `spamFields()` only from the submit handler.
 */
export function useSpamGuard() {
  const shownAt = useRef(0)
  const honeypotRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    shownAt.current = performance.now()
  }, [])

  /** Restart the timer, e.g. when a form is shown again after "Send another message". */
  const restartSpamTimer = useCallback(() => {
    shownAt.current = performance.now()
  }, [])

  const spamFields = useCallback(
    (): SpamGuardFields => ({
      website: honeypotRef.current?.value ?? '',
      elapsedMs: Math.max(0, Math.round(performance.now() - shownAt.current)),
    }),
    [],
  )

  return { honeypotRef, spamFields, restartSpamTimer }
}
