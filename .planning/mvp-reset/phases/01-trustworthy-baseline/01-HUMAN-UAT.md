---
status: partially_verified
phase: 01-trustworthy-baseline
source: 01-GOAL-VERIFICATION.md
updated: 2026-10-29
---

# Browser acceptance record

Original automated baseline gates passed: 103 unit/route tests and 8 actual database tests. Browser checks below ran against the separate application at `http://127.0.0.1:3004`, connected only to the disposable localhost database, using a synthetic account and explicitly synthetic recipe. The existing user-data project was not repointed or mutated.

1. **Preference forms — PASS:** onboarding saved the standard 30-minute limit and Dairy restriction, then redirected successfully. Planner subsequently saved an explicit 15-minute limit; after reload the 15-minute value persisted and Dairy remained checked. Renaming the RPC only in the disposable database injected an unsupported-schema response: the actionable safe message appeared inside the open drawer, the attempted 10-minute value remained available for retry, and the persisted database value remained 15 minutes. No success or regeneration occurred for the failed save. The original RPC function was restored and confirmed. Browser gaps and fixes are documented in `01-onboarding-gap-SUMMARY.md`.
2. **Reviewer approval — PASS for synthetic legacy-method fixture:** selected the explicitly synthetic pending recipe, supplied all five test attestations, approved it, observed the success message and queue refresh from 3 to 2 pending drafts. This checks Phase 1's existing nutrition method, not Phase 2 calculated nutrition or any real cook-through/rights claim.
3. **Reviewer identity — PASS for session invalidation and ordinary-account switch:** temporarily invalidated only the synthetic reviewer account in local Auth. The reviewer page showed sign-in required and zero drafts. Signed in as a different synthetic ordinary account: the page showed the role-required message and zero drafts, with no prior reviewer queue or attestations. Evidence: `01-browser-identity.png`. The narrower timing-specific account/token change during an in-flight initial/manual reload remains unexecuted; no such browser proof is claimed.

Browser flows: preferences, synthetic approval and identity denial passed. One timing-specific in-flight race subcheck remains pending. Evidence in this directory:

- `01-browser-review.png`
- `01-browser-preferences.png`
- `01-browser-safe-failure.png`

No live migration, user-data application repointing or deployment has occurred. Screenshot files represent the synthetic localhost acceptance environment.

## Automated checkpoint after browser fixes

`node --test tests/orchestration/onboarding-preferences.test.ts`: 6/6 passed, zero skips. The TypeScript run immediately after those fixes passed; focused ESLint reported zero errors and four existing meals-page warnings.

A full orchestration glob checkpoint ran while Phase 2 files were being created: **110 tests, 109 passed, 1 failed, zero skipped, 1148.55 ms**. The one failure was a file-level startup failure in the newly in-flight `recipe-nutrition.test.ts`; an immediate focused diagnostic after file creation completed passed **5/5**, zero skips, 105.42 ms. This mixed checkpoint is not represented as a clean full-suite result; the parent must run the final stable Phase 2 gate after concurrent edits settle.
