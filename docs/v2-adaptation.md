# V2 frontend adaptation

The existing `frontend` now adopts the compatible design and interaction improvements from `techsync-crm-v2/frontend`. The v2 folder remains a reference; implementation stays in the existing application.

## Review findings

- V2 improves navigation, list hierarchy, drawer forms, dashboard chart readability, and settings organization.
- Some v2 pages remove existing protections: campaign ownership checks, selection eligibility, unsaved-change guards, and scoped report drill-down links. Those protections were retained or restored during adaptation.
- V2 lead qualification and message templates use a mock local-storage transport. These were not brought into real record workflows.
- V2 also expects a source catalog, more web-form field types, direct campaign-ID lead updates, and a server import-template endpoint. The current backend does not provide those contracts. Existing supported contracts remain in use.

## Adapted modules

| Area | Result |
| --- | --- |
| Shell | Expandable dark sidebar with remembered state and `[` shortcut, icon tooltips, sticky topbar, swipe-dismissable mobile navigation, phone bottom tabs, and safe-area spacing. |
| Theme | Shared light/dark/system preference across desktop and account-menu controls, including browser chrome color. |
| Lists | V2 table surfaces, sticky headers, density controls, record counts, footer actions, and mobile cards. Existing sorting, selection permissions, saved views, and API pagination remain. |
| Leads | Unified status tabs, toolbar, filter chips, campaign filter, table/cards, and bulk actions. Detail view uses profile/activity/next-step columns, mobile tabs, status progression, and mobile contact/follow-up actions. All record fields and tasks use existing APIs. |
| Forms | Shared expandable `FormDrawer`, grouped and collapsible sections, container-responsive field rows, money inputs, and linked company/contact rows. Adopted for leads, contacts, companies, deals, and campaigns. |
| Dashboard | Aligned funnel stages and charts, readable shares, legends, empty states, waiting-stage review action, cleaner revenue/source charts, and customization drawer. Six chart types and user/workspace-scoped preferences remain. |
| Settings | Searchable grouped navigation, mobile section picker, structured settings cards, and persistent save/discard rows for profile and workspace forms. |
| Import/export | Clearer six-step wizard, mapping and option groups, final review summary, progress/results, local CSV starter template, and filterable history. Existing editable spreadsheet, revision checks, and API operations remain. |
| Web forms | V2 cards with explicit preview/draft/live states, share dialog, shared embed instructions, and duplication through the existing create endpoint. The builder retains supported field types. |
| Other modules | Contacts, companies, pipeline, tasks, campaigns, reports, integrations, and team pages inherit the updated shared shell, tables, overlays, page headers, and settings surfaces. Existing module-specific workflows remain. |

## Integration boundaries

No backend source, database schema, route definitions, dependencies, or API request contracts were changed. Lead campaign attribution still saves through existing UTM/source metadata. Export response types now describe optional metadata already returned by the backend; no endpoint changed. CSV starter downloads run in the browser and do not require a new endpoint.

The shared router blocker and form dismissal guards remain. Successful form saves unregister their dirty state before navigation. Dialogs and mobile navigation now share one scroll lock so nested overlays restore scrolling correctly. Existing live/preview feature flags remain authoritative.

## Manual acceptance checklist

No tests, linters, builds, development servers, screenshots, or browser automation were run, as requested. Source review does not establish runtime or visual correctness.

- Expand/collapse navigation, reload to check persistence, use `[` and Cmd/Ctrl+K, and check mobile bottom tabs and drawer dismissal.
- Switch light/dark/system themes from both controls; check cards, menus, drawers, and charts.
- Filter and sort leads, switch cards/table, select eligible records, load more, and apply a saved view.
- Open a lead, change stages, claim/assign, edit fields, associate a campaign, add a note/task, convert, and restore a deleted lead with the appropriate roles.
- Create/edit each record type; widen the drawer, trigger validation, cancel a dirty form, save, and navigate away.
- Customize dashboard cards/metrics and order, switch all six chart types, reload, and check zero and small counts.
- Save/discard profile and workspace settings; search settings and use the mobile picker.
- Import CSV/XLSX through review, edit the spreadsheet, check progress/results, and open import/export history. Check a downloaded CSV template's mapping before importing it.
- Create, duplicate, share, and delete a web form; verify previews stay labeled and live publishing follows the existing capture flag.
- Check phone/tablet layouts, long record names, keyboard focus, nested overlays, and scrolling after closing dialogs.
