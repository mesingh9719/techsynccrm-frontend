import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useReveal } from '../../lib/useReveal'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

interface SectionProps {
  id?: string
  className?: string
  tone?: 'white' | 'muted'
  children: ReactNode
  'aria-labelledby'?: string
}

export function Section({ id, className, tone = 'white', children, ...rest }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={rest['aria-labelledby']}
      className={cn('py-20 sm:py-28', tone === 'muted' && 'border-y border-zinc-100 bg-canvas', className)}
    >
      <Container>{children}</Container>
    </section>
  )
}

interface SectionHeaderProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  id?: string
  className?: string
  as?: 'h1' | 'h2'
}

export function SectionHeader({ eyebrow, title, description, align = 'center', id, className, as: Heading = 'h2' }: SectionHeaderProps) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading id={id} className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl sm:leading-[1.15]">
        {title}
      </Heading>
      {description && <p className="mt-4 text-lg leading-relaxed text-zinc-600">{description}</p>}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-xs font-medium tracking-widest text-brand-700 uppercase', className)}>{children}</p>
  )
}

/** Fades children in on first scroll into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li'
}) {
  const ref = useReveal<HTMLDivElement & HTMLLIElement>()
  return (
    <Tag ref={ref} className={className} style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </Tag>
  )
}

/** Hero block shared by inner pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('relative overflow-hidden border-b border-zinc-100', className)}>
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" aria-hidden="true" />
      <Container className="relative pt-16 pb-16 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && <Eyebrow className="animate-fade-up">{eyebrow}</Eyebrow>}
          <h1 className="mt-4 animate-fade-up text-4xl font-semibold tracking-tight text-zinc-950 [animation-delay:60ms] sm:text-5xl sm:leading-[1.08]">
            {title}
          </h1>
          {description && (
            <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-lg leading-relaxed text-zinc-600 [animation-delay:120ms]">
              {description}
            </p>
          )}
          {children && <div className="mt-8 animate-fade-up [animation-delay:180ms]">{children}</div>}
        </div>
      </Container>
    </section>
  )
}
