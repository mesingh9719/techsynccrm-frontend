import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { useSeo } from '../lib/useSeo'
import { Button } from '../components/ui/Button'
import { Container } from '../components/ui/Section'

const suggestions = [
  { label: 'Features', to: '/features', text: 'Everything TechSync can do' },
  { label: 'Pricing', to: '/pricing', text: 'Plans from free to enterprise' },
  { label: 'Help Center', to: '/help', text: 'Guides and answers' },
  { label: 'Blog', to: '/blog', text: 'Playbooks for sales teams' },
]

export default function NotFound() {
  useSeo({ title: 'Page not found', noindex: true })
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    const match = suggestions.find((s) => s.label.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
    navigate(match ? match.to : '/help')
  }

  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-sm font-medium text-brand-700">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">This page has gone cold</h1>
        <p className="mt-4 text-lg text-zinc-600">
          We couldn’t find <code className="rounded-control bg-zinc-100 px-2 py-1 font-mono text-sm text-zinc-800">{pathname}</code>. It may have moved, or the link
          might be mistyped — unlike your leads, we can follow this one up.
        </p>

        <form onSubmit={onSearch} className="mx-auto mt-8 flex max-w-md gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What were you looking for?"
              aria-label="Search the site"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white pr-3 pl-9 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="dark" className="h-11">
            Search
          </Button>
        </form>

        <ul className="mt-12 grid gap-3 text-left sm:grid-cols-2">
          {suggestions.map((s) => (
            <li key={s.to}>
              <Link to={s.to} className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-card ring-1 ring-zinc-200 transition-shadow hover:shadow-float">
                <span>
                  <span className="block font-medium text-zinc-900">{s.label}</span>
                  <span className="block text-sm text-zinc-500">{s.text}</span>
                </span>
                <ArrowRight className="size-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <Button to="/" variant="link" className="mt-10">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to homepage
        </Button>
      </div>
    </Container>
  )
}
