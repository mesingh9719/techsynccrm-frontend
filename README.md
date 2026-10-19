# TechSync CRM — marketing site

Marketing website for TechSync, a CRM for SMEs and MSMEs. Built with React 19, React Router 7, Tailwind CSS 4, react-hook-form and zod, on Vite.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # generates sitemap, type-checks, builds to dist/
npm run preview   # serves the production build
npm run lint
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Home: hero, interactive product preview, features, pricing, FAQ |
| `/features` | All features, with a sticky section nav |
| `/solutions` | Industry sections (`#retail`, `#manufacturing`, `#services`, `#real-estate`, `#education`, `#healthcare`) and teams |
| `/pricing` | Plans, billing/currency toggles, cost estimator, comparison table |
| `/integrations` | Searchable, filterable directory (`?category=`) plus API docs teaser |
| `/about`, `/contact`, `/demo` | Company, contact form (`?topic=sales`), demo booking (`?industry=`) |
| `/blog`, `/blog/:slug` | Blog list (`?category=`) and posts |
| `/help`, `/help/:slug` | Help Center search and articles |
| `/login`, `/signup` | Auth screens (`/signup?plan=growth`) |
| `/privacy`, `/terms` | Legal pages |
| `*` | Custom 404 (unknown blog and help slugs show it too) |

Every page is lazy-loaded as its own chunk.

## Project structure

```
src/
  data/            JSON content (site, navigation, features, pricing, blog, help, legal, demo CRM data…)
  services/        Content access (content.ts, site.ts, blog.ts, help.ts, legal.ts) and mock API (api.ts)
  lib/             Zod schemas, SEO hook, scroll-reveal/scroll-spy hooks, formatting, icon registry
  components/
    ui/            Button, form fields, Accordion, SegmentedControl, Toast, Badge, Section helpers
    layout/        Layout, Navbar, Footer, AuthShell, LegalPage
    marketing/     Pricing, social proof, CTA, feature and post cards
    product/       Interactive CRM previews: pipeline board, leads table, charts, feature visuals
  pages/           One file per route
scripts/           generate-sitemap.mjs (runs before every build)
```

## Connecting real data

- **Content:** pages read data only through `src/services/*.ts`, not by importing JSON directly. To use a CMS, change those functions (or move them into route loaders) and keep the return types in `src/types.ts`. Icons in JSON are referenced by name and resolved in `src/lib/icons.ts`.
- **Forms:** `src/services/api.ts` holds the mock endpoints for contact, demo, newsletter, login, password reset and signup. Replace `request()` with a real `fetch` against `VITE_API_BASE_URL` (see `.env.example`). Field errors from the server come back as `ApiError` with a `field`, and the forms display them.
- **Mock behaviour you can try:** signing up with `taken@example.com` returns a "duplicate email" error, and logging in with the password `wrongpassword` returns an "incorrect credentials" error.

## Placeholder content to replace before launch

- Testimonials (`src/data/testimonials.json`, marked `placeholder: true`, with a note shown on the page) and the customer story blog post
- Customer names in the logo cloud, stats, office addresses and phone numbers
- Privacy Policy and Terms (template text; have them reviewed by legal counsel)
- `og:image` in `index.html` (`/og-image.png` doesn't exist yet) and the production domain in `src/data/site.json`

## Deployment

This is a single-page app. Configure your host to serve `index.html` for unknown paths (for example, Netlify `/* /index.html 200`, a Vercel rewrite, or nginx `try_files $uri /index.html`).

## Accessibility and SEO notes

- Skip link, visible focus rings, labelled form controls with `aria-invalid`/`aria-describedby`, keyboard-operable menus, tabs, accordion and pipeline board (← / → move a focused deal), and live-region announcements
- Respects `prefers-reduced-motion`
- Per-route title, description, canonical, Open Graph and robots tags (`src/lib/useSeo.ts`); JSON-LD in `index.html`; `robots.txt` and a generated `sitemap.xml`
