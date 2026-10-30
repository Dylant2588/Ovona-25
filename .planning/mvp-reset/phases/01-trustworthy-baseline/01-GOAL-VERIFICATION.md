---
phase: 01-trustworthy-baseline
verified: 2026-10-29
status: human_needed
completion: local_automated_goal_verified_release_browser_checks_pending
score: 9/9 requirements supported by local automated evidence
overrides_applied: 0
database_verified: true
database_scope: disposable_local_only
re_verification:
  previous_status: gaps_found
  previous_score: 5/9
  gaps_closed:
    - Actual persisted review transition, concurrent conflict and rollback evidence.
    - Actual owner-scoped preference omission, first-save union and rollback evidence.
    - Actual migration bootstrap/order, grants/RLS and immutable-version evidence.
  gaps_remaining: []
  regressions: []
human_verification:
  - test: Exercise onboarding and planner preference forms against an isolated application instance connected to the tested disposable database.
    expected: Standard preparation saves as 30 minutes, stricter selections survive reload, unsupported-schema errors preserve entered values and cannot appear as successful saves.
    why_human: Production route exports and real database RPCs were tested separately; no browser instance was repointed to the disposable database.
  - test: Exercise reviewer approval, queue refresh and account/token switching in the isolated application instance.
    expected: All five attestations are required, approval creates one reviewed version, and old-session queue/messages/attestations never render for a new session.
    why_human: Automated route/database checks and source review do not establish visible browser state transitions.
---

# Independent Phase 1 goal verification

**Goal:** A valid pending recipe can enter the reviewed catalogue, approved dietary-safe recipes reach scheduling, required restrictions survive persistence, and release checks provide credible evidence.

**Re-verification 2026-10-29: the prior mandatory database blocker is closed.** All nine requirements now have local automated evidence, including real PostgreSQL/PostgREST transaction and permission tests. Browser release checks remain unverified, so the disposition is `human_needed`, not a production release certificate. This verifies the MVP reset scope, not historical Auth + Onboarding Phase 1. No override was applied. This verifier inspected source and the actual captured database-test output; it did not rerun SQL against the now-populated disposable environment, access the existing user-data project, modify application code, install software or create a commit.

## Requirement coverage

| Requirement | Verdict | Independent evidence and boundary |
|---|---|---|
| BASE-01 | VERIFIED locally | `proposeReviewedVersion()` converts the draft before `approveRecipe()`; actual POST tests exercise one RPC. Real disposable-database review creates exactly N+1 and closes the original draft. |
| BASE-02 | VERIFIED locally | `parseReviewRequest()` requires exactly five true named attestations. Actual route tests verify identity/role before privileged access and zero persistence calls on invalid inputs. |
| BASE-03 | VERIFIED on disposable DB | Captured real concurrent RPC calls yield one success and one conflict. Immutable approved content, original imported attribution, explicit legacy evidence and event-failure rollback checks all pass. |
| BASE-04 | VERIFIED for admission | Shared saved/requested constraint union reaches context, candidate adapter, recipe approval and scheduler evidence. Actual adapter/eligibility matrix preserves allergies, cross-contact, never-foods, strict prep and combined diets. This is not proof of complete vegan-week support. |
| BASE-05 | VERIFIED locally and on disposable DB | Actual POST tests prove omission-aware parsing, identity, missing-schema failure, no reduced fallback and the standard-limit bridge. Real RPCs prove omitted hard-field retention, cross-owner denial, concurrent first-save and three-store allergy union, and unchanged prior snapshots after injected allergy insertion failure. |
| BASE-06 | VERIFIED locally | All nine historical failures are classified. Corrected fixtures still test direct repair/practical-limit failures, soft dislikes versus hard never-foods, allergy negatives and immutable replacement. Legacy test explicitly permits only fully checked output or failed nonmutating enforcement; it does not invent a feasible-generation guarantee. |
| BASE-07 | VERIFIED locally | This verifier previously ran 103/103 tests with zero skips; parent reran 103/103 after integration fixes, with clean TypeScript and final ESLint exit 0, zero errors/10 existing warnings. Production route exports and real helpers are exercised. |
| BASE-08 | VERIFIED on disposable DB | Actual chronological and reversed structured/trusted bootstrap orders pass. Real access grants, anonymous/owner/reviewer/service checks, immutable-version/event protection, conflicts and rollback scenarios pass. |
| BASE-09 | VERIFIED | Current evidence distinguishes the explicit disposable-local target from the user's configured project. Tool installation was separately authorised. No existing/live-project migration or production deployment is claimed; earlier BLOCKED records must be reconciled by the parent. |

Nine requirements are supported by local automated evidence. The score does not override browser verification or authorise a production rollout. The earlier missing-database findings are closed by real evidence, not waived.

## Artifacts and wiring

| Artifact/link | Level 1–4 result |
|---|---|
| `lib/recipes/review-lifecycle.ts` → existing converter/approval | Exists, substantive and used by actual recipe-review POST; conversion does not alter recipe facts to force admission. |
| Review route → `persistReviewedRecipe()` → `review_recipe_version` | Actual GET/POST verify `getUser()` and reviewer role; source-loaded record/version feed one RPC. The deployed disposable function's conflict, atomic transition and rollback paths now have real evidence; the configured user-data project remains unmigrated. |
| Context/server constraints → candidate adapter → eligibility | `constraintsFromSources()` and `mergeEffectiveConstraints()` retain the strict union; candidate dietary tags are issued only after server record approval, and `mayContain` evidence is retained. |
| Onboarding/planner → preferences POST → `save_safety_preferences` | Existing forms call the route; standard panel limit maps to numeric 30 consistently in signature and payload. Actual POST verifies explicit bearer/session identity and uses only the authenticated RPC. Missing function is actionable failure, not a completed save. |
| Reviewer queue → API → state/render | Real fetch populates recipe state. Latest source uses a token-keyed workspace, aborts initial fetch, and checks mounted state for manual reload/review completions, isolating old-session queue/message/attestation state. Runtime account-switch interaction still needs browser verification. |
| Target guard → integration harness → real SQL runner | No app `.env.local` reads; explicit test API/SQL identity, disposable confirmation and runner are required. Actual database name and fresh public schema precede writes. Captured real execution proves the subsequent migration and RPC scenarios. |

Representative source anchors: `review-lifecycle.ts:16/33/49`, `api/recipe-review/route.ts:15/67`, `recipe-reviewer.ts:29/31`, `api/preferences/route.ts:16/21`, `preferences-persistence.ts:4/12/89`, `candidate-adapter.ts:26`, `review-recipes/page.tsx:24/59/75/89`, and `baseline.integration.test.ts:15/34/35` (all under `frontend-new`).

## Earlier independently executed behavioural checks (2026-10-28)

Commands ran from `frontend-new` using installed tooling; no server was started.

| Check | Actual result |
|---|---|
| Five targeted lifecycle/review-route/preferences-route/dietary/target-guard files | 35 passed, zero failed/skipped; exit 0. Actual route exports are transpiled and executed, rather than copied into test handlers. |
| `node --test --test-reporter=spec tests/orchestration/*.test.ts` | 103 passed, zero failures/skips; exit 0. |
| `node --test tests/database/baseline.integration.test.ts` | Exit 1 with `BLOCKED: disposable database unavailable or target confirmation does not match`; guard failure before client creation, zero database scenarios executed. |

The negative missing-environment result remains valid safety evidence; it no longer represents the current environment's capability. Parent's final 2026-10-29 aggregate gates are 103/103 passing, TypeScript exit 0 and ESLint exit 0 with zero errors/10 existing warnings. Those final reruns were performed by the parent, not relabelled as new verifier executions.

## Real database gate closure (2026-10-29)

Inspected `01-DATABASE-TEST.log` (1513 bytes; local timestamp 2026-10-29 00:21). It records **8 tests passed, 0 failures, 0 skips**, duration approximately 1.86 seconds: seven named database child scenarios and their passing parent.

| Captured PostgreSQL/PostgREST scenario | Result |
|---|---|
| Fresh chronological bootstrap | PASS |
| Fresh trusted-before-structured bootstrap | PASS |
| Anonymous/ordinary-user operational denial and reviewer-role enforcement | PASS |
| Concurrent review, one immutable N+1 and actual imported provenance | PASS |
| Explicit legacy evidence and injected event failure rolling back both new version and draft closure | PASS |
| Omitted preference retention and cross-owner denial | PASS |
| Concurrent first saves, saved three-store allergy union and insertion-failure rollback snapshots | PASS |

The target is the separately provisioned `%LOCALAPPDATA%/OvonaTools/supabase-disposable`, API `127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322`. `run-disposable-verification.ps1` refuses wildcard container port bindings, checks the named disposable project and supplies only that project's credentials without printing them. `bind-disposable-localhost.cjs` checks the exact project/workdir labels before recreating its two named DB/gateway containers, preserves named database volumes and generated gateway configuration, and refreshes only that project's dependent Auth/REST pools. Source inspection supports this scope; no production reach is inferred.

The real run caught CASE-expression SQL parse errors missed by static review. The safety-preference migration now parenthesises those comparisons, and both actual migration orders and subsequent RPC scenarios pass. The harness now strips inherited `PG*` settings before supplying the guarded target and stops after a failed bootstrap before committed writes. No SQL rerun was made by this verifier: the test target is now populated and the fresh-schema guard must remain intact.

## Known limits and human verification

- **Deployment prerequisite:** the two RPC migrations were applied only to the disposable database. The application's configured existing project was not migrated or repointed. Missing functions there still return actionable non-success; disposable test persistence is not production persistence.
- **Vegan policy gap:** honest vegan candidates are admitted, but the existing two-`plant`-meals-per-day cap prevents a complete three/five-meal vegan day. BASE-04 admission is repaired; end-to-end vegan scheduling is not claimed. A precise protein-source policy/metadata follow-up is needed. No roadmap override or fabricated mixed metadata accepts it as a completed feature.
- **Legacy generation:** the static fallback has no all-profile macro-fit guarantee. Tests enforce truthful checked-versus-failed handling; positive active reviewed generation is covered separately. This is not evidence that the legacy generator has been repaired for every target.
- Browser verification after deployment must cover successful and unsupported-schema preference saves, preserved form values, reviewer account/token switching, approval queue refresh and failure recovery. Static source review and route mocks do not prove those interactions.
- No new source stub, skipped required test, relaxed hard safety band or disconnected production data source was found in this scope. The previously missing local database prerequisite is now satisfied and its mandatory tests passed.

## Required next release evidence

Perform the two browser checks in frontmatter against a separately configured isolated application instance. Do not silently repoint the user's existing application or migrate its database. Any new positive database replay needs an explicitly fresh disposable target; never bypass the populated-target guard. Parent must reconcile earlier BLOCKED summaries/state with the passing database log and final aggregate gates. This report alone does not authorise production rollout or auto-advance.

_Verifier: gsd-verifier; independent goal-backward re-verification, 2026-10-29._
