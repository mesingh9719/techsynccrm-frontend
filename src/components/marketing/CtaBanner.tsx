import { ArrowRight, Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { Container, Reveal } from '../ui/Section'

interface CtaBannerProps {
  title?: string
  description?: string
}

export function CtaBanner({
  title = 'Ready to stop losing leads?',
  description = 'Start free in minutes. Bring your spreadsheets — we’ll help you import them.',
}: CtaBannerProps) {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="cta-title">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_right,black,transparent_70%)]"
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {title}
                </h2>
                <p className="mt-4 max-w-xl text-lg text-zinc-400">{description}</p>
                <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-300">
                  {['Free plan for 2 users', '14-day trial of paid plans', 'No credit card required'].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="size-4 text-brand-300" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Button to="/signup" size="lg">
                  Start free trial
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <Button to="/demo" size="lg" variant="secondary" className="bg-white/5 text-white ring-white/15 hover:bg-white/10 hover:ring-white/25">
                  Book a demo
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
