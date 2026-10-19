import type { Ref } from 'react'

/**
 * Hidden "website" field for bot detection (see lib/useSpamGuard.ts). Off-screen and hidden from
 * assistive tech; only bots that fill every input will find it.
 */
export function Honeypot({ ref }: { ref: Ref<HTMLInputElement> }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Website
        <input ref={ref} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}
