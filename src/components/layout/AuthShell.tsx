import type { ReactNode } from 'react'
import { Check, Star } from 'lucide-react'
import { testimonials } from '../../services/content'
import { Avatar } from '../ui/Badge'
import { Container } from '../ui/Section'

const highlights = ['Free for up to 2 users', 'Import from Excel in minutes', 'WhatsApp, email and calls in one place', 'Data hosted securely in India']

/** Two-column frame for login and sign-up: form on the left, reassurance on the right. */
export function AuthShell({ children, quoteIndex = 0 }: { children: ReactNode; quoteIndex?: number }) {
  const t = testimonials[quoteIndex % testimonials.length]
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-dialog bg-surface shadow-card ring-1 ring-zinc-200 lg:grid-cols-[1fr_0.9fr]">
        <div className="p-6 sm:p-10">{children}</div>
        <aside className="relative hidden overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px]"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="text-sm font-medium text-sidebar-muted">Why teams choose TechSync</p>
            <ul className="mt-6 space-y-4">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 text-zinc-200">
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/10">
                    <Check className="size-4 text-brand-300" aria-hidden="true" />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <figure className="relative mt-12 rounded-dialog bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex gap-1" aria-label="Rated 5 out of 5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="size-4 fill-amber-300 text-amber-300" aria-hidden="true" />
              ))}
            </div>
            <blockquote className="mt-4 leading-relaxed text-sidebar-ink">“{t.quote}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <Avatar name={t.name} size="sm" />
              <span className="text-sm">
                <span className="block font-medium text-white">{t.name}</span>
                <span className="text-zinc-400">
                  {t.role}, {t.company}
                </span>
              </span>
            </figcaption>
          </figure>
        </aside>
      </div>
    </Container>
  )
}

export function SocialAuthButtons({ onSelect, onGoogle, googleBusy = false, label }: { onSelect: (provider: string) => void; onGoogle?: () => void; googleBusy?: boolean; label: 'Continue' | 'Sign up' }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onGoogle ?? (() => onSelect('Google'))}
        disabled={googleBusy}
        aria-busy={googleBusy || undefined}
        className="inline-flex h-11 items-center justify-center gap-3 rounded-lg bg-white text-sm font-medium text-zinc-800 shadow-card ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="var(--color-google-blue)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="var(--color-google-green)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="var(--color-google-yellow)" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
          <path fill="var(--color-google-red)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.9 10.9 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        <span>
          <span className="sr-only">{label} with </span>{googleBusy ? 'Connecting…' : 'Google'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onSelect('Microsoft')}
        className="inline-flex h-11 items-center justify-center gap-3 rounded-lg bg-white text-sm font-medium text-zinc-800 shadow-card ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="var(--color-microsoft-red)" d="M1 1h10.5v10.5H1z" />
          <path fill="var(--color-microsoft-green)" d="M12.5 1H23v10.5H12.5z" />
          <path fill="var(--color-microsoft-blue)" d="M1 12.5h10.5V23H1z" />
          <path fill="var(--color-microsoft-yellow)" d="M12.5 12.5H23V23H12.5z" />
        </svg>
        <span>
          <span className="sr-only">{label} with </span>Microsoft
        </span>
      </button>
    </div>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="relative my-7 flex items-center gap-4 text-xs text-zinc-500">
      <span className="h-px flex-1 bg-zinc-200" />
      {children}
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  )
}
