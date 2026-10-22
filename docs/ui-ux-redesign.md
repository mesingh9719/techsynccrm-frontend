# Frontend UI/UX audit and redesign

Scope: React, TypeScript, Tailwind frontend. Backend logic, API contracts, routes, and data models were not changed for this redesign. This is a source review; no tests, linting, builds, servers, screenshots, or browser automation were run, as requested.

## Audit

1. **Layout and shell:** wide navigation consumed working space; page containers varied; mobile topbar controls competed for width; detail pages had long stacked activity sections.
2. **Spacing:** page gutters, card padding, filter bars, and input/button heights varied. Half-step padding and one-off text sizes made adjacent controls uneven.
3. **Typography and alignment:** too many caption sizes, inconsistent page headings, weak metric hierarchy, and missing truncation titles.
4. **Components:** repeated table markup, inconsistent table tools, incomplete active-filter visibility, inconsistent settings cards, and small icon controls.
5. **Overlays:** searchable pickers and score popovers could be clipped; drawer widths and scroll regions varied; dirty forms and route changes needed shared protection.
6. **Elevation:** one-off shadows and mixed radii; some cards combined borders and rings.
7. **States:** some relationship fetch failures resembled empty results; several lists used loading text; clipboard and asynchronous Undo failures could give misleading feedback.
8. **SaaS essentials:** dashboard priorities, record tabs, locally saved views for modules without a view API, explicit confirmations, onboarding first-lead action, and keyboard chart exploration needed attention.
9. **Accessibility and responsiveness:** unnamed controls, incomplete combobox associations, small targets, nested interactive cards, narrow bars hiding labels, and fixed layout widths.

## Design system and shared components

- `src/index.css`: 4px spacing foundation; shared page gutters; 8/12/16px radii; card/popover/modal shadows; indigo actions; neutral ink and surfaces; semantic colors; sparse lime highlight; explicit overlay layers; light/dark tokens.
- Typography: Manrope display/headings/numbers, Geist body, existing monospace for codes. Local fallbacks remain available when fonts cannot load.
- Buttons: 32/40/44px sizes, primary/secondary/ghost/danger, busy states, labelled icon controls and larger touch targets.
- Forms: shared 40px controls, required markers, helper/error associations, and common field styling.
- `Dialog` / `Modal` / `Drawer`: one native-dialog implementation; 420/560/720px drawer sizes, scroll-contained body, persistent header/footer, backdrop, Escape, focus restoration, nested body scroll locks and error-retaining confirmations.
- `useFloatingPanel`: shared native top-layer positioning for menus, member/record/tag pickers, mentions and score explanations. Viewport clamping and resize/scroll updates keep panels visible.
- `UnsavedChangesProvider` + `useUnsavedChanges`: one router blocker for registered forms, browser Back/quick-add navigation, local dismissal confirmations and browser refresh protection.
- Shared table: sticky headings, density control, optional column chooser, sort indicators, local or existing server sorting, eligible row selection, row menu, keyboard activation, truncation titles, and bounded scrolling. Local sorting is labelled as sorting the loaded records.
- Page headers, active filter chips, browser-local saved views, settings sections, skeletons, empty/error states and toasts are shared.
- Provider logo colors are centralized separately from product colors. User-selected brand colors remain data; monograms choose contrasting text. Chart/grid coordinates remain calculated geometry rather than decorative spacing.

## Module changes

| Module | Result |
| --- | --- |
| Shell and navigation | Dark compact rail, expandable labels with saved preference, mobile drawer, sticky search/quick-add/notifications/account controls, mobile-accessible theme selector. |
| Dashboard | Attention queue first, compact metrics, larger funnel, retained card customization and six chart choices. Largest waiting stage is highlighted honestly. Revenue/source cards use existing live-reporting endpoints and availability flag. |
| Lead inbox | Shared spacing/table improvements, active chips, existing saved views/column settings/bulk operations retained, improved controls and drawer protection. |
| Lead detail | Left profile/contact actions and context, right Activity/Notes/Tasks/Deals/Files workspace. Unconverted leads explain how conversion links opportunities. |
| Contacts and companies | Shared list tools and detail workspace; relationship errors offer retry; company/contact association workflows remain intact. |
| Pipeline and deals | Uniform horizontally scrolling columns, clear totals and drag/move controls, consistent cards; tabbed deal workspace and stage-history retry. |
| Tasks and follow-ups | Clearer task rows, confirmed deletion, protected task/quick-add drafts, browser-local views and active chips; existing completion/logging workflows preserved. |
| Campaigns | Shared table, column visibility, sorting, paging, active filters, browser-local views, owner-aware edit/selection controls, selected pause action with partial-failure feedback. Persistent form footer, inline validation, guarded edits and honest clipboard feedback. Existing persisted APIs retained. |
| Activities, notes and files | Drafts survive activity-tab switches; notes/mentions use shared overlay positioning; file removal confirms and retains existing Undo; file errors/loading/empty states improved. |
| Integrations and Facebook | Cards avoid nested interactive controls; availability and preview status are explicit; Facebook disconnects confirm; loading/table layouts and picker layers are consistent. |
| Imports and exports | Existing six-step spreadsheet/edit/review/progress flow preserved; clearer heading and stepper; improved loading/resume errors; matching spreadsheet row/virtual geometry; transfer history has shared table and next-action states. |
| Assignment and availability | Protected rule/schedule edits, one scrolling modal region, existing reorder/dry-run actions retained; availability removal confirms. Preview/live distinction preserved. |
| Team and invitations | Clear heading, keyboard team tabs, protected invitation/member/team edits, consistent drawers and busy handling for sensitive actions. Existing admin/owner permissions retained. |
| Reports and analytics | Compact metrics, saved browser views, filter chips, sortable report values, keyboard chart exploration and readable zero/small values. Actual cohort drop-off highlighted; sample reports stay explicitly labelled. |
| Workspace/profile/security/plan | Consistent headings, breadcrumbs, cards and controls; shared settings card replaces local duplicate; protected profile/workspace/password edits; plan and access logic retained. |
| Fields, tags, lead and pipeline settings | Shared headings/styles/pickers; protected field/pipeline forms; reorder errors visible; existing configuration/deletion rules retained. |
| Notifications | Consistent inbox/preferences layouts and states, protected preferences, shared floating panel and longer-lived actionable/error toasts. |
| Onboarding | Existing source/team/sample journey retained; real first-lead checklist action added using current records and permissions; sparse lime completion accent. |
| Public, help, marketing, authentication and account flows | Shared typography, buttons, form controls, radii and shadows applied throughout; auth frame spacing refined; provider colors centralized; route/auth loading uses skeletons. Existing content and authentication behavior retained. |
| Planned modules | Inbox, Quotes, Automation, and Billing placeholders use the shared header and useful return action; they do not pretend to provide unfinished features. |

## Existing service dependencies and limits

- No backend work or deployment was performed for this redesign.
- Revenue/source dashboard widgets require `VITE_CRM_REPORTS_API=true` and the existing reporting endpoints. They do not display sample numbers as workspace activity.
- Capture/assignment/availability continue to follow the existing live-capture flag. Browser previews remain clearly labelled.
- Instagram, Google and generic inbound connector guides remain limited by their existing service availability. Planned Inbox, Quotes, Automation and Billing need their corresponding product/backend work.
- Dashboard and new Campaigns/Tasks/Reports browser views are scoped to the current user/workspace in browser storage. Cross-device synchronization or team sharing of these new view types requires backend support. Existing CRM saved views retain their server persistence.
- Dashboard lead status counts are a current-state distribution, not a historical journey. Its warning is therefore “largest waiting stage.” The reporting cohort funnel can show a real drop-off.
- Bulk actions use existing endpoints. Campaign pause reports individual failures; no transactional bulk or new undo API was invented.
- Source review cannot establish rendered contrast, overflow, keyboard focus behavior, or runtime correctness. These require the manual checks below.

## Manual acceptance checklist

- Open every navigation section at desktop, tablet and 320–390px phone widths. Check sidebar centering, expand persistence, topbar fit, page gutters, horizontal tables and full-height drawers.
- Switch light/dark/system themes, including on a phone. Inspect text/semantic contrast and charts; verify both display-font loading and local font fallback.
- Open nested pickers, score explanations, menus, drawers and confirmation dialogs near viewport edges. Test click outside, Escape, Tab/Shift+Tab, focus return, body scroll lock and toast visibility.
- Edit a record, task, note, campaign, team, custom field and workspace setting. Try Cancel, browser Back, a sidebar link, quick-add and refresh. Confirm cancellation retains edits; successful saving proceeds without a false warning.
- Switch record/activity tabs with unfinished notes. Confirm drafts remain, relationship errors retry, and permission-limited actions stay hidden/disabled.
- Customize and reload the dashboard for two users/workspaces. Try all six funnel charts, zero leads, one populated stage, large numbers, empty attention queue and failed requests.
- With live reporting enabled, change dashboard dates/source/owner and follow the report/lead links. With reporting disabled, confirm no sample data appears in live dashboard cards.
- Try table sorting, density, column visibility, selection, bulk actions, row menus, saved views, active chips and pagination. Confirm local-only saved views are labelled and limited to the current browser/account/workspace.
- Create/edit/pause a campaign; verify spend precision, UTM link generation, attribution drill-down, owner scope, sync account selection and clipboard-denied feedback.
- Import a spreadsheet: editing starts off; mapping works; preview/fix/review navigation works; final review precedes import; progress/error/cancel/undo behavior remains correct. Inspect virtual row alignment while scrolling and editing.
- Check team invitations, role changes, assignment rules, availability, notification preferences and onboarding links against your available services.
- Review public/auth/help/legal pages, form errors, password visibility, newsletter/contact/demo confirmations and reduced-motion behavior.

Automated and browser verification remain deliberately unrun for your manual testing.
