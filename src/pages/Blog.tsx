import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import { blog } from '../services/blog'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { Container, PageHero } from '../components/ui/Section'
import { PostCard } from '../components/marketing/PostCard'
import { CtaBanner } from '../components/marketing/CtaBanner'

const PAGE_SIZE = 6

export default function Blog() {
  useSeo({
    title: 'Blog',
    description: 'Sales playbooks, product updates and growth advice for small and mid-sized businesses, from the TechSync CRM team.',
  })
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? 'All'
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const featured = blog.posts.find((p) => p.featured)
  const showFeatured = Boolean(featured) && category === 'All' && !query

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return blog.posts.filter(
      (p) =>
        (!showFeatured || p !== featured) &&
        (category === 'All' || p.category === category) &&
        (!q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q)),
    )
  }, [category, query, featured, showFeatured])

  const setCategory = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'All') next.delete('category')
    else next.set('category', value)
    setParams(next, { replace: true, preventScrollReset: true })
    setVisible(PAGE_SIZE)
  }

  return (
    <>
      <PageHero
        eyebrow="The TechSync blog"
        title="Practical ideas for growing sales teams"
        description="Playbooks, product news and lessons from thousands of small businesses — written to be useful on Monday morning."
      />

      <Container className="py-14 sm:py-16">
        {showFeatured && featured && (
          <div className="mb-16 border-b border-zinc-100 pb-16">
            <h2 className="sr-only">Featured post</h2>
            <PostCard post={featured} featured />
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filter posts by category">
            {['All', ...blog.categories].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'h-9 shrink-0 rounded-lg px-3.5 text-sm font-medium transition-colors',
                  category === c ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setVisible(PAGE_SIZE)
              }}
              placeholder="Search articles"
              aria-label="Search articles"
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white pr-3 pl-9 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
          </div>
        </div>

        <h2 className="sr-only">All posts</h2>
        <p className="sr-only" aria-live="polite">
          {filtered.length} posts found
        </p>
        {filtered.length > 0 ? (
          <>
            <div className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, visible).map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
            {visible < filtered.length && (
              <div className="mt-14 text-center">
                <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load more articles
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center">
            <SearchX className="mx-auto size-8 text-zinc-400" aria-hidden="true" />
            <p className="mt-4 font-medium text-zinc-900">No articles found</p>
            <p className="mt-1 text-sm text-zinc-600">Try a different search or category.</p>
            <Button
              variant="secondary"
              className="mt-6"
              onClick={() => {
                setQuery('')
                setCategory('All')
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </Container>

      <CtaBanner title="Put these ideas to work" description="TechSync turns playbooks into workflows your whole team follows — automatically." />
    </>
  )
}
