---
status: ready_for_review
ticket: SCRUM-1
updated: 2026-10-30
---

Scope: saved and requested preferences, safety-preserving deterministic fallback, readable ingredient quantities. Reuse existing reviewed catalogue, atomic preference RPC, scheduler, approval boundary and formatters. Do not merge, deploy, start another ticket or mark Done. Existing unrelated work is preserved.

Confirmed gaps: requested food likes omitted in context; explicit zero carb/fat targets replaced by defaults; cuisine matching only examines recipe title. Hosted preference RPC now exists (anonymous probe returns 42501 rather than PGRST202). Deployed Vercel UI still fails generation; local changes are not deployed and require approval before release.

Baseline: 171/172 tests passed inside sandbox; redirect HTTP fixture could not receive loopback request. Exact fixture rerun with loopback access: 4/4 passed. No tests skipped or assertions weakened.

Plan: repair confirmed preference gaps, add regression coverage for active generation fallback and cuisine ranking, run full tests/type/lint, map acceptance criteria and record deployment limits in Jira before Review.

## Implementation and evidence

- `frontend-new/lib/generation/context-builder.ts`: merge requested and legacy saved food likes; preserve explicit zero carbohydrate/fat targets.
- `frontend-new/lib/preference-options.ts` and `app/meals/page.tsx`: case-insensitive saved cuisine selection/toggle, preserve unknown values, prefer canonical dietary mode including explicit Mixed. Existing canonical allergy rendering/toggle is reused.
- `frontend-new/lib/recipes/types.ts`, `recipes/candidates.ts`, `orchestration/score.ts`, `orchestration/candidate-adapter.ts`: optional curator-provided cuisine passes to ranking; normalized metadata/title terms affect ranking; planning-brief cuisine preferences retained. No AI-inferred recipe classifications or hard cuisine exclusions.
- `frontend-new/lib/orchestration/schedule.ts` and `portions.ts`: shared-portion shortcut checks individually rounded calorie/protein totals; independent solver tries separate calorie/protein rounding margins. Actual current-profile reproduction originally failed final approval at 1977 kcal versus 1976 maximum; corrected pipeline passes all seven days.
- Reuse existing atomic preference save, draft handling, safety unions, reviewed recipe admission, deterministic retry, final recipe approval and ingredient formatters. No dependencies, schema changes, migration application, merge or deployment performed.

## Acceptance criteria

1. Selected preferences reach generation: context and option regressions cover saved/requested likes, cuisine values and canonical diet; existing draft/save/signature tests retained.
2. Allergies/never-foods/diet/prep remain hard constraints: existing dietary and approval suites pass; actual current hosted profile read through local pipeline completes 7 days / 35 meals with final approval.
3. AI failure falls back: new actual-entrypoint tests cover timeout, refusal, malformed output and invented/unreviewed recipe IDs; real deterministic scheduler and final recipe approval run. Missing AI key and exhausted ranked search tested; final approval failure propagates.
4. Readable ingredient quantities: existing production formatter tests pass for 14.1725g -> 14g, 583.4498g -> 583g, fractional counts, small nonzero values, and slice/whole-item distinction without mutating the ledger.

## Final checks

- `npm run test:orchestration`: 182 passed, 0 failed, 0 skipped. Network fixture requires permitted local loopback; initial sandbox failure recorded above and resolved by rerunning with network access, not skipping.
- `npx tsc --noEmit --incremental false`: passed.
- Focused ESLint including changed planner page: 0 errors; 4 pre-existing hook/directive warnings plus stale baseline-data notice.
- Current saved-profile pipeline, no AI call and all database mutations blocked: 7 days / 35 meals, all final daily recipe/nutrition checks passed, approximately 1.63 seconds. No generated replacement persisted by this diagnostic.
- Production authenticated save of unchanged existing preference choices succeeded. Reload exposed old deployed checkbox case mismatch; current local allergy helper already addresses that, and this ticket completes cuisine/diet reload fixes.

## Review and release limits

Changes remain local in a pre-existing dirty working tree; no commit/PR/merge/deployment claimed. Production Vercel still runs older code and fails generation. Post-approval release must include the relevant prior planner/preference fixes as well as this ticket, then authenticate and smoke-test save/reload/generate/ingredients on the deployed app. Current localhost browser is signed out, so an authenticated local UI smoke test was not claimed. Review must verify release scope instead of including unrelated working-tree changes.

Cuisine/likes/avoid foods are soft ranking signals as stated in the drawer, not guaranteed exclusions. Missing catalogue cuisine metadata remains unknown; only curator metadata or explicit title terms rank as cuisine matches. Legacy onboarding taste/complexity settings have no reviewed flavour metadata and are not represented as new hard filters. No unsafe recipe synthesis occurs when the reviewed catalogue cannot meet hard constraints. Existing generic unchecked warning on stored-plan reload remains a disclosed separate limitation.
