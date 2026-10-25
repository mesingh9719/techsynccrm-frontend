# Campaigns and Pipeline UI enhancements

The follow-up UI work is committed on `fix/campaigns-pipeline-completion` in the frontend repository. It uses the existing React/Tailwind components, theme tokens, icons, API client and permissions. No backend/API contract, schema, dependency or production setting changed. Unrelated pending email/template/router changes remain outside these commits.

## Campaigns

- Clearer overview cards with a compact horizontal strip on phones.
- Search/channel controls in one toolbar; owner, source, status and labelled dates in an expandable filter panel. Active settings remain in the URL and reopen after reload.
- Status shortcuts with counts that respect the current search/channel/source/date filters. Sorting remains across the whole matching collection; tracking-code sorting is still available.
- Rows group campaign identity, channel, owner, spend/budget, leads and performance. Budget bars indicate overspend as well as showing the recorded amounts.
- Dedicated mobile cards replace the wide table; each opens the existing campaign detail flow. Bulk selection, tracking copy and existing edit actions remain available.
- Detail has stronger title/status hierarchy, schedule/source/owner context, budget use and a lead-journey section driven by real campaign metrics. Existing lifecycle, duplication, deletion and provider controls are retained.

## Pipeline

- A compact pipeline selector and view switcher, direct access to stage settings for authorized users, and an expandable filter toolbar shared with Campaigns.
- Clear open-value/weighted-value summaries and stronger stage headers, counts and outcome accents.
- Deal cards prioritize the opportunity title and value; duplicate company/title text is omitted. Native stage selectors and keyboard/drag interactions remain available.
- A bounded board with independent vertical column scrolling and horizontal mobile navigation. A large stage now stays inside the board instead of making the document thousands of pixels tall.
- Empty filtered results offer a clear reset that preserves the selected pipeline/view/sort.
- Stage settings show ordered stages and protected outcomes; expandable entry rules reduce clutter while preserving the existing save behavior.
- Forecast's decorative chart column hides on phones to leave room for its data columns.

The marketing preview keeps the existing uncontained board header/sizing. The app opts into the new contained presentation.

## Verification

`npm test`: all **3 test files pass**. TypeScript and `npm run build` pass. `npm run lint` exits 0 with the same nine warnings in existing code; no new warning category was introduced. Build still reports the existing ineffective dynamic imports for router/query client.

`node test/sales-ui.browser.mjs` passed against the real disposable local QA API/database. It creates synthetic campaign/deal fixtures and verifies:

- Filter expansion, collapse and URL restoration after reload.
- Status shortcuts and collection-wide sorting.
- Campaign detail and duplicate-dialog access.
- A stage selector and actual HTML5 drag persisting through the real move API.
- Internal scrolling and Load more in a large existing stage; the document remains under 1,800px at the tested desktop viewport. The direct measurement was 1,123px, with a 584px board and a 465px scrolling column body containing 7,184px of cards.
- Expanded stage entry rules saving through the settings API.
- Mobile campaign cards/detail, horizontally scrolling board, filter panel and empty-state reset without document overflow.
- Dark/light rendering and viewer access without create/move/settings controls.

The final run recorded **no uncaught browser errors and no failed API responses**. Viewports: desktop 1440×1000 and mobile 390×844, using Chrome. All fixtures and screenshots are synthetic; no live ads or production data were used. Existing integration/latency work remains unchanged.

## Screenshots

| View | Desktop | Mobile / additional |
|---|---|---|
| Campaign list | [Desktop](ui-evidence/campaigns-desktop.png) | [Mobile overview](ui-evidence/campaigns-mobile.png), [mobile cards](ui-evidence/campaigns-mobile-cards.png), [dark mode](ui-evidence/campaigns-dark.png) |
| Campaign detail | [Desktop](ui-evidence/campaign-detail-desktop.png) | [Mobile](ui-evidence/campaign-detail-mobile.png) |
| Pipeline board | [Desktop](ui-evidence/pipeline-desktop.png) | [Mobile](ui-evidence/pipeline-mobile.png), [mobile board](ui-evidence/pipeline-mobile-board.png), [dark mode](ui-evidence/pipeline-dark.png), [large stage](ui-evidence/pipeline-large-stage.png) |
| Pipeline list/settings | [List](ui-evidence/pipeline-list-desktop.png) | [Stage settings](ui-evidence/pipeline-settings-desktop.png) |

[Recorded browser results](ui-evidence/results.json). Setup is the same disposable localhost environment described in the [QA instructions](../../../backend/docs/campaign-pipeline-completion/QA.md). The new UI script also works after the volume seed; it uses its own selected pipeline/campaign fixtures rather than assuming the database has only 85 deals. Existing notification rate limits are not relaxed.

## Files

| File | Change |
|---|---|
| `src/features/crm/components/SalesFilters.tsx` | Shared accessible expandable search/filter toolbar. |
| `src/features/crm/sales-ui.css` | Scoped sales metrics, filters, tabs, budget indicators and responsive/theme styling. |
| `src/features/campaigns/CampaignVisuals.tsx` | Channel icon, status badge and accessible budget-use indicator. |
| `src/features/campaigns/CampaignsPage.tsx` | Campaign overview, tabs, toolbar, grouped rows and mobile cards. |
| `src/features/campaigns/CampaignDetailPage.tsx` | Campaign context, performance and lead journey layout. |
| `src/features/deals/DealsPage.tsx` | Pipeline workspace controls, summaries, empty state and responsive forecast. |
| `src/components/product/PipelineBoard.tsx` | Opt-in contained board, stronger stage/card presentation. |
| `src/components/product/pipeline-board.css` | Bounded columns, internal scrolling and touch sizing. |
| `src/features/pipelines/PipelinesSettings.tsx` | Stage hierarchy, configuration guidance and expandable entry rules. |
| `test/sales-ui.browser.mjs` | Real API/UI regression and viewport/theme checks. |
| `docs/campaign-pipeline-completion/UI-ENHANCEMENTS.md` | This follow-up report. |
| `docs/campaign-pipeline-completion/ui-evidence/*` | Synthetic screenshots and browser results. |

Rollback is a frontend commit revert; no migration or data rollback is needed. No deployment was performed.
