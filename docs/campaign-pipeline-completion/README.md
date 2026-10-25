# Campaigns and Pipeline QA

The [backend report](../../../backend/docs/campaign-pipeline-completion/REPORT.md) contains product decisions, before/after flow map, gap report, API/database details, performance and rollout/rollback instructions. [Reproduction steps](../../../backend/docs/campaign-pipeline-completion/QA.md) specify the disposable local environment and the order of UI/volume checks.

[evidence/browser-results.json](evidence/browser-results.json) records real Chrome + local API/DB assertions. Intentional 503 and real stale 409 test recovery; rapid hard navigations trigger the existing unrelated notification stream-ticket rate limit (429). No other module HTTP failures or uncaught browser errors occurred. [Public capture](evidence/public-capture.json) additionally verifies UTM attribution, assignment, deduplication, tenant rejection and retained deleted-campaign attribution without a dead link.

Desktop (1440×1000) and mobile (390×844) PNGs cover campaign list/detail, pipeline board/settings, Lead Detail and dashboard. Test records, names, money and credentials are synthetic. Screenshots were captured before volume seeding; they show the main flow verification. `failure.png` from intermediate test-harness debugging is intentionally excluded.
