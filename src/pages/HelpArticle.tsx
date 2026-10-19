import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, ThumbsDown, ThumbsUp } from 'lucide-react'
import { getHelpArticle, help } from '../services/help'
import { useSeo } from '../lib/useSeo'
import { formatDate } from '../lib/format'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Form'
import { ContentBlocks } from '../components/ui/ContentBlocks'
import { Container } from '../components/ui/Section'
import { useToast } from '../components/ui/Toast'
import NotFound from './NotFound'

function Feedback({ slug }: { slug: string }) {
  const notify = useToast()
  const [vote, setVote] = useState<'yes' | 'no' | null>(null)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return <p className="text-sm text-zinc-700" role="status">Thanks for your feedback — it helps us improve this article.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-zinc-900" id={`feedback-${slug}`}>
          Was this article helpful?
        </p>
        <div className="flex gap-2" role="group" aria-labelledby={`feedback-${slug}`}>
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vote === v}
              onClick={() => {
                setVote(v)
                if (v === 'yes') {
                  setDone(true)
                  notify({ title: 'Thanks for letting us know!' })
                }
              }}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition-colors',
                vote === v ? 'bg-zinc-900 text-white ring-zinc-900' : 'text-zinc-700 ring-zinc-200 hover:bg-zinc-50',
              )}
            >
              {v === 'yes' ? <ThumbsUp className="size-4" aria-hidden="true" /> : <ThumbsDown className="size-4" aria-hidden="true" />}
              {v === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>
      {vote === 'no' && (
        <form
          className="mt-4 max-w-lg"
          onSubmit={(e) => {
            e.preventDefault()
            setDone(true)
            notify({ title: 'Feedback sent', description: 'Our docs team reviews every response.' })
          }}
        >
          <label htmlFor="feedback-comment" className="text-sm text-zinc-700">
            What was missing or unclear? <span className="text-zinc-500">(optional)</span>
          </label>
          <Textarea id="feedback-comment" rows={3} className="mt-1.5 min-h-24" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          <Button type="submit" size="sm" variant="dark" className="mt-3">
            Send feedback
          </Button>
        </form>
      )}
    </div>
  )
}

export default function HelpArticle() {
  const { slug = '' } = useParams()
  const article = getHelpArticle(slug)
  useSeo({ title: article ? `${article.title} · Help Center` : 'Article not found', description: article?.summary, type: 'article', noindex: !article })

  if (!article) return <NotFound />

  const category = help.categories.find((c) => c.id === article.category)
  const siblings = help.articles.filter((a) => a.category === article.category)

  return (
    <Container className="py-10 sm:py-14">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
          <li>
            <Link to="/help" className="hover:text-zinc-900">
              Help Center
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>{category?.title}</li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="truncate text-zinc-900">
            {article.title}
          </li>
        </ol>
      </nav>

      <div className="mt-10 grid gap-12 lg:grid-cols-[240px_1fr]">
        <aside className="order-2 lg:order-1">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-medium text-zinc-900">{category?.title}</p>
            <ul className="mt-3 space-y-1 border-l border-zinc-200">
              {siblings.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/help/${a.slug}`}
                    aria-current={a.slug === article.slug ? 'page' : undefined}
                    className={cn(
                      '-ml-px block border-l py-1 pl-3 text-sm transition-colors',
                      a.slug === article.slug ? 'border-brand-600 font-medium text-zinc-950' : 'border-transparent text-zinc-600 hover:border-zinc-400 hover:text-zinc-900',
                    )}
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/help" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
              ← All categories
            </Link>
          </div>
        </aside>

        <article className="order-1 max-w-3xl min-w-0 lg:order-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{article.title}</h1>
          <p className="mt-3 text-lg text-zinc-600">{article.summary}</p>
          <p className="mt-4 text-sm text-zinc-500">
            Updated <time dateTime={article.updated}>{formatDate(article.updated)}</time>
          </p>
          <div className="prose-body mt-10 border-t border-zinc-100 pt-10">
            <ContentBlocks blocks={article.body} />
          </div>
          <div className="mt-14 space-y-8 border-t border-zinc-100 pt-8">
            <Feedback key={article.slug} slug={article.slug} />
            <div className="rounded-2xl bg-canvas p-6 ring-1 ring-zinc-200">
              <p className="font-medium text-zinc-900">Still stuck?</p>
              <p className="mt-1 text-sm text-zinc-600">Our support team usually replies within 2 hours on working days.</p>
              <Button to="/contact?topic=support" variant="secondary" size="sm" className="mt-4">
                Contact support
              </Button>
            </div>
          </div>
        </article>
      </div>
    </Container>
  )
}
