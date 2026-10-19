import { Link } from 'react-router-dom'
import type { LegalDocument } from '../../types'
import { formatDate } from '../../lib/format'
import { useScrollSpy } from '../../lib/useScrollSpy'
import { cn } from '../../lib/cn'
import { ContentBlocks } from '../ui/ContentBlocks'
import { Container } from '../ui/Section'

export function LegalPage({ doc, sibling }: { doc: LegalDocument; sibling: { label: string; to: string } }) {
  const active = useScrollSpy(doc.sections.map((s) => s.id))

  return (
    <>
      <header className="border-b border-zinc-100 bg-canvas">
        <Container className="py-14 sm:py-20">
          <p className="font-mono text-xs font-medium tracking-[0.08em] text-brand-700 uppercase">Legal</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">{doc.title}</h1>
          <p className="mt-4 text-sm text-zinc-500">
            Last updated <time dateTime={doc.updated}>{formatDate(doc.updated)}</time>
          </p>
        </Container>
      </header>
      <Container className="py-14 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr] lg:gap-16">
          <aside>
            <nav aria-label="Contents" className="lg:sticky lg:top-24">
              <p className="text-sm font-medium text-zinc-900">Contents</p>
              <ol className="mt-3 space-y-1 border-l border-zinc-200">
                {doc.sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={active === s.id ? 'true' : undefined}
                      className={cn(
                        '-ml-px block border-l py-1 pl-3 text-sm transition-colors',
                        active === s.id ? 'border-brand-600 font-medium text-zinc-950' : 'border-transparent text-zinc-600 hover:text-zinc-900',
                      )}
                    >
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
              <Link to={sibling.to} className="mt-8 inline-block text-sm font-medium text-brand-700 hover:underline">
                {sibling.label} →
              </Link>
            </nav>
          </aside>
          <div className="max-w-3xl min-w-0">
            <p className="text-lg leading-relaxed text-zinc-700">{doc.intro}</p>
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="prose-body pt-12">
                <h2 id={`${s.id}-title`} className="mt-0!">
                  {i + 1}. {s.title}
                </h2>
                <ContentBlocks blocks={s.body} />
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  )
}
