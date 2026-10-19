/** Blog content. Swap for a CMS/API call while keeping these return types. */
import blogJson from '../data/blog.json'
import type { BlogPost } from '../types'

export const blog = {
  categories: blogJson.categories,
  posts: (blogJson.posts as BlogPost[]).toSorted((a, b) => b.date.localeCompare(a.date)),
}

export function getPost(slug: string) {
  return blog.posts.find((p) => p.slug === slug)
}
