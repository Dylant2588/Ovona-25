# MVP reset Phase 1 requirements

Approved scope source: user approved Phase 1 planning and implementation on 2026-10-28, then explicitly authorised local infrastructure installation. Automated implementation and real isolated database checks passed on 2026-10-29; final browser acceptance remains pending.

- BASE-01: An authorised reviewer can approve a valid pending draft into a new reviewed version; unreviewed content cannot enter planning.
- BASE-02: Required source, rights, ingredient, nutrition and cooked attestations are validated as explicit boolean true values; malformed/unauthorised requests fail before writes.
- BASE-03: Review persistence handles version conflicts and concurrent requests without partial approval or loss of evidence; attribution and import evidence remain linked.
- BASE-04: Reviewed vegetarian, vegan and pescatarian candidates survive dietary admission where appropriate; unsuitable candidates fail closed. Saved restrictions cannot be relaxed by a request.
- BASE-05: Required safety preference fields are never silently omitted by compatibility fallbacks. Unsupported persistence returns an actionable failure and does not report a successful complete save.
- BASE-06: Existing test failures are classified and resolved with meaningful behavioural coverage; no safety checks are weakened merely to make tests pass.
- BASE-07: Existing orchestration tests, TypeScript checks and ESLint pass; regression tests exercise the real route/service path, not only helper replicas.
- BASE-08: Migration bootstrap/order, grants/RLS and approved-version protection are exercised against an explicitly disposable database, with anonymous, two user identities and reviewer/service contexts. Static SQL regex tests alone are insufficient.
- BASE-09: A verification record states which checks actually ran, their environment and outcomes, and any blocked checks. No production database, live recipe review, deployment or dependency installation is authorised by this plan.

Out of scope: full ingredient-derived nutrition; catalogue expansion; AI adaptations; plan/shopping atomic revisions; retailer catalogue/feed implementation; general auth rewrite; broad UI redesign; legacy deletion.

## Execution status

| Requirement | Evidence status |
|---|---|
| BASE-01 | Lifecycle/route tests and actual persisted reviewed-version transitions pass |
| BASE-02 | Verified locally: five true attestations, authenticated actor and invalid-request no-write paths |
| BASE-03 | Actual conflict, rollback, immutable evidence and attribution tests PASS on isolated PostgreSQL |
| BASE-04 | Admission verified locally; complete vegan scheduling retains a separate pre-existing plant-category policy gap |
| BASE-05 | Parser/route contract and actual ownership, omission, transaction and concurrent union tests PASS |
| BASE-06 | Nine historical failures classified and corrected with safety assertions retained; legacy feasibility guarantee explicitly deferred |
| BASE-07 | 103/103 tests, zero skips; TypeScript and quantity regression pass; lint zero errors/ten existing warnings |
| BASE-08 | Guard 4/4 pass; real migration/RLS/concurrency/rollback suite 8/8 PASS, zero skips |
| BASE-09 | Explicit evidence; local tooling installed with permission; no live migration/deployment/application dependency changes |

Automated Phase 1 gates passed; browser acceptance remains outstanding and Phase 2 has not started. No production rollout was performed.

## Phase 2 authorised requirements

Authorised 2026-10-29. Full acceptance criteria: `phases/02-catalogue-and-nutrition/02-CONTEXT.md`; executable mapping: its README and plans.

- CAT-01: Precise positive quantities/servings and evidence-backed compatible unit conversion; ambiguous conversions fail closed.
- CAT-02: Deterministic batch/per-serving nutrition from complete versioned exact food snapshots, with reproducible provenance and tamper detection.
- CAT-03: Calculated evidence validation at import/review/planning boundaries; new approvals require it, existing approved legacy records remain honestly compatible.
- CAT-04: Real approval/scheduler-backed catalogue coverage; counts alone never imply feasible plans.
- CAT-05: Reproducible real-source pending preparation, with human rights/allergen/method/cook-through review and genuine reviewed coverage explicitly outstanding where applicable.
- CAT-06: Meaningful regression and isolated database checks; no hosted writes, deployment or dependency installation.

### Phase 2 execution disposition — 2026-10-29

CAT-01–04 software and CAT-06 automated gates verified: 147/147 tests, 11/11 real disposable database tests, TypeScript/quantity checks pass, lint zero errors/ten existing warnings, independent review clean. CAT-05 preparation delivered with one genuine source-backed pending recipe; full reviewed calculated catalogue remains a human/content gate. Actual hosted approved recipe snapshot was read only (38 legacy approved, zero calculated); no user plan/preferences/shopping data queried or changed. Browser evidence and limitations: `phases/02-catalogue-and-nutrition/02-VERIFICATION.md`. One earlier Phase 1 timing-specific in-flight identity scenario remains unexecuted. No Phase 3 or hosted rollout.
