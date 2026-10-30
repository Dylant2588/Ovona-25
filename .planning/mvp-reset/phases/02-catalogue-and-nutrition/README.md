# Phase 2 execution plans

Scoped MVP reset phase, authorised 2026-10-29. Do not use generic historical `/gsd-execute-phase 2`; use these exact plan paths. No hosted writes, dependency installs, deployment or Phase 3 work.

Current status: all five plans' software implemented and verified (147/147 tests, 11/11 actual DB checks, TypeScript/quantity PASS, lint zero errors/ten existing warnings, browser acceptance). Genuine calculated-only reviewed catalogue remains a content gate. See `02-VERIFICATION.md` and `02-CATALOGUE-READINESS.md`; this is not a declaration that the whole Phase 2 product goal is achieved.

| Wave | Plan | Deliverable | Complexity |
|---|---|---|---|
| 1 | 02-01-PLAN.md | Quantity/source contracts and deterministic nutrition | High |
| 2 | 02-02-PLAN.md | Import/review/planner gates and reviewer diagnostics | High |
| 2 | 02-03-PLAN.md | Shared candidates and actual scheduler-backed coverage | Medium |
| 3 | 02-04-PLAN.md | Sourced pending preparation and integrated verification | High |
| 3 | 02-05-PLAN.md | Atomic pending ingestion and malformed-draft diagnostics | Medium |

Wave 2 ownership does not overlap: Plan 02 owns validation/import/review surfaces and existing approval tests; Plan 03 owns candidate extraction, adapter and coverage surfaces. Both consume Plan 01 contracts. Plan 04 is parent-owned integration/content preparation after those contracts stabilize.

## Decision coverage

| Locked decision / requirement | Plan/tasks | Coverage |
|---|---|---|
| Precise whole-batch quantities; servings divide once (CAT-01) | 01/1–2, 02/2, 04/1 | Full |
| Exact food identity/state independent from broad allergy taxonomy (CAT-02) | 01/1–2, 04/1 | Full |
| Versioned reproducible evidence; fail closed on missing/ambiguous values (CAT-02) | 01/1–2, 02/1, 04/1 | Full |
| Existing approved legacy retained; new approval requires calculated evidence (CAT-03) | 02/1–2 | Full |
| Existing review, allergy gates, scheduler reused (CAT-03/04) | 02/1–2, 03/1 | Full |
| Real coverage and actionable restrictions/prep/variety gaps (CAT-04) | 03/1–2, 04/2 | Full |
| Concrete sourced pending content; no fabricated rights/cook-through (CAT-05) | 04/1–2 | Full with honest content gate |
| Tests, no live changes/dependencies/deployment (CAT-06) | All tasks; 04/2 integrated gate | Full |
| Later phases remain deferred | All plan boundaries | Full |

Real reviewed coverage cannot be auto-attested. If pending preparation and software pass while genuine source/rights/cook-through review remains outstanding, final phase status must say so. This is an operational content gate, not permission to shrink implementation or substitute synthetic data.

Requirements are defined in 02-CONTEXT.md; the parent updates scoped ROADMAP/REQUIREMENTS/STATE without touching historical planning. No commits in this work session.

Execution amendment: Plan 05 closes an operational gap discovered in Plan 02: the old pending-import CLI never wrote import audit evidence. Independent review found no architectural blocker in the amendment. Prepared pending records need an atomic authenticated ingestion path to reach review; approved records and real user data remain untouched. The malformed-draft diagnostic correction is also included so one bad draft cannot crash the queue.
