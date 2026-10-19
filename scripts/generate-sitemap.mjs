// Writes public/sitemap.xml from the static routes plus every blog post and help article.
// Runs before each build (see "build" in package.json), so new content is picked up automatically.
import { readFileSync, writeFileSync } from 'node:fs'

const SITE = JSON.parse(readFileSync('src/data/site.json', 'utf8')).url
const blog = JSON.parse(readFileSync('src/data/blog.json', 'utf8'))
const help = JSON.parse(readFileSync('src/data/help.json', 'utf8'))

const staticRoutes = ['/', '/features', '/solutions', '/pricing', '/integrations', '/about', '/contact', '/demo', '/blog', '/help', '/privacy', '/terms']
const entries = [
  ...staticRoutes.map((path) => ({ path })),
  ...blog.posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.date })),
  ...help.articles.map((a) => ({ path: `/help/${a.slug}`, lastmod: a.updated })),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${SITE}${e.path}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
writeFileSync('public/sitemap.xml', xml)
console.log(`sitemap.xml: ${entries.length} URLs`)
