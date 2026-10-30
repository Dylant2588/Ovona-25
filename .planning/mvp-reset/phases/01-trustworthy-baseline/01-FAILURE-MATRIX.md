# Phase 1 baseline failure matrix

Date: 2026-10-28. Baseline before Plan 04: 97 tests, 88 passed, the same nine audit failures. Final combined suite at verification: 103 tests, 103 passed, zero failures/skips. Other Phase 1 agents added tests concurrently; this count is the actual combined run, not just Plan 04's additions. No safety-tolerance changes.

| Original failing assertion | Root cause and policy evidence | Correction and regression proof | Status |
|---|---|---|---|
| `meal-approval`: dislikes chicken must reject | Dislikes are intentionally soft in `server-constraints.ts` and scoped context; neverFoods is hard in `approval.ts` | Assert dislike admissible and corresponding chicken neverFood rejected; allergy and unknown-diet assertions retained | PASS |
| `trusted-planning-schema`: accepted/eaten only | Actual structured/trusted migrations intentionally include rejected feedback | Require accepted/eaten/rejected while retaining provenance, service-only writes, RLS and immutable-trigger assertions | PASS (SQL source check only) |
| `replace`: immutable replacement success | Candidate fixtures omit proteinType; scheduler groups unknown metadata together and caps it at two daily uses, so fixture never reaches replacement | Explicit varied protein metadata; retain exact target replacement, unchanged source, score explanation and reference identity assertions | PASS |
| `replace`: unsafe/repeated candidates refusal | Same fixture precondition failure | Same metadata correction; retain insufficient_replacement_candidates and unchanged original assertion | PASS |
| `validate`: inclusive bands | Missing metadata prevents valid four-slot schedule before nutrition checks | Explicit varied source metadata; same 0.95 calorie / 0.98 protein boundary values | PASS |
| `validate`: portion and household materialisation | Same fixture admission/search obstruction | Same metadata correction; retain portion increase, household multiplier and exactly-once serving assertions | PASS |
| `validate`: impossible macros produce repair failure | Scheduler now rejects an infeasible day during selection, before post-schedule repair | Assert scheduler insufficiency; separately pass an unrecoverable seven-day schedule to real validateAndRepairWeek and require repair_exhausted; unsafe allergy refusal retained | PASS |
| `validate`: practical basket code | Scheduler's early practical guard refuses before final validator executes | Assert early scheduler insufficiency; separately materialise chicken-heavy ingredients on a known valid schedule and require practical_quantity_exceeded from real validator | PASS |
| `meal-variety`: legacy restricted 1830kcal/216g profile always feasible | Static fallback now refuses excessive practical protein rotation; a looser 2000/160 control can generate protein overshoot and fail enforcement. The active reviewed generator has separate success coverage. A second stale assertion rejected all oat snacks despite its stated purpose being poultry-labelled oat pots | Parent-approved contract: exact impossible target must refuse; generated candidates and swaps must either pass every original macro/portion band or fail without mutation, never present partial as checked. Retained allergy, recipe, cadence, variety and five-seed checks. Poultry/oat check now checks poultry only. Known-passing synthetic nutrition verifies enforcement idempotence without claiming generator feasibility | PASS; legacy fit guarantee deferred |

Additional negative regression: missing protein metadata still refuses; existing homogeneous-protein cap tests remain. No synthetic vegan records were relabelled to evade the plant-category policy.

## Local checks executed

- Four corrected test files: 16/16 pass.
- Full orchestration suite: 103 tests, 103 pass, 0 fail, 0 skipped (native exit 0).
- TypeScript `--noEmit --incremental false`: native exit 0, no diagnostics.
- Reviewer-page ESLint: native exit 0; no suppressions added.
- Ingredient quantity regression: native exit 0, PASS.
- Full ESLint: native exit 0, zero errors and ten existing warnings; final rerun recorded in summary.

## Legacy fallback investigation

Read-only in-memory grid probes tried 24 calorie/protein combinations for the five-meal restricted profile and 27 combinations for restricted three-meal/unrestricted three/five-meal controls, each against up to five deterministic random values. No control passed complete-week enforcement for all tested values. This is a bounded diagnostic, not proof of universal infeasibility. A representative 2000kcal/160g plan has days at 194–206g protein and enforcement correctly reports failure instead of declaring them checked.

Parent disposition: do not rebuild the legacy generator or claim it can always satisfy these targets. Test its fail-closed validation boundary instead: successful enforcement must satisfy all original bands; failed enforcement preserves the original untrusted candidate. All five deterministic seed checks and safety-negative cases remain. General static generation is legacy and not the active reviewed pipeline; its lack of a macro-fit guarantee remains a documented follow-up, not a claimed fix.

## Reviewer UI check

The signed-out state is derived from authentication. Initial loading now uses an abortable asynchronous fetch and updates state only from completion callbacks. Manual reload remains available after a successful review. Fetch/JSON errors clear loading and review submission uses finally to clear saving. Token dependencies capture a scalar. Independent review also found and closed the token-switch race: workspace state is keyed to the token and unmount guards ignore stale manual reload/review results. Old queue, attestations and messages cannot render under a new identity. No visual redesign or browser write was performed.

## Limits

No migrations were applied and no live database data was changed. Real transaction, grant/RLS and race validation remain blocked on a disposable environment, as required by Plan 05.
