import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { navigation, site } from '../../services/site'
import { Logo, SocialIcon } from '../ui/Brand'
import { Container } from '../ui/Section'

const NewsletterForm = lazy(() => import('./NewsletterForm'))

const YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-canvas" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <Container className="pt-16 pb-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-600">
              The simple, affordable CRM for growing small and mid-sized businesses. Made in Bengaluru.
            </p>
            <div className="mt-8">
              <p className="text-sm font-medium text-zinc-900">The SME sales letter</p>
              <p className="mt-1 mb-3 text-sm text-zinc-600">One practical sales idea, twice a month. No spam.</p>
              <Suspense fallback={<div className="h-10 max-w-sm rounded-lg bg-zinc-100" aria-hidden="true" />}>
                <NewsletterForm />
              </Suspense>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {navigation.footer.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-medium text-zinc-900">{column.title}</h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="text-sm text-zinc-600 transition-colors hover:text-zinc-950">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-6 border-t border-zinc-200 pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-zinc-500">
            © {YEAR} TechSync Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            {site.social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label={`TechSync on ${s.label}`}
              >
                <SocialIcon name={s.icon} />
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  )
}
