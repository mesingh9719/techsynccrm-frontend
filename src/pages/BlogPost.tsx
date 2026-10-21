import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Link2 } from 'lucide-react'
import { blog, getPost } from '../services/blog'
import { site } from '../services/site'
import { useSeo } from '../lib/useSeo'
import { slugify } from '../lib/format'
import { Avatar } from '../components/ui/Badge'
import { PostCover, SocialIcon } from '../components/ui/Brand'
import { ContentBlocks } from '../components/ui/ContentBlocks'
import { Container } from '../components/ui/Section'
import { useToast } from '../components/ui/Toast'
import { PostCard, PostMeta } from '../components/marketing/PostCard'
import { CtaBanner } from '../components/marketing/CtaBanner'
import NotFound from './NotFound'

export default function BlogPost() {
  const { slug = '' } = useParams()
  const post = getPost(slug)
  const notify = useToast()
  useSeo({ title: post?.title ?? 'Article not found', description: post?.excerpt, type: 'article', noindex: !post })

  if (!post) return <NotFound />

  const url = `${site.url}/blog/${post.slug}`
  const headings = post.body.flatMap((b) => (b.type === 'h2' ? [b.text] : []))
  const related = blog.posts.filter((p) => p.slug !== post.slug && p.category === post.category).concat(blog.posts.filter((p) => p.slug !== post.slug && p.category !== post.category)).slice(0, 3)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      notify({ title: 'Link copied', description: 'The article link is on your clipboard.' })
    } catch {
      notify({ title: 'Couldn’t copy link', description: url, tone: 'error' })
    }
  }

  return (
    <>
      <article>
        <header className="border-b border-zinc-100">
          <Container className="pt-10 pb-12 sm:pt-14">
            <nav aria-label="Breadcrumb">
              <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950">
                <ArrowLeft className="size-4" aria-hidden="true" />
                All articles
              </Link>
            </nav>
            <div className="mx-auto mt-10 max-w-3xl text-center">
              <Link to={`/blog?category=${encodeURIComponent(post.category)}`} className="font-mono text-xs font-medium tracking-wider text-brand-700 uppercase hover:underline">
                {post.category}
              </Link>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl sm:leading-[1.1]">{post.title}</h1>
              <p className="mt-5 text-lg leading-relaxed text-zinc-600">{post.excerpt}</p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Avatar name={post.author.name} />
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-900">
                    {post.author.name} <span className="font-normal text-zinc-500">· {post.author.role}</span>
                  </p>
                  <PostMeta post={post} />
                </div>
              </div>
            </div>
            <div className="mx-auto mt-12 aspect-[21/9] max-w-5xl overflow-hidden rounded-dialog ring-1 ring-zinc-200">
              <PostCover category={post.category} seed={post.slug} />
            </div>
          </Container>
        </header>

        <Container className="py-14 sm:py-16">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_200px]">
            <div className="prose-body min-w-0">
              <ContentBlocks blocks={post.body} />
            </div>
            <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
              {headings.length > 1 && (
                <nav aria-label="On this page">
                  <p className="text-sm font-medium text-zinc-900">On this page</p>
                  <ul className="mt-3 space-y-2 border-l border-zinc-200">
                    {headings.map((h) => (
                      <li key={h}>
                        <a href={`#${slugify(h)}`} className="-ml-px block border-l border-transparent pl-3 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-950">
                          {h}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900">Share</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex size-9 items-center justify-center rounded-lg text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                    aria-label="Copy link to article"
                  >
                    <Link2 className="size-4" aria-hidden="true" />
                  </button>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-9 items-center justify-center rounded-lg text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                    aria-label="Share on LinkedIn"
                  >
                    <SocialIcon name="linkedin" />
                  </a>
                  <a
                    href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-9 items-center justify-center rounded-lg text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                    aria-label="Share on X"
                  >
                    <SocialIcon name="x" />
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </Container>
      </article>

      <section className="border-t border-zinc-100 bg-canvas py-16 sm:py-20" aria-labelledby="related-title">
        <Container>
          <h2 id="related-title" className="text-2xl font-semibold tracking-tight text-zinc-950">
            Keep reading
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </Container>
      </section>

      <CtaBanner />
    </>
  )
}
