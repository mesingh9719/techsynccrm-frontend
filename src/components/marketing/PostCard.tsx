import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { BlogPost } from '../../types'
import { PostCover } from '../ui/Brand'

export function PostMeta({ post, className }: { post: BlogPost; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2 text-sm text-zinc-500', className)}>
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      <span aria-hidden="true">·</span>
      <span>{post.readMinutes} min read</span>
    </p>
  )
}

export function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <article className={cn('group relative flex flex-col', featured && 'lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-12')}>
      <div className="aspect-[16/9] overflow-hidden rounded-2xl ring-1 ring-zinc-200">
        <PostCover category={post.category} seed={post.slug} className="transition-transform duration-500 group-hover:scale-[1.02]" />
      </div>
      <div className={cn('mt-5', featured && 'lg:mt-0')}>
        <p className="font-mono text-xs font-medium tracking-wider text-brand-700 uppercase">{post.category}</p>
        <h3 className={cn('mt-2 font-semibold tracking-tight text-zinc-950 group-hover:text-brand-700', featured ? 'text-2xl sm:text-3xl' : 'text-lg')}>
          <Link to={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>
        <p className={cn('mt-2.5 leading-relaxed text-zinc-600', featured ? 'text-lg' : 'line-clamp-2 text-[15px]')}>{post.excerpt}</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-800">{post.author.name}</span>
          <PostMeta post={post} />
        </div>
      </div>
    </article>
  )
}
