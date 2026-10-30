# Phase 1 implementation plan: Trustworthy baseline

Prepared 2026-10-28; updated 2026-10-29. Status: **automated local gates passed; browser acceptance pending**. This is the MVP reset Phase 1, distinct from historical Auth + Onboarding Phase 1. See [verification evidence](01-VERIFICATION.md), [database test log](01-DATABASE-TEST.log), and [failure matrix](01-FAILURE-MATRIX.md).

Final checks: 103/103 unit/route tests and 8/8 real database tests, zero skips; TypeScript and quantity regression pass; ESLint zero errors/ten existing warnings. Migrations were applied only to the disposable local database. New review/preference endpoints still require later migration rollout to the configured application database. Full vegan scheduling retains its broad plant-protein cap limitation; legacy fallback feasibility is not guaranteed. Phase 2 has not started.

## Scope and delivery order

| Wave | Plan | Deliverable | Complexity | Agent execution estimate |
|---|---|---|---|---|
| 1 | [01-01](01-01-PLAN.md) | Validated review conversion, strict attestations, server-verified reviewer and atomic version/evidence transition | M–L | 90–150 min |
| 1 | [01-02](01-02-PLAN.md) | One saved/requested restriction union and evidenced dietary candidates reaching scheduling | M | 60–100 min |
| 1 | [01-03](01-03-PLAN.md) | Explicit preference patch semantics and atomic owner-scoped safety persistence | M–L | 90–150 min |
| 2 | [01-04](01-04-PLAN.md) | Classified baseline failures, meaningful green tests and scoped lint corrections | M | 60–120 min |
| 3 | [01-05](01-05-PLAN.md) | Real isolated migration, RLS, race and rollback tests; evidence-based final disposition | M | 60–120 min once environment exists |

Wave 1 plans own different files and can run independently; sequential execution is also valid. Plan 04 depends on all Wave 1 outputs. Plan 05 follows Plan 04 and uses migrations/services from Plans 01/03. Total estimate: approximately 6–11 hours of agent execution, excluding environment provisioning, approvals, unexpected genuine defects and review revisions. Estimates are not calendar delivery commitments.

## Requirement coverage

| Requirement | Plan/tasks | Coverage |
|---|---|---|
| BASE-01 | 01 tasks 1–3 | Full |
| BASE-02 | 01 tasks 1/3 | Full |
| BASE-03 | 01 task 2 + 05 task 2 | Full, real DB proof required |
| BASE-04 | 02 tasks 1/2 | Full |
| BASE-05 | 03 tasks 1–3 + 05 task 2 | Full, real DB proof required |
| BASE-06 | 04 task 1 | Full |
| BASE-07 | 01/02/03 route/service tests + 04 task 2 | Full |
| BASE-08 | 05 tasks 1/2 | Full, environment prerequisite |
| BASE-09 | 04/05 evidence reports | Full |

## Locked decision coverage

| Context decision | Implementation coverage |
|---|---|
| Planning only this turn; stop before implementation | All documents describe future execution; no app/SQL changes made |
| Current stack and reviewed pipeline reuse | 01 converter/approval, 02 constraints/eligibility, 03 Next/Supabase, 04 installed tooling |
| Preserve historical plans and uncommitted work | Scoped context in every plan; no generic phase-number routing |
| Hard allergies, may-contain, diet, never-foods, prep, review and seven-day gates | 01/02/03 and regression matrix in 04 |
| Dislikes remain soft | 02 union and 04 corrected assertion with never-food negative control |
| Convert pending before approved eligibility | 01 task 1 |
| Review/safety atomicity, general plan/shopping atomicity deferred | 01 task 2, 03 task 2; deferred list below |
| No dependency installation without approval | Installed tooling in tests; missing DB tools produce BLOCKED |
| No production migration/deployment; disposable DB actual proof | 05 target guard and mandatory integration gate |
| No auto-advance | Execution handoff and stop condition |

## Reuse, changes and uncertainty

Reuse recipeRecordErrors(), approveImportedRecipeVersion(), approveRecipe(), loadServerConstraints(), buildPlanningInput(), existing scheduling and Node test runner. Keep generic dietary eligibility; issue tags only after server evidence passes approval. Keep legacy code unless an in-scope obsolete route helper is replaced.

Two additive migrations are planned, not written: one review transition/event RPC, one safety preference transaction. Their test application is restricted to an explicitly disposable environment. No recipe bulk import, automatic review attestation, ingredient/nutrition rewrite, production data repair or dependency upgrade is included.

The real recipe_imports linkage is incomplete in current import scripts. Preserve actual imported evidence where present; otherwise record an explicitly legacy snapshot with computed content hash and unknown original importer. Do not invent prior review/import history. A mismatched approved-version/source digest must cause conflict, not approval.

The original database-tooling prerequisite was resolved with explicit user permission on 2026-10-29. Checksum-verified CLI/client tools and a local Docker-backed Supabase stack are installed, and the mandatory real database gate passed. No hosted resource was created or modified. Browser acceptance remains outstanding.

## Acceptance and release gate

1. Valid draft approval creates exactly one new reviewed version and attributed evidence; missing attestations, unknown ingredients and unauthorised callers cause zero writes.
2. Safe reviewed recipes for the diet matrix reach real eligibility/scheduling while saved restrictions cannot be replaced by client defaults.
3. Omitted preference keys preserve existing values; unsupported schema returns explicit non-success; transaction failures/concurrent additions preserve safety records.
4. Full orchestration suite, nonincremental TypeScript, ESLint with zero errors, and quantity regression pass. No required test skips or safety tolerance changes.
5. Real isolated migrations, grants/RLS, version protection, simultaneous review and allergy rollback tests pass. Missing infrastructure is BLOCKED, never a mocked PASS.

## Rollout and rollback (future execution)

Implement and review scoped source/migration diffs; run unit/route tests; apply migrations only to verified disposable target; run all local and DB gates. Record exact outcomes before proposing any deployment. This plan does not authorise production rollout. Keep new database objects additive. If local changes fail, revert only scoped implementation commits, preserving unrelated work and review evidence; do not drop production tables or rewrite historical migrations. An unavailable new RPC must fail closed with 503 instead of invoking unsafe legacy writes.

## Exact execution handoff

When implementation is requested, provide this prompt: **Execute only the five plans in `.planning/mvp-reset/phases/01-trustworthy-baseline/` using `.planning/mvp-reset/ROADMAP.md` and `.planning/mvp-reset/REQUIREMENTS.md`; follow dependency waves; preserve historical plans and unrelated changes; do not deploy, install dependencies or touch production databases; stop after Phase 1 verification. Report unavailable disposable database checks as BLOCKED.**

Do not run generic `/gsd-execute-phase 1`: current GSD lookup resolves the historical phase. An executor must consume these explicit scoped plan files; automation must not overwrite historical `.planning/STATE.md` or mark that unrelated phase complete.

Deferred: Phases 2–5, ingredient-derived nutrition, catalogue expansion, AI adaptations, general plan/shopping revisions, product catalogue and retailer feeds, broad auth/UI refactors and legacy deletion.
