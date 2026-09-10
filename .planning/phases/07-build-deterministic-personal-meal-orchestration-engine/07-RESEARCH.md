# Phase 07: Build deterministic personal meal orchestration engine - Research

**Researched:** 2026-09-10  
**Domain:** Deterministic constraint-based meal scheduling in a Next.js/Supabase application  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Normalize the planner input into an explicit profile containing calorie target, protein target, allergies, dislikes, dietary rules, budget sensitivity, cooking-time preference, household size, and preferred meal types.
- **D-02:** Model hard constraints separately from soft preferences. Allergies and dietary prohibitions are non-negotiable; calorie/protein bands, required meal slots, and cooking-time limits are deterministic validation rules.
- **D-03:** Preserve the current individual-user focus. Household size scales portions and shopping quantities; it does not introduce multi-person preference optimisation.
- **D-04:** Produce a seven-day breakfast, lunch, dinner, and optional snack schedule from candidate meals without requiring the user to choose each recipe.
- **D-05:** Score candidates using nutrition fit, preference fit, ingredient reuse, prep effort, cost, and recent repetition. Use deterministic numeric scoring with inspectable score components.
- **D-06:** Prevent excessive identical or highly similar meals while permitting an explicitly marked batch-cook/leftover sequence when it improves practicality.
- **D-07:** Run a deterministic post-schedule validation and repair pass that rejects hard-constraint violations and checks daily calorie/protein tolerance bands.
- **D-08:** Replace one meal against the existing week context rather than regenerating the entire plan. The replacement must obey the same hard constraints and avoid repeating the meal it replaces.
- **D-09:** Attach a concise explanation to generated/swap meals that names the practical reasons selected, such as leftovers, target contribution, and preparation time. Explanations are derived from deterministic scoring data.
- **D-10:** Keep LLM use optional and isolated behind an adapter for future soft-preference parsing or qualitative similarity ranking; an LLM must never decide safety, nutrition correctness, quantities, or constraint validity.
- **D-11:** Aggregate all selected recipes into a week shopping list, scale quantities for household size, merge normalized duplicates, and distinguish pantry staples from items to buy.
- **D-12:** Add automated tests for allergy exclusion, protein/calorie tolerance, repetition/leftover rules, single-meal replacement, and scaled shopping-list aggregation.

### Claude's Discretion
- Exact tolerance defaults and score weights, provided they are centralized, configurable, and covered by tests.
- Whether to adapt existing generation types or introduce a new planner-specific module boundary, provided legacy routes remain compatible.
- Exact UI wording and presentation for the existing planner's “Just plan my week” entry point.

### Deferred Ideas (OUT OF SCOPE)
- LLM preference parser and qualitative meal-similarity ranker — add only after the deterministic engine is reliable.
- Multi-member household constraint resolution — future family-planning phase.
- Condition-aware clinical nutrition and micronutrient guidance — future clinically validated phase.
</user_constraints>

## Summary

Use a new pure `lib/orchestration/` domain boundary and preserve `lib/meal-generator.ts` plus the existing API routes as compatibility adapters. [VERIFIED: codebase grep] The existing pipeline has reusable profile context, portioning, allergy validation, macro enforcement, pricing, and shopping aggregation, but its main generator creates five workdays, may obtain meal concepts from an LLM, and the fallback selector injects randomness. [VERIFIED: `frontend-new/lib/generation/generate-plan.ts`, `frontend-new/lib/generation/nutritionist.ts`, `frontend-new/lib/meal-generator.ts`]

The core must accept a canonical profile plus an explicit, verified candidate catalogue and return an inspectable `OrchestrationResult`: schedule, per-selection score breakdowns, explanations, validation/repair report, and shopping list. [ASSUMED] This makes the same inputs produce the same result and prevents persistence, pricing, OpenAI, clock, UUID, and Supabase calls from influencing safety or selection. [VERIFIED: `frontend-new/lib/generation/generate-plan.ts`, `frontend-new/lib/meal-generator.ts`]

**Primary recommendation:** Implement an in-process deterministic greedy scheduler with stable tie-breaking and bounded local repair; filter hard constraints before scoring, then validate the fully materialized seven-day plan before any persistence. [ASSUMED]

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists at the repository root. [VERIFIED: filesystem check]

Project-level constraints from `AGENTS.md` that the plan must honor:

- Keep implementation in the existing Next.js App Router + Supabase + OpenAI SDK stack. [VERIFIED: `AGENTS.md`]
- Use compatibility-safe Supabase writes because schema/check constraints vary between environments. [VERIFIED: `AGENTS.md`]
- Preserve low cognitive load and deterministic fallbacks; do not broaden into family or clinical-planning scope. [VERIFIED: `AGENTS.md`]
- Keep shared business logic under `frontend-new/lib`; route handlers should remain thin orchestration/auth/persistence wrappers. [VERIFIED: `AGENTS.md`]
- Preserve the dirty worktree and do not revert unrelated changes. [VERIFIED: `.planning/STATE.md`, `git status --short`]

## Standard Stack

### Core

| Library/runtime | Verified version | Purpose | Why standard here |
|---|---:|---|---|
| TypeScript | `^5` (repo declaration) | Strict types for profile, candidate, constraint, score, explanation, and result contracts | The active app is strict TypeScript and domain types already live in `lib/`. [VERIFIED: `frontend-new/package.json`, `frontend-new/tsconfig.json`, `AGENTS.md`] |
| Next.js App Router | `16.0.10` (installed declaration) | Existing request/auth/persistence integration surface | Route handlers support typed `Request`/`Response` handlers; keep them as adapters rather than placing scheduling logic inside them. [VERIFIED: `frontend-new/package.json`; CITED: https://nextjs.org/docs/app/api-reference/file-conventions/route] |
| Node.js built-in test runner | `v24.11.1` (local) | Automated tests for pure orchestrator behavior | `node --test` is locally available, so Phase 7 can add tests without a new testing dependency. [VERIFIED: `node --help`, `node --version`; CITED: https://nodejs.org/api/test.html] |

### Supporting

| Existing module | Purpose | Use in Phase 7 |
|---|---|---|
| `lib/generation/context-builder.ts` | Loads profile/preferences/history and derives target/slot context | Adapt at the edge into the new canonical profile; do not let database shape leak into pure scheduling. [VERIFIED: `frontend-new/lib/generation/context-builder.ts`] |
| `lib/generation/validation-gate.ts` | Ingredient/allergen lookup | Reuse only to build/verify candidate metadata before invoking the pure core; its Supabase queries make it unsuitable as the core constraint evaluator. [VERIFIED: `frontend-new/lib/generation/validation-gate.ts`] |
| `lib/generation/medical-engine.ts` | Portion calculation | Reuse/replace behind a deterministic candidate-materialization adapter; pass materialized macros and ingredient quantities into the core. [VERIFIED: `frontend-new/lib/generation/medical-engine.ts`] |
| `lib/macro-enforcement.ts` | Per-day macro correction/reporting | Reuse its tolerance concepts only after making repair deterministic and non-mutating; current `enforceMacros` mutates its `WeeklyMealPlan` argument. [VERIFIED: `frontend-new/lib/macro-enforcement.ts`] |
| `lib/meal-generator.ts` | Legacy types, fallback meal library, list aggregation, swap compatibility | Retain response compatibility temporarily, but do not use its random selection or five-workday constants in the new core. [VERIFIED: `frontend-new/lib/meal-generator.ts`] |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| Deterministic greedy scheduler with bounded repair | Integer programming/constraint solver | A solver can optimize globally, but it adds a new dependency and operational model; the bounded seven-day slot count plus locked in-process stack make a transparent deterministic scorer/repair loop the better Phase 7 fit. [ASSUMED] |
| Node built-in test runner | Vitest | Next.js documents Vitest as a testing option, but no test runner exists in the repo and the registry was unavailable from this workspace; avoid making a package-version assumption in this phase. [VERIFIED: `frontend-new/package.json`, repository test scan; CITED: https://nextjs.org/docs/app/guides/testing/vitest] |

**Installation:** No new package is required. [VERIFIED: local Node test-runner availability]

## Architecture Patterns

### Recommended Project Structure

```text
frontend-new/
├── lib/orchestration/
│   ├── types.ts              # canonical profile, candidate, constraints, result contracts
│   ├── normalize-profile.ts  # edge-data → canonical profile; no selection
│   ├── eligibility.ts        # hard-constraint predicates and rejection reasons
│   ├── score.ts              # numeric component scores and stable tie-break key
│   ├── schedule.ts           # seven-day slot ordering and deterministic selection
│   ├── repair.ts             # bounded local replacement/portion repair
│   ├── validate.ts           # complete-plan invariant report
│   ├── explain.ts            # explanation from selected score/reuse facts
│   ├── shopping.ts           # quantity scaling, pantry split, duplicate merge
│   └── index.ts              # planWeek and replaceMeal public API
├── lib/generation/           # adapters: context, verified candidates, portions, persistence
└── app/api/meal-plan/        # thin auth/request/response/persistence adapters
```

### Pattern 1: Pure core with effectful adapters

**What:** `planWeek(profile, candidates, policy)` and `replaceMeal(existingResult, target, candidates, policy)` are synchronous/pure. [ASSUMED] Supabase reads, optional LLM calls, date/UUID creation, and writes happen before or after this boundary. [VERIFIED: existing generator currently mixes these concerns in `generateWeeklyPlanWithArtifacts`.]

**When to use:** Always for the Phase 7 decision path, because deterministic safety and testability are locked requirements. [VERIFIED: `07-CONTEXT.md` D-02, D-05, D-07, D-10, D-12]

**Example:**

```ts
// Source: Phase 7 locked decisions + pure-domain pattern [ASSUMED]
const eligible = candidates.filter((candidate) => isEligible(candidate, profile).ok);
const scheduled = scheduleWeek(profile, eligible, policy); // stable slot/candidate ordering
const repaired = repairSchedule(scheduled, eligible, profile, policy); // bounded
const validation = validateWeek(repaired, profile, policy);
if (!validation.valid) throw new PlannerConstraintError(validation.violations);
return materializeResult(repaired, validation, profile, policy);
```

### Pattern 2: Constraint pipeline, not weighted safety

**What:** Separate `HardConstraint` predicates (allergen, dietary rule, required slot, max prep time, known nutrition/quantity) from `SoftScore` components (macro proximity, preference, ingredient reuse, effort, cost, history). [ASSUMED]

**When to use:** Before candidate ranking and again after repair/replacement. [VERIFIED: `07-CONTEXT.md` D-02, D-07, D-08]

**Anti-patterns to avoid**

- **Allergy as a penalty:** Never let a high nutrition or reuse score outweigh an allergy/dietary prohibition. [VERIFIED: `07-CONTEXT.md` D-02]
- **Random tie selection:** `meal-generator.ts` uses `Math.random()` for initial and top-window selection; replace it with a total sort on score then normalized candidate ID. [VERIFIED: `frontend-new/lib/meal-generator.ts`]
- **LLM as a candidate authority:** `nutritionist.ts` can create candidates and later persist them with `source: "llm"`; Phase 7 must not admit unverified LLM data to deterministic constraint enforcement. [VERIFIED: `frontend-new/lib/generation/nutritionist.ts`, `frontend-new/lib/generation/meal-storage.ts`, `07-CONTEXT.md` D-10]
- **Whole-week regeneration for a swap:** Compute only the target slot's candidate alternatives while keeping all other scheduled entries fixed. [VERIFIED: `07-CONTEXT.md` D-08]

## Integration and Data Contracts

### Reuse map

| Existing seam | Current behavior | Phase 7 action |
|---|---|---|
| `generateWeeklyPlanWithArtifacts` | Builds context, can seed/query/LLM-generate concepts, distributes `mealsPerDay * 5`, validates/portions/prices, then records history. [VERIFIED: `frontend-new/lib/generation/generate-plan.ts`] | Add a deterministic orchestration adapter or replace this function's middle path; maintain its external `WeeklyMealPlan` response until API clients migrate. [ASSUMED] |
| `/api/meal-plan` | Authenticates, invokes generator, runs macro enforcement, persists alternatives in `plan_history`, and falls back to legacy random generator. [VERIFIED: `frontend-new/app/api/meal-plan/route.ts`] | Call the new adapter and persist its result/explanations; remove the random fallback from the deterministic route or return an explicit incomplete/constraint response. [ASSUMED] |
| `/api/meal-plan/swap` | Searches persisted alternatives, otherwise calls `swapMealInPlan`, recalculates totals, enforces macros, and rebuilds shopping data. [VERIFIED: `frontend-new/app/api/meal-plan/swap/route.ts`] | Delegate both branches to `replaceMeal`, persist the returned explanation/validation report, and reject a replacement when the fixed-week plan cannot be repaired. [ASSUMED] |
| `/api/shopping-list` | Slices plan days to `WORKDAY_COUNT` and persists normalized list items in `plan_history`. [VERIFIED: `frontend-new/app/api/shopping-list/route.ts`] | Remove the workweek slice for the Phase 7 seven-day contract and use planner-produced scaled/buy-vs-pantry lines. [ASSUMED] |
| `buildShoppingList` | Merges by normalized ingredient and unit, applies each meal's portion multiplier, but does not model household scaling or pantry exclusions. [VERIFIED: `frontend-new/lib/meal-generator.ts`] | Reuse canonical-name/unit utilities if extracted; add a `householdSize` multiplier exactly once and a normalized pantry-staple exclusion set. [ASSUMED] |

### Canonical contracts to add

```ts
// Source: locked Phase 7 decisions [ASSUMED]
type PlannerProfile = {
  calorieTarget: number;
  proteinTarget: number;
  allergies: readonly string[];
  dietaryRules: readonly string[];
  dislikes: readonly string[];
  maxPrepMinutes: number;
  budgetSensitivity: "low" | "medium" | "high";
  householdSize: number;
  mealSlots: readonly MealSlot[];
  pantryStaples: readonly string[];
  recentMealIds: readonly string[];
};

type CandidateMeal = {
  id: string;                 // stable normalized ID; final tie-breaker
  slots: readonly MealSlot[];
  allergens: readonly string[];
  dietaryFlags: readonly string[];
  prepMinutes: number;
  macros: MacroBreakdown;
  ingredients: readonly IngredientLine[];
  estimatedCost: number | null;
  batchCookGroup?: string;
  similarityKeys: readonly string[];
};

type Selection = {
  day: number; slot: MealSlot; candidateId: string;
  score: number;
  scoreComponents: Record<string, number>;
  explanationFacts: readonly ("target_fit" | "ingredient_reuse" | "quick" | "leftover")[];
};
```

### Deterministic scheduling policy

1. Canonicalize strings/case, reject malformed targets/household sizes, and derive the fixed 7 × selected-slot schedule in a stable order. [ASSUMED]
2. Materialize candidate nutrition/allergen/dietary/quantity data, then exclude every hard-constraint failure with a machine-readable rejection reason. [ASSUMED]
3. Score the remaining candidates with named numeric components and a centralized immutable policy object; sort by total score descending, then normalized `candidate.id` ascending. [ASSUMED]
4. Select greedily, tracking reuse, similarity, ingredient overlap, batch-cook group, weekly cost, and recent history. [ASSUMED]
5. Run a bounded repair loop that tries deterministic single-slot substitutions and deterministic portion adjustments; stop after the configured attempt limit and return violations, never a falsely valid plan. [ASSUMED]
6. Derive user-facing explanations exclusively from selected facts, not free-text LLM output. [VERIFIED: `07-CONTEXT.md` D-09, D-10]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Authentication/session parsing | A new planner-specific auth mechanism | `resolveRequestAuth` in the current route adapters | Existing routes already support cookie/bearer auth fallback. [VERIFIED: `frontend-new/lib/serverAuth.ts`, meal-plan and shopping routes] |
| Ingredient pricing/pack rounding | A second price catalogue | Existing `priceBasket` through the shopping adapter | It already returns subtotal, matched/unmatched items, pack size and buy quantity. [VERIFIED: `frontend-new/lib/tesco-prices.ts`, `frontend-new/app/api/shopping-list/route.ts`] |
| Target correction primitives | A duplicate macro arithmetic module | Extract/reuse concepts from `macro-enforcement.ts`, but wrap it in a pure deterministic repair API | Existing code has meal-portion correction and per-day results; mutation/randomness must not cross the new boundary. [VERIFIED: `frontend-new/lib/macro-enforcement.ts`] |
| Test runner | A bespoke assertion loop | Node built-in `node:test` | The installed Node runtime exposes `--test`. [VERIFIED: `node --help`; CITED: https://nodejs.org/api/test.html] |
| Clinical/medical rules | New condition-based nutrition recommendations | Nothing in Phase 7 | Clinical intelligence is explicitly deferred. [VERIFIED: `07-CONTEXT.md` Deferred Ideas] |

**Key insight:** The new code must own product-specific scheduling policy, but it should consume existing auth, pricing, profile retrieval, and persistence adapters rather than reimplementing them. [ASSUMED]

## Common Pitfalls

### Pitfall 1: Calling five workdays a weekly plan

**What goes wrong:** The current orchestration and shopping/swap paths use `WORKDAY_COUNT = 5` or `mealsPerDay * 5`; a seven-day output would be silently truncated during scheduling, swapping, or shopping. [VERIFIED: `frontend-new/lib/meal-generator.ts`, `frontend-new/lib/generation/generate-plan.ts`, `/api/meal-plan/swap`, `/api/shopping-list`]

**How to avoid:** Make `days = 7` an explicit planner invariant and audit all consumers of `WORKDAY_COUNT`, `.slice(0, WORKDAY_COUNT)`, and loops bounded by `5`. [ASSUMED]

### Pitfall 2: Accidental nondeterminism

**What goes wrong:** The legacy selector uses `Math.random()` in both first-day and top-window selection. [VERIFIED: `frontend-new/lib/meal-generator.ts`]

**How to avoid:** Ban time/random/UUID/LLM/database calls in pure planner modules; make candidate order and tie-breaking part of the contract and snapshot them in tests. [ASSUMED]

### Pitfall 3: Treating unverified ingredient knowledge as safe

**What goes wrong:** The current validation gate falls back to heuristic allergen inference and an LLM-generated ingredient can be persisted as unverified. [VERIFIED: `frontend-new/lib/generation/validation-gate.ts`, `frontend-new/lib/generation/meal-storage.ts`]

**How to avoid:** The deterministic planner admits only candidates with complete known allergen, dietary, nutrition, and quantity data; return an insufficiency error rather than guessing for a hard constraint. [ASSUMED]

### Pitfall 4: Repairing a swap by mutating the original plan

**What goes wrong:** Existing macro enforcement mutates plans, while a swap must preserve every non-target week entry. [VERIFIED: `frontend-new/lib/macro-enforcement.ts`, `07-CONTEXT.md` D-08]

**How to avoid:** Copy the result, replace exactly one slot, run validation/repair scoped to that slot plus its affected day totals, and assert unchanged IDs for all other slots. [ASSUMED]

### Pitfall 5: Applying household scaling twice

**What goes wrong:** Existing shopping aggregation already applies `portionMultiplier` to base ingredients. [VERIFIED: `frontend-new/lib/meal-generator.ts`]

**How to avoid:** Define a single materialization sequence: recipe serving → planner portion multiplier → household multiplier → normalized list merge → pack pricing. [ASSUMED]

## Code Examples

### Stable scoring and tie-breaking

```ts
// Source: deterministic policy required by D-05 [ASSUMED]
const rank = (candidates: readonly CandidateMeal[], facts: ScoreFacts) =>
  candidates
    .map((candidate) => {
      const components = scoreComponents(candidate, facts); // all finite numbers
      return {
        candidate,
        components,
        total: Object.values(components).reduce((sum, value) => sum + value, 0),
      };
    })
    .sort((a, b) => b.total - a.total || a.candidate.id.localeCompare(b.candidate.id));
```

### Strict replacement contract

```ts
// Source: D-02, D-07, D-08 [ASSUMED]
function replaceMeal(result: OrchestrationResult, target: SlotKey, candidates: CandidateMeal[]) {
  const before = result.schedule;
  const replacement = selectForSlot({ fixedSchedule: without(before, target), target }, candidates);
  const next = withSelection(before, target, replacement);
  const validation = validateWeek(next);
  if (!validation.valid) return { ok: false as const, violations: validation.violations };
  return { ok: true as const, result: materializeResult(next, validation) };
}
```

## State of the Art

| Old/current approach | Phase 7 approach | Impact |
|---|---|---|
| LLM/database/fallback generator selects concepts and then safety/portion/pricing stages run. [VERIFIED: `frontend-new/lib/generation/generate-plan.ts`] | Verified candidate catalogue enters a deterministic hard-filter → score → schedule → repair → validate pipeline. [ASSUMED] | Safety and nutrition decisions become inspectable and repeatable. [ASSUMED] |
| Randomized top-window candidate choice. [VERIFIED: `frontend-new/lib/meal-generator.ts`] | Stable total ordering with candidate ID tie-break. [ASSUMED] | Same effective inputs yield the same schedule. [ASSUMED] |
| Workweek-only plan/list/swap constants. [VERIFIED: `frontend-new/lib/meal-generator.ts`, routes] | Seven-day planning invariant. [VERIFIED: `07-CONTEXT.md` D-04] | Every route and persistence shape needs a seven-day audit. [ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A bounded greedy scheduler with deterministic repair is sufficient without a solver library for Phase 7. | Summary / Architecture | Could miss globally optimal schedules for scarce candidate pools. |
| A2 | A new pure `lib/orchestration/` boundary is preferable to extending the legacy generator directly. | Summary / Architecture | Adds adapter work; a direct refactor might be smaller. |
| A3 | Candidates must be fully verified before the pure core accepts them. | Pitfalls | Candidate availability may be too small and needs a product fallback policy. |
| A4 | Node built-in tests with Node 24 type stripping can cover the new pure TypeScript modules without a new dependency. | Validation Architecture | Imports/path aliases may require a small test entry-point adjustment. |
| A5 | Household scaling should occur after per-serving portion adjustment and before shopping aggregation. | Pitfalls | Incorrect order would distort quantities and macros. |

## Open Questions (RESOLVED)

1. **Policy limits are locked for Phase 7.** `DEFAULT_PLANNER_POLICY` uses the current calorie tolerance of `0.95–1.08` and protein tolerance of `0.98–1.10`, with all bounds, score weights, maximum portion adjustment, repair attempts, and repetition/leftover allowance centralized as immutable exported values. Boundary tests must cover both inclusive and exclusive edges. These defaults are configurable only through the policy argument; no route or candidate source may loosen them. [VERIFIED: existing calorie/protein factors in `frontend-new/lib/macro-enforcement.ts`; DECIDED: Phase 7 policy]

2. **Verified-catalogue provenance and insufficiency policy are locked.** `meal_concepts` alone cannot establish a safe candidate because the current migration lacks macro and cost facts. [VERIFIED: `20260217_generation_pipeline.sql`] Phase 7 therefore adds a server-only, reviewed, versioned `lib/orchestration/verified-catalogue.ts` containing explicit per-serving nutrition, ingredient quantities/units, allergens, diet metadata, prep time, cost, `verified: true`, and source/version provenance for curated existing recipe IDs. Stored concepts may supplement it only after the same facts and provenance are materialized; LLM/heuristic/bare-flag records remain untrusted. Before scheduling, `assertCompleteWeeklyAvailability` must verify the hard-eligible catalogue can satisfy the exact seven-day slots under the locked repetition/batch rules; test fixtures prove a complete pool yields a valid plan. If facts or capacity are insufficient, the adapter returns reason-coded `INSUFFICIENT_VERIFIED_CATALOGUE` (HTTP 422) and never uses an LLM or random fallback. [DECIDED: Phase 7 candidate authority]

3. **Household representation is locked.** Normalize the legacy household array/profile data at the server boundary to `householdSize: integer >= 1`; reject invalid/non-finite values rather than silently converting them. It multiplies shopping quantities after recipe portion scaling and exactly once. It does not add member-level preferences or multi-person optimisation. [VERIFIED: legacy `UserProfileInput.household` shape in `frontend-new/lib/meal-generator.ts`; DECIDED: D-03 implementation]

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js test runner | Phase 7 automated pure-domain tests | ✓ | `v24.11.1` | — [VERIFIED: local command] |
| npm registry | Optional Vitest installation | ✗ from sandbox cache | — | Node built-in test runner [VERIFIED: `npm view vitest` returned `ENOTCACHED`] |
| Supabase | Candidate/profile/history adapters and plan persistence | Not probed (credentials/service not required for pure-core research) | — | Unit tests use in-memory candidate/profile fixtures. [ASSUMED] |

**Missing dependencies with no fallback:** None for pure-core implementation/tests. [VERIFIED: local Node test-runner availability]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node.js built-in test runner, `v24.11.1`. [VERIFIED: local Node; CITED: https://nodejs.org/api/test.html] |
| Config file | None. [VERIFIED: repository scan excluding `node_modules`] |
| Quick run command | `node --test tests/orchestration/**/*.test.ts` after Wave 0 confirms direct TypeScript test execution/import paths. [ASSUMED] |
| Existing regression command | `node scripts/fallback-regression-test.cjs`. [VERIFIED: `frontend-new/scripts/fallback-regression-test.cjs`] |

### Phase Behaviors → Test Map

| Behavior | Test type | Automated command | File exists? |
|---|---|---|---|
| Allergy and dietary prohibition exclude every unsafe candidate, including repair/swap candidates | Unit | `node --test tests/orchestration/eligibility.test.ts` | ❌ Wave 0 [ASSUMED] |
| Every scheduled day is within configured calorie/protein bands or result is explicitly invalid | Unit | `node --test tests/orchestration/validate.test.ts` | ❌ Wave 0 [ASSUMED] |
| Repetition is rejected unless a declared batch-cook/leftover sequence permits it | Unit | `node --test tests/orchestration/schedule.test.ts` | ❌ Wave 0 [ASSUMED] |
| Swap changes one target slot, does not repeat it, preserves non-target entries, and validates its day | Unit | `node --test tests/orchestration/replace.test.ts` | ❌ Wave 0 [ASSUMED] |
| Household scaling merges canonical duplicate ingredients and splits pantry/buy lines | Unit | `node --test tests/orchestration/shopping.test.ts` | ❌ Wave 0 [ASSUMED] |
| Seven-day adapter response and persisted shopping data are not sliced to five days | Integration/route | `npm run lint` plus a route fixture/harness selected during Wave 0 | ❌ Wave 0 [ASSUMED] |

### Sampling Rate

- **Per task commit:** relevant `node --test` file plus `npm run lint` in `frontend-new`. [ASSUMED]
- **Per wave merge:** all `node --test tests/orchestration/**/*.test.ts` and `node scripts/fallback-regression-test.cjs`. [ASSUMED]
- **Phase gate:** all tests green, `npm run lint` green, and a manual API smoke of weekly generation → swap → shopping confirms seven-day persisted output. [ASSUMED]

### Wave 0 Gaps

- [ ] `frontend-new/tests/orchestration/*.test.ts` and a package script that discovers them. [ASSUMED]
- [ ] Confirm Node's built-in type stripping can import the pure orchestration modules with this project's aliases; if not, use a minimal TypeScript transpile test bootstrap based on the existing regression script. [VERIFIED: Node exposes type stripping controls; `fallback-regression-test.cjs` already uses `typescript.transpileModule`]
- [ ] Deterministic fixture catalogue containing safe/unsafe candidates, declared leftovers, normalized aliases, known costs, and quantities. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | Yes | Keep `resolveRequestAuth` at route edges and authorize all plan/history reads/writes by authenticated user ID. [VERIFIED: existing routes and `serverAuth.ts`] |
| V3 Session Management | Yes | Preserve cookie/bearer session fallback behavior in existing route adapters. [VERIFIED: existing routes] |
| V4 Access Control | Yes | Scope all `plan_history`, profile, and candidate-history persistence to the authenticated user; never trust a request-provided user ID. [ASSUMED] |
| V5 Input Validation | Yes | Validate request payload and canonical profile ranges before planning; fail 400 for malformed fields. [ASSUMED] |
| V6 Cryptography | No new control | Do not introduce crypto; UUID generation remains outside deterministic selection. [VERIFIED: existing generator uses UUIDs; ASSUMED: no new cryptographic requirement] |

### Known Threat Patterns for the planner

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Crafted profile bypasses allergy/dietary rules | Tampering | Server-side canonicalization plus hard filters and a final complete-plan validation report. [ASSUMED] |
| Request references another user's week/plan | Elevation of privilege | Resolve user from session and scope Supabase queries/inserts/deletes by that ID. [VERIFIED: current routes follow this pattern] |
| LLM/unverified candidate is treated as fact | Tampering | Keep optional LLM adapter outside the core and require complete verified candidate metadata. [VERIFIED: D-10; ASSUMED: admission policy] |
| Oversized/invalid numeric payload distorts quantities | Denial of service/Tampering | Clamp and reject non-finite targets, prep times, portions, and household size before scheduling. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) — current route-handler behavior and typed request/response surface, checked 2026-09-10.
- [Node.js test runner](https://nodejs.org/api/test.html) — built-in test-runner documentation, checked 2026-09-10.
- `frontend-new/lib/generation/generate-plan.ts`, `types.ts`, `validation-gate.ts`, `context-builder.ts`, `meal-storage.ts` — current pipeline contracts and effects. [VERIFIED: codebase grep]
- `frontend-new/lib/meal-generator.ts`, `macro-enforcement.ts`, `frontend-new/app/api/meal-plan/route.ts`, `swap/route.ts`, `shopping-list/route.ts` — legacy selection, constraints, routes, and list behavior. [VERIFIED: codebase grep]
- `frontend-new/supabase/migrations/20260217_generation_pipeline.sql` — persisted candidate/history schema. [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) — supported alternative test stack; not selected because registry availability was not verified in this workspace. [CITED: https://nextjs.org/docs/app/guides/testing/vitest]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — based on installed package declarations, local runtime probe, and official Next/Node docs.
- Architecture: HIGH — existing generator/routes directly expose the seams and current nondeterministic/five-day behavior.
- Pitfalls: HIGH — key pitfalls are direct code-path findings; the recommended remediation details are recorded in the assumptions log.

**Research date:** 2026-09-10  
**Valid until:** 2026-10-10 for repository findings; re-check Next/Node docs before dependency changes.
