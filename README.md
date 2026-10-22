# TechSync CRM frontend

React 19, React Router 7, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form and Zod on Vite. This package contains both the public marketing site and the authenticated CRM.

## Run locally

From this directory, with dependencies already installed:

```bash
npm run dev
```

For a fresh checkout, run `npm ci` first. Vite prints the local URL (normally `http://localhost:5173`). The CRM starts at `/app`; existing authentication and workspace onboarding remain required. The API and worker run separately; see [backend instructions](../backend/README.md).

Keep your existing environment file. For a new setup, copy `.env.example` to `.env`. `VITE_API_BASE_URL=/api` uses the Vite development proxy to `http://localhost:5000`. To change the backend target, provide `VITE_API_PROXY_TARGET` in the process environment when starting Vite.

On Vercel, keep `VITE_API_BASE_URL=/api` (the default). `vercel.json` proxies `/api/*`
to `https://techsynccrm-backend.vercel.app/api/*` before serving `index.html` for
React Router pages. This ordering sends POST requests such as login and refresh to
Express and keeps the refresh cookie on the frontend origin. Vite's development and
preview proxies do not configure production hosting. If the backend domain changes,
update the API rewrite destination and redeploy the frontend.

## Redesigned routes

| Route                                            | Purpose                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `/app`                                           | Needs-attention dashboard, lead metrics, tasks, source mix and setup checklist         |
| `/app/setup`                                     | Workspace, first source, team invitation and sample lead walkthrough                   |
| `/app/leads`, `/app/leads/:id`                   | Lead inbox and follow-up workspace                                                     |
| `/app/deals`, `/app/deals/:id`                   | Pipeline and deal detail                                                               |
| `/app/tasks`                                     | Today, overdue, upcoming and completed follow-ups                                      |
| `/app/contacts`, `/app/companies`                | Contact and company directory                                                          |
| `/app/integrations`                              | Source status and connection guides                                                    |
| `/app/reports`                                   | Overview, source, funnel and team reports                                              |
| `/app/settings/forms`, `/app/settings/forms/:id` | Web forms and builder (`new` creates a form)                                           |
| `/app/settings/assignment`                       | Assignment rules, working hours and rule dry run                                       |
| `/app/settings/availability`                     | Personal out-of-office periods                                                         |
| `/app/settings/tags`                             | Shared tag management                                                                  |
| `/app/settings/*`                                | Existing profile, workspace, team, security, pipeline, custom-field and other settings |
| `/f/:key`                                        | Public form renderer; unavailable until the live capture service is enabled            |

Marketing routes, login/signup, email verification, account recovery, invitations and existing record routes remain in `src/router.tsx`.

## Real API and preview boundaries

Existing authentication, records, tasks, pipelines, notifications, tags, imports/exports, settings and Facebook APIs remain wired. Dashboard metrics use existing visibility-scoped record APIs. Connecting Facebook still needs the provider configuration described in [the Facebook guide](../docs/06-facebook-integration.md).

The documented M14 capture/assignment and M15 report backends do not exist in the current backend. Their screens are explicit previews by default:

- Forms, assignment rules, working hours and out-of-office plans save in browser storage scoped to the user and workspace. They do not publish forms, assign real leads, send email or run reminders/SLA jobs.
- Reports use a separate sample dataset, including for filters and CSV downloads. Dashboard numbers use real records.
- Instagram, Google Ads and general Webhook/Zapier cards explain setup needs; they cannot connect yet.

`VITE_CRM_CAPTURE_API` and `VITE_CRM_REPORTS_API` default to `false`. Leave them off against the current backend. Enable them only after implementing compatible APIs and reconciling response shapes in `features/capture/api.ts` and `features/reports/api.ts`. A failed live request shows an error; it never silently switches to preview data. Public form requests omit credentials and authentication headers.

See [the delivery notes and manual checklist](../docs/08-frontend-redesign.md) for phase summaries, endpoint boundaries and outstanding functionality.

## Code structure

```text
src/
  app/                 Layout, navigation, command search, theme and existing account settings
  components/ui/       Shared buttons, inputs, badges, tabs, toast and copy controls
  components/app/      Dialog/drawer, menu, data table, filter bar, states and app helpers
  components/product/  Shared charts, pipeline board and marketing product previews
  features/
    crm/               Shared record types, fields, filters, saved views and dialogs
    leads/             Inbox, detail, inline status and arrival polling
    deals/             Pipeline and deal workflows
    activities/        Timeline, activity logging and quick follow-up
    tasks/             Task list, editor and My day
    dashboard/         Live operational dashboard and workspace calendar helpers
    capture/           Forms, public renderer, assignment and availability adapters
    onboarding/        Setup wizard and progress checklist
    integrations/      Lead source hub
    reports/           Report adapter, sample dataset and fiscal date presets
    tags/              Shared tag settings
  services/            Single HTTP client, auth, account, workspace and team APIs
  lib/                 Permissions, query keys, validation, formatting and shared hooks
  pages/               Marketing and public account pages
public/embed.js         Standalone iframe embed loader
```

Design tokens live in the Tailwind 4 `@theme` block in `src/index.css`; this stack uses CSS configuration instead of a separate Tailwind JS config. Semantic surface, text, border, radius and spacing tokens share the existing cobalt primary palette. CRM light/dark/system theme preferences apply to the authenticated shell and its dialogs.

The shared HTTP client handles access tokens, refresh, API envelopes and errors; TanStack Query owns server state. Existing optimistic pipeline moves are preserved, and inline lead statuses update cached lists/detail with rollback. A foreground poll checks the newest 25 leads every 30 seconds and toasts new arrivals; it is a bounded inbox refresh, not an event delivery guarantee.

## Delivery and manual review

Further automated tests, type checks, lint, builds and browser checks were stopped at the user's request. The final edits have not been verified. Use the [manual checklist](../docs/08-frontend-redesign.md) to review the workflows.

No backend, database, dependency or deployment changes are included in this frontend redesign. `public/embed.js` is copied as a static asset by Vite. Production hosting must serve `index.html` for SPA routes while continuing to serve real static assets such as `/embed.js` directly.
