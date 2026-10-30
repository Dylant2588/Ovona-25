---
phase: 02-catalogue-and-nutrition
status: software_verified_content_review_pending
updated: 2026-10-29
---

# Phase 2 verification

Implemented the five scoped plans. Software gates below pass; the complete product goal remains open because genuine calculated-only reviewed catalogue coverage is not yet available. No Phase 3 work or hosted rollout was performed.

## Executed checks

| Check | Actual result | Evidence |
|---|---|---|
| Full orchestration/unit/route/CLI suite after final ID/version queue correction | **147/147 PASS**, zero failures/skips; 4186.9034ms | `02-TESTS.log` |
| TypeScript `npx tsc --noEmit --incremental false` | PASS after final queue correction | Exit 0, no diagnostics |
| Full `npm run lint` | Zero errors, ten existing warnings | `02-LINT.log`; subsequent final queue-page/helper/test lint also exit 0 |
| Ingredient quantity regression | PASS | `node scripts/ingredient-quantity-regression-test.cjs` |
| Actual disposable PostgreSQL/Supabase integration | **11/11 PASS**, zero failures/skips; 25796.2328ms | `02-DATABASE-TEST.log` |
| Independent source review | 37 files, zero unresolved findings; focused independent checks pass | `02-REVIEW.md` |
| Source preparation | Exact official-source calculation reproduces pending output; trace/unknown rejected | `02-04-SUMMARY.md`, preparation tests in full suite |

Database tests required the explicit isolated target guard and verified an initially empty public schema. Separate unlinked workdir: `%LOCALAPPDATA%/OvonaTools/supabase-disposable`, API `http://127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322`. Only its synthetic data was reset. Ports were explicitly corrected to loopback. Both migration orders, grants/RLS, reviewer role checks, immutable versions/events, atomic pending import/audit, canonical source hashes, concurrent conflicts, legacy-new-approval denial and injected-failure rollback were exercised on the real database. The test target is now populated; rerunning requires a fresh guarded disposable target, not bypassing its fresh-schema check.

The localhost CLI HTTP test requires network-enabled execution; it passed in that environment. An earlier restricted-sandbox connection failure was not fixed by weakening the test. Earlier in-flight partial-suite checkpoints are superseded by the final 147/147 stable run.

## Actual application/browser acceptance

Separate app snapshot: `http://127.0.0.1:3004`, connected only to the disposable database. No app environment file or dependencies were copied into the snapshot. It reuses the installed dependencies and has its own build output.

- Actual authenticated `/api/recipe-import` returned `{ok:true, imported:2}` for one clearly synthetic calculated fixture plus the real-source unreviewed demonstrator. Importer/source evidence was persisted atomically.
- Reviewer queue displayed a deliberately malformed draft as an ID/version and repair diagnostics. It did not crash or hide the other valid drafts, and offered no approval for the malformed record.
- The CoFID-backed pending bowl displayed batch quantities, two servings, 373 kcal / 19g protein / 66g carbohydrate / 6g fat per serving, exact source food codes, raw/cooked-drained states and pinned revisions. All five attestations remained unchecked and approval disabled.
- Only the explicitly synthetic fixture received test attestations. Browser approval succeeded and the queue changed from eight to seven pending drafts. A read-only disposable SQL check confirmed the original version closed, version 2 approved with `ingredient_calculated_v1`, and review evidence linked to its real import hash. The real-source bowl remained `pending_review`.
- Final queue selection uses both recipe ID and version; its regression test proves distinct pending versions are selectable, including IDs containing colons.
- A legacy-method pending fixture displayed “Legacy nutrition · preparation required” and an actionable calculated-evidence warning; approval stayed disabled. Existing approved legacy records remain readable through the separate compatibility path.

Earlier Phase 1 preference browser checks also passed after correcting missing onboarding bearer/prep limits, canonical allergy display, and actionable errors inside the preference drawer. Session invalidation and ordinary-account denial were verified. The narrower timing-specific identity change during an in-flight initial/manual queue load remains unexecuted; see `../01-trustworthy-baseline/01-HUMAN-UAT.md`. This report does not claim that timing scenario was verified.

Browser proof: `02-browser-calculated-draft.png` shows the real-source pending draft, exact calculation/source breakdown, unchecked attestations and disabled approval, alongside the completed synthetic-approval message. Real recipe rights, ingredient/supplier/allergen information and a cook-through were not auto-attested.

## Catalogue evidence and requirement disposition

Read-only hosted query selected only approved recipe records: **38 legacy-attested approved identities, zero ingredient-calculated versions**. No user preferences, saved plans or shopping data were queried or changed. Actual coverage results and operational work are in `02-CATALOGUE-READINESS.md` and `02-hosted-reviewed-coverage.json`.

| Requirement | Disposition |
|---|---|
| CAT-01 precise quantities/conversions/servings | Software verified; unsupported/ambiguous conversions fail closed |
| CAT-02 reproducible ingredient nutrition | Software verified; real-source pending demonstration prepared |
| CAT-03 import/review/planner boundaries | Software and actual DB/browser paths verified; existing legacy approved reads preserved, new approvals require calculated evidence |
| CAT-04 actual catalogue coverage | Diagnostic implementation verified and run against current approved catalogue; calculated-only readiness fails honestly |
| CAT-05 sourced preparation and reviewed content | Preparation delivered; genuine human review and complete calculated catalogue remain outstanding |
| CAT-06 evidence and regression gates | PASS for executed software/DB checks; one explicitly recorded Phase 1 timing subcheck remains unexecuted |

## Remaining gate

Prepare calculated pending successors for the existing catalogue, verify exact food/state/conversion mappings and complete actual accountable recipe review. Expand restrictive/quick-meal coverage and resolve the known broad plant-protein cap before claiming full vegan support. Rerun coverage on each approved batch. Do not treat a synthetic fixture or one pending bowl as a complete reviewed catalogue.

Two additive Phase 2 migrations are prepared and tested locally only: `20261029090000_calculated_pending_import.sql` and `20261029091000_calculated_review_policy.sql`. The Phase 1 migrations remain unapplied to the configured hosted project too. Hosted write paths fail closed until a separately reviewed rollout; no deployment occurred. No application dependencies were installed and no commits were made during this continuation.
