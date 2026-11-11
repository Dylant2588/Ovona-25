# SCRUM-29 — illustrative daily purchase-pack costs

Status: implementation and automated verification complete; **In Progress pending desktop/mobile browser acceptance**. No Jira changes were made by the fullstack engineer. No merge, push or deployment.

## Delivered

- Reused the existing `tesco-prices.ts` catalogue and pack-ceiling arithmetic through an opt-in strict path. Legacy callers retain their existing behaviour. Strict matching uses exact canonical names and a narrowly audited alias whitelist, preserving food form and compatible SI units. No catalogue price was added or invented.
- Added `shopping-cost.ts` as a cost-only projection: required-pack purchase cost and consumed-food cost, partial known subtotals, unsupported currency/price gaps, explicit ownership, UK/GBP assumptions, unknown observation date and unverified product suitability. Recipe/ledger quantities remain unchanged.
- Existing approved shopping GET/POST now return `costEstimate` beside `planId` and the unchanged qualified retailer comparison. POST validates currency and bounded ownership keys against the approved current ledger. No new writes or pantry persistence.
- Added a cost panel inside the existing approved shopping list, with pack details and explicit have-enough-for-this-plan controls. Pantry selection and asynchronous results are bound to the exact plan, preference and ownership snapshots. Default ownership is empty; plan/preference changes invalidate selections and stale costs.

## Acceptance evidence

| Criterion | Evidence | Result |
|---|---|---|
| Approximate supported-currency purchase cost | `shopping-cost.test.ts`, approved route harness; existing pack catalogue reused | Automated pass |
| Purchase versus consumed cost; explicit pantry assumptions | Pack/fraction tests, ownership API tests, panel semantics tests | Automated pass |
| Compatible unit conversion and pack rounding only in costing | 550g/600g, 900g/two500g, kg/g and L/ml; incompatible mass/volume/count, food-form and tiny-quantity regression cases | Automated pass |
| Source/date/region/staleness and suitability visible | Explicit illustrative UK catalogue metadata, `observedAt:null`, separate calculation timestamp, panel warning tests | Automated pass; actual browser pending |
| Missing prices remain explicit known subtotals/gaps | Missing prices, unsupported currency and owned-but-unpriced cases; null distinguished from zero | Automated pass |
| Current approved plan/revision and ownership inputs | Actual route revision/approval tests; exact plan/preference/keys guards; existing approval invalidation test | Automated pass; interactive swap/reload/pantry browser check pending |
| Hard restrictions and no allergen-conflicting product recommendation | Existing owner/recipe/restriction approval retained; strict ingredient forms; generic assumptions never identify a safe retail product | Automated pass and code review |
| No new integration, schema or dependency | Scoped diff inspection | Pass |
| Desktop/mobile presentation and interactions | Not performed in this child agent: live tool catalogue has no supported in-app browser connector | **Pending; do not claim all acceptance criteria verified** |

## Verification

- Targeted core/API regressions: 25 passed, zero failed/skipped. Panel and existing approval check: 3 passed.
- Final normal `npm run test:orchestration`, outside the process-spawn-restricted sandbox: **238 passed, zero failed, zero skipped**.
- `npx tsc --noEmit --incremental false`: passed after API integration.
- `npm run lint`: zero errors, nine existing warnings; no new warning introduced. Existing baseline-browser-mapping age notice remains; no dependency installed.
- `git diff --check`: passed.
- Read-only GSD code review: no critical issues or warnings; see `261104-nvf-REVIEW.md`.
- Local dev server started at `http://localhost:3000`; unauthenticated `GET /meals` returned HTTP 200. This is a compilation/HTTP smoke check, **not** browser acceptance or proof of an authenticated plan.

Initial sandbox Node tests failed with `spawn EPERM`. Running without per-file child isolation allowed targeted checks but the full suite still had five existing CLI child-process failures (233 pass/5 fail). The final normal suite was rerun with the required process permissions and all 238 tests passed; none were removed or skipped. A nested executor permission-bound command caused a long wait and was interrupted; execution resumed without changing test criteria.

## Commits

- `c1b8cbe` — cost presentation RED tests
- `3af205d` — scoped cost panel and pantry controls
- `9bc113e` — conservative pack estimate RED tests
- `3e2f1e4` — opt-in strict pack pricing and estimate projection
- `18dbdc6` — approved route and pantry RED tests
- `37fc837` — approved shopping API estimate integration
- `09011be` — additional food-form and tiny-quantity regression coverage

## Remaining risks and handoff

The undated static catalogue is incomplete. An honest supported day may show a partial known subtotal, not a complete quote; no current retailer stock, live prices or licensed feed is implied. No evidence-backed density, count-to-mass, raw/cooked or product substitutions were invented to fill gaps. Monetary estimates cannot establish product allergy suitability.

Parent owns STATE metadata and Jira. Keep SCRUM-29 In Progress until a real browser verifies desktop/mobile 390×844, explicit ownership deduction, plan swap/reload invalidation and retained recipe quantities; then parent may move it to Review with evidence. Do not start SCRUM-30 or unrelated cards from this task. Existing dirty SCRUM-28 summary and private/untracked snapshots were left untouched.

Suggested Jira update: “SCRUM-29 implementation committed on codex/scrum-29-shopping-cost. Reuses strict existing pack pricing, separates buy-packs/food-used costs, keeps missing/undated evidence explicit, and validates explicit ownership against the approved ledger. 238 orchestration tests pass; TypeScript passes; lint 0 errors/9 existing warnings; code review no blocking findings. Local /meals HTTP200. Remains In Progress pending actual desktop/mobile pantry and swap/reload acceptance. No merge/deployment.”
