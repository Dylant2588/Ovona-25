---
phase: 01-trustworthy-baseline
status: human_needed
date: 2026-10-29
database_verified: true
live_migrations_applied: false
---

# Phase 1 verification evidence

**Original automated local gates: PASS. Preference browser acceptance and synthetic reviewer approval: PASS. Reviewer identity/in-flight acceptance remains pending; no live rollout.** After explicit installation permission, a disposable Supabase stack was created and tested at API `127.0.0.1:54321` and PostgreSQL `127.0.0.1:54322`. Both published ports were inspected and restricted to loopback. Browser acceptance used a separate application at `127.0.0.1:3004`. No application migration has been applied to the configured user-data project.

## Requirement matrix

| Requirement | Current status | Evidence / limitation |
|---|---|---|
| BASE-01 | Automated and synthetic approval browser PASS | Production route-export tests, actual persisted N+1 transitions and synthetic browser approval/queue refresh; reviewer identity/in-flight browser subcheck pending |
| BASE-02 | Local PASS | Five explicit true attestations, verified identity and invalid-request zero-write tests |
| BASE-03 | PASS on disposable PostgreSQL | Concurrent approvals have exactly one winner; immutable version/event protection, import linkage and injected-event rollback passed |
| BASE-04 | Local admission PASS; vegan full-week policy gap | Effective-constraint/dietary matrix passes; genuine vegan recipes remain blocked by pre-existing two-per-day broad plant-protein category limit |
| BASE-05 | Automated and browser PASS | Actual omission retention, owner isolation, three-store allergy union, concurrent first saves and insertion-failure rollback; browser standard/strict preparation persistence, checked allergy reload, actionable visible unsupported-schema failure and unchanged database value |
| BASE-06 | Local PASS | All nine baseline failures classified in 01-FAILURE-MATRIX.md; safety negatives and original bands retained; legacy feasibility guarantee explicitly not claimed |
| BASE-07 | Local PASS | Final parent run: 103/103 orchestration tests, zero skips; nonincremental TypeScript exit 0; quantity regression PASS; full ESLint zero errors and ten existing warnings |
| BASE-08 | PASS on disposable PostgreSQL | Both migration orders, access grants/RLS, version protection, races and rollback executed; 8/8 tests passed, zero skips |
| BASE-09 | PASS for honest reporting | Tooling installation explicitly authorised; local vs live outcomes distinguished; no live mutation or deployment |

## Executed Plan05 checks

Original combined local gates: 103/103 orchestration tests, zero skips; TypeScript exit 0; ESLint zero errors/ten existing warnings; quantity regression PASS. Code review found and resolved the default-limit payload and stale reviewer-queue issues. Real PostgreSQL testing additionally caught a PL/pgSQL CASE parsing error in the new preference migration; parenthesised CASE expressions fixed it. The harness now strips inherited PG environment variables and stops after failed bootstrap before committing migrations. Subsequent isolated browser acceptance exposed and resolved missing onboarding bearer authentication, missing durable cooking-time limits, lowercase allergy checkbox hydration and modal error visibility/message preservation. Details and test evidence are in `01-onboarding-gap-SUMMARY.md` and `01-HUMAN-UAT.md`.

## Browser acceptance checkpoint — 2026-10-29

- Onboarding standard 30-minute limit plus Dairy save: PASS; successful redirect.
- Planner strict 15-minute limit and Dairy after reload: PASS.
- Unsupported-schema injection by temporarily renaming only the disposable RPC: PASS; safe actionable message inside drawer, attempted 10-minute field retained, actual database value still 15 minutes, no false success/regeneration. RPC restored and confirmed.
- Synthetic pending recipe approval: PASS; explicit synthetic test attestations and queue 3→2. No real recipe/source/cooked claim is inferred.
- Reviewer account/token switch during in-flight loads: not yet verified in the browser; parent check pending.

Screenshot evidence: `01-browser-review.png`, `01-browser-preferences.png`, `01-browser-safe-failure.png` in this phase directory.

The new browser-gap behavioural test file passes 6/6, with TypeScript pass and focused ESLint zero errors/four existing meals-page warnings. A requested full-glob checkpoint during concurrent Phase 2 file creation produced 110 tests / 109 passed / 1 file-level startup failure / zero skips in 1148.55 ms. The newly created `recipe-nutrition.test.ts` then passed an immediate focused diagnostic 5/5 in 105.42 ms. This is a mixed in-flight checkpoint, not a clean final full-suite gate; stable combined verification belongs to the parent after edits settle.

| Command (cwd frontend-new) | Actual result |
|---|---|
| `node --test tests/orchestration/database-target-guard.test.ts` | PASS: 4 tests |
| `node --test tests/database/baseline.integration.test.ts` without explicit environment | Historical negative guard test: exit 1 with BLOCKED before any connection |
| `.planning/mvp-reset/run-disposable-verification.ps1` with validated local stack | PASS: exit 0, 8/8 real database tests, zero skips; evidence in 01-DATABASE-TEST.log |
| `.\node_modules\.bin\tsc.cmd --noEmit --incremental false` | PASS: exit0, no diagnostics |
| Scoped ESLint for target guard and new tests | PASS: exit0 |

Target: local Docker project `supabase-disposable`, separate unlinked workdir `%LOCALAPPDATA%/OvonaTools/supabase-disposable`, PostgreSQL 17. Synthetic identities: owner A, owner B, reviewer, and first-save user. Migration files were applied in chronological order and with the structured/trusted pair reversed, each bootstrap in a rolled-back transaction before committed test setup. Concurrent review produced one success and one conflict; rollback snapshots matched their originals. No real account or application `.env.local` was read by this harness.

## Executed database scenarios — all PASS

1. Actual chronological bootstrap and both structured/trusted addition orders, including both new Phase1 migrations.
2. Catalog execution grants, anonymous/owner/service RLS, reviewer role recheck, and cross-owner denial.
3. Locked snapshot equality, exactly one winner under concurrent reviews, immutable approved-version/event protection and real/legacy evidence attribution.
4. Full rollback after injected review-event failure.
5. First-save concurrent safety updates, saved three-store allergy union, omitted hard-field retention, and rollback after injected allergy insertion failure.

The executable harness is `frontend-new/tests/database/baseline.integration.test.ts`. Setup requirements and target safety contract are recorded in `01-05-SUMMARY.md` and `01-LOCAL-TOOLS.md`. The database now contains synthetic fixtures and is intentionally preserved for diagnosis; a repeat full run requires a fresh disposable database, not bypassing the freshness guard. No scenario was skipped.

## Release and continuation limits

- New review and preference write paths still require rollout of the migrations to the configured application database. They are verified only in the local disposable database; absent RPCs in the live project still return an explicit error.
- Genuine vegan full-week generation remains a pre-existing policy gap; resolving precise protein-source diversity is follow-up work, not permission to weaken current caps or fabricate recipe metadata.
- Complete the remaining reviewer identity/in-flight browser subcheck against the isolated application before claiming full browser acceptance. Do not point destructive test fixtures at the project containing the user's plan.
- No deployment is authorised by this record. The user's later “let's do it” separately authorised scoped Phase 2 planning and implementation; it does not turn this partial browser record into a full sign-off or authorise live migration.
