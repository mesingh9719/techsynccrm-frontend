import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { site } from '../services/site'

interface SeoOptions {
  title?: string
  description?: string
  /** Set for pages that should not be indexed (auth, 404). */
  noindex?: boolean
  type?: 'website' | 'article'
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = value
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

/** Updates document title, description, canonical and social tags for the current route. */
export function useSeo({ title, description, noindex, type = 'website' }: SeoOptions) {
  const { pathname } = useLocation()

  useEffect(() => {
    const fullTitle = title ? `${title} — ${site.name}` : site.defaultTitle
    const desc = description ?? site.defaultDescription
    const url = `${site.url}${pathname === '/' ? '/' : pathname}`

    document.title = fullTitle
    setMeta('name', 'description', desc)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:type', type)
    setCanonical(url)
  }, [title, description, noindex, type, pathname])
}
