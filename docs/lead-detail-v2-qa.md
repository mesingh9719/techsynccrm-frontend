# Lead detail: v2 parity

The main frontend now uses the lead detail layout, components, writing templates and
interaction patterns from `techsync-crm-v2/frontend`. The reference directory is unchanged.
The page has the v2 header and stage tracker, Contact/Deal and Source & Requirements cards,
central conversation/timeline, Insights and Follow-ups cards, responsive section tabs and
sticky mobile communication buttons. Stage changes retain confirmation dialogs.

## Implementation map

- `src/features/leads/LeadDetailPage.tsx`: composition, responsive sections, dialogs and permissions.
- `src/features/leads/detail/`: reference cards, inline editors, communication and qualification.
- `detail/insights.ts`: pure stage-aware next action, health, missing information and recommendations.
- `detail/useFieldFocus.ts` and `fieldFocus.ts`: reveal the section, open/focus its field and respect reduced motion.
- `detail/extrasApi.ts`: qualification through existing lead GET/PATCH, optimistic updates and rollback.
- `detail/followUpSlots.ts`: future shortcuts in the workspace timezone.
- `detail/config/`: option lists and built-in writing templates.
- `src/features/activities/Timeline.tsx`: accept explicit composer drafts from templates/actions.
- `src/index.css`: scoped reference styles and reduced-motion/focus polish.
- `test/behavior.test.mjs`: pure insights, focus, dates and interpolation tests.
- `test/lead-detail.browser.mjs`: isolated browser scenarios with synthetic API responses.

## Data and behavior assumptions

Existing lead fields, tenant permissions, status transitions, activities, tasks, conversion
and attachments keep their existing services. Task results support pagination beyond 50.
Insights use existing first-response/activity timestamps and loaded open tasks; unavailable
tasks do not imply that no follow-up exists.

V2's qualification facts require persistence: priority, estimated deal value, expected close
date, buying timeline, preferences, objections and decision makers now live in the additive
`Lead.qualification` JSON field. The backend validates and merges partial values, stamps their
update time, audits changes, enforces If-Match and retains existing access/converted guards.
There is no separate qualification endpoint or browser storage persistence. Existing leads
start with empty qualification. Monetary fields use integer minor units; zero is valid.
Estimated deal value and expected close date remain qualification facts; the existing
conversion dialog determines the created deal's final inputs.

Templates are bundled writing aids. Lead/workspace values are interpolated when chosen.
Call, email and WhatsApp actions hand off to the user's external app; logging requires an
explicit outcome action. They do not send messages through a new backend provider.
Web-form metadata is shown only when actually present in the API response.

## Manual QA checklist

- [ ] Empty New lead: claim/contact guidance, useful empty states, disabled unavailable channels and missing-field focus.
- [ ] Partial Contacted lead: save/cancel requirement and budget; set priority, timeline and source; add/remove decision makers and objections; guidance updates without reload.
- [ ] Full lead: correct health and conversion/scheduling suggestion; zero budget counts as filled.
- [ ] Stages: New → Contacted → Qualified confirmation; conversion dialog; Lost/Junk reopen confirmation; converted/deleted restrictions.
- [ ] Conversation: template focus and interpolation; call/note logging; timeline defaults to All; external handoffs require explicit logging.
- [ ] Follow-ups: workspace local time; create/edit/complete; overdue count; load over 50 tasks; loading/error states.
- [ ] Inline edits: Enter saves, Escape cancels; multiline shortcut saves; failure rollback; stale-update retry; reload preserves qualification.
- [ ] Desktop/tablet/mobile: desktop columns, narrow section tabs, sticky actions, no horizontal overflow; missing-field actions reveal Details.
- [ ] Keyboard: visible focus, arrow/Home/End section selection, inline editors, menus, dialogs and focus return.
- [ ] Reduced motion: focus without animated scrolling/pulse.
- [ ] Permissions: viewer read-only; assigned-only rep restrictions; no data carries between leads/workspaces.
- [ ] Existing flows: edit drawer, assignment, delete/restore, duplicates, conversion, attachments and linked-record navigation.

## Executed verification (22 October 2026)

- Frontend: 23 behavior tests pass; whole-project strict TypeScript, production build and lint of changed components pass.
- Browser: 19 checks pass at desktop and 390px mobile, including focus, rollback, templates, handoff/logging, quick follow-up, confirmation, keyboard tabs, pagination and role/stage restrictions. No page errors or unexpected API routes.
- Backend: all five new qualification tests pass. Real HTTP/Prisma integration checks use disposable local PostgreSQL, covering persistence, merging, validation, stale updates, tenant isolation and read-only access.
- Full backend: 158 offline tests pass with two previously reproduced spreadsheet failures; 70 integration tests pass with the previously reproduced M11 idle-deals digest failure. These failures also occur without this change.
- Prisma schema validation and Git whitespace checks pass. No new dependencies.

Browser API responses are intercepted; separate API tests verify real database behavior.
Production deployment/data, messaging clients, SMTP, object storage and full conversion/file
provider roundtrips were not exercised. Tablet and complete keyboard coverage remain manual.
No production database was read or migrated for this change.

## Reproduce browser scenarios

From `frontend/`, build and serve a local preview with relative API paths:

```bash
VITE_API_BASE_URL=/api npm run build
npm run preview -- --host 127.0.0.1 --port 5180 --strictPort
```

In another terminal, use an existing Playwright installation:

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_EXECUTABLE=/usr/bin/google-chrome \
node test/lead-detail.browser.mjs
```

`LEAD_QA_URL` overrides the localhost preview address. The harness rejects remote preview
URLs, intercepts API calls with synthetic fixtures and blocks external requests. Screenshots
are written to `/tmp/lead-v2-desktop.png` and `/tmp/lead-v2-mobile.png`.
Use `npm test` for the normal dependency-free behavior suite. Deploy the paired backend
migration first; see [backend release notes](../../backend/README.md#lead-detail-v2-qualification-22-october-2026).
