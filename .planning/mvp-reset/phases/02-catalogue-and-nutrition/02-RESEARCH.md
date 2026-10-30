# Phase 2: Catalogue and nutrition — research

Researched: 2026-10-29. Confidence: HIGH for inspected application contracts; MEDIUM for proposed finite delivery scope. This is the MVP reset Phase 2, not historical `.planning/phases/02-*`. [VERIFIED: `.planning/mvp-reset/ROADMAP.md`]

## User Constraints

No Phase 2 CONTEXT.md existed when research began. The user explicitly requested continuing with Phase 2 after its scope was explained. Parent assignment: precise ingredient quantities/units/servings, reproducible ingredient-derived nutrition, reviewed catalogue coverage; preserve existing data and truthful review/provenance; database tests use a separate disposable target. [VERIFIED: current task assignment]

Reuse Next.js App Router, Supabase and the reviewed recipe pipeline; preserve hard allergies/may-contain, dietary restrictions, never-foods, preparation limits and immutable reviewed versions. No new dependencies are necessary for the domain engine. Plan/shopping revision persistence, AI adaptation and retailer product ingestion remain later roadmap phases. [VERIFIED: `.planning/mvp-reset/phases/01-trustworthy-baseline/01-CONTEXT.md`; `.planning/mvp-reset/ROADMAP.md`]

## Summary

The correct extension point is `RecipeRecord`, not a replacement planner. Its ingredient amounts describe the entire batch while `macros` describes one serving; `candidate-adapter.ts` divides ingredients by recipe servings exactly once. Existing approval validates declared macros and textual nutrition evidence but cannot reproduce those values from food composition data. [VERIFIED: `frontend-new/lib/recipes/types.ts`; `frontend-new/lib/recipes/REVIEW.md`; `frontend-new/lib/orchestration/candidate-adapter.ts`; `frontend-new/lib/recipes/approval.ts`]

The deterministic export currently contains 38 pending drafts: 12 breakfast, 18 lunch, 18 dinner and 15 snack assignments, with overlap between slots. All 38 pass current structural validation, but the export explicitly labels nutrition as estimated internal ingredient baselines and leaves every evidence flag unreviewed. Syntactic completeness is therefore not nutrition or reviewed-coverage evidence. [VERIFIED: executed `exportRecords()` plus `recipeRecordErrors()` on 2026-10-29; `frontend-new/scripts/export-recipe-library.cjs`]

**Recommendation:** implement a pure, versioned calculation contract and explicit food mapping; enforce it for new calculated recipe versions; add dry-run preparation/coverage tooling and reviewer diagnostics; prove a finite representative catalogue slice without auto-approving real drafts. Do not pretend software can perform a cook-through or verify ownership. [PROPOSAL based on verified contracts above]

## Project Constraints (from CLAUDE.md)

No root CLAUDE.md was found by the initial read. GSD must precede repository edits under the supplied project instructions; this research is assigned inside the GSD plan-phase workflow. Existing uncommitted changes belong to ongoing work and must be preserved. [VERIFIED: initial `Get-Content CLAUDE.md -ErrorAction SilentlyContinue`; parent task]

Six project OpenSpec skill indexes exist under `.claude/skills/`; they describe a separate OpenSpec CLI workflow. This task is explicitly scoped to GSD, so none was invoked. [VERIFIED: `.claude/skills/*/SKILL.md` indexes]

## Standard Stack

| Existing component | Declared version | Phase use |
|---|---|---|
| Next.js | 16.0.10 | Existing route orchestration and review page |
| React | 19.2.0 | Existing reviewer workspace |
| Supabase JS | ^2.81.1 | Existing authenticated and service clients |
| TypeScript | ^5 | Typed pure calculation and validation |
| Node test runner | available Node v24.11.1 | Existing `node --test` suite |

[VERIFIED: `frontend-new/package.json`; executed `node --version`]

These are repository versions, not claims about newest registry releases. Keep the installed stack and introduce no packages. Exact decimal policy can use deterministic integer precision plus explicit rounding boundaries rather than adding a numerical library for four macro fields. [PROPOSAL]

## Architecture Patterns

### Extend the existing evidence record

`RecipeIngredient` currently has name, broad taxonomy canonicalId, amount, free-string unit, allergens/mayContain, dietary flags and reviewed boolean. `RecipeRecord.nutrition` has only method/reference/reviewed. `recipeRecordErrors` permits g/kg/ml/l/each/large/piece/tbsp/tsp; no nutrient-food reference, weight state, density or count mass is present. [VERIFIED: `frontend-new/lib/recipes/types.ts`; `frontend-new/lib/recipes/repository.ts`]

Proposed modules:

```text
lib/recipes/quantities.ts       # dimensional conversion, explicit evidence
lib/recipes/nutrition.ts        # source validation + pure line/batch/serving calculation
lib/recipes/catalogue-coverage.ts # admission/capacity/actual scheduling probes
tests/orchestration/recipe-nutrition.test.ts
tests/orchestration/catalogue-coverage.test.ts
scripts/prepare-recipe-nutrition.cjs  # deterministic dry-run by default
```

[PROPOSAL; existing `lib/recipes` and Node test structure verified]

Use distinct exact nutrient-source identifiers/revisions and state (raw/cooked/drained/as-sold) independently of allergy taxonomy. The taxonomy deliberately aliases nutritionally different foods: `milk` includes milk, Greek yogurt, cottage cheese and whey; `rice` includes brown and jasmine rice; `egg` includes whole eggs and whites. A canonical taxon is therefore insufficient as the nutrient lookup key. [VERIFIED: `frontend-new/lib/recipes/taxonomy.ts`]

Prefer an immutable embedded source snapshot or immutable revisioned food rows referenced by the recipe, including publisher, dataset/version, food code/name/state, basis unit/quantity, four nutrient values, retrieval/source reference and explicit mapping evidence. New calculations must retain enough input evidence to reproduce without network or mutable live food data. Keep recipe-rights provenance separate from food-data attribution. [PROPOSAL]

### Quantity contract

Use dimensional conversion only: kg→g and l→ml are exact. Volume→mass requires ingredient-specific density or a source basis per volume; each/large/piece require explicit edible mass per unit or a matching source unit. Never silently treat one ml as one gram, one egg as a fixed global size, or one tbsp as a generic gram count. Reject incompatible/unknown conversions with ingredient-specific reasons. Record whether supplied quantity is edible/raw/cooked/drained and reject state mismatch. [PROPOSAL motivated by current free-string units and missing conversion evidence]

Preserve whole-batch ingredient amounts and per-serving macros. Calculate each line = converted quantity/source basis × source nutrient values; sum full precision, divide batch totals by positive servings once, then apply one documented rounding policy. Portion scaling must stay compatible with `validateMealAgainstRecipe`, which currently rounds each recipe macro × portion multiplier to integers. Do not change rounding at several boundaries without matching tests. [VERIFIED: `frontend-new/lib/recipes/approval.ts`, `scaledMacros`, ingredient `matches`; PROPOSAL: new calculator boundary]

### Compatibility and approval

`loadReviewedRecipes` fails the whole library if any loaded approved row is malformed; historical reviewed versions remain needed for saved-plan validation. A blanket mandatory new field would therefore invalidate the existing catalogue. [VERIFIED: `frontend-new/lib/recipes/repository.ts`, `loadReviewedRecipes`; `frontend-new/lib/recipes/REVIEW.md`]

Add an explicit nutrition evidence discriminator/version: legacy attested records remain readable and honestly labelled legacy; newly claimed calculated records must validate every source, conversion and recomputed macro. Require complete calculated evidence for new review approvals through the phase policy, while leaving old immutable approved records untouched. Planning must distinguish legacy-attested versus calculated; do not silently label legacy nutrition calculated or erase evidence. If introducing a stricter generation mode, fail with actionable coverage diagnostics rather than silently mixing guarantees. [PROPOSAL]

Reuse `proposeReviewedVersion`/`persistReviewedRecipe` and the atomic `review_recipe_version` RPC. The existing RPC locks source snapshots and accepts no arbitrary content edits during approval. Nutrition corrections belong in a pending successor draft before approval, not mutations slipped into the review transition. [VERIFIED: `frontend-new/lib/recipes/review-lifecycle.ts`; `frontend-new/supabase/migrations/20261028090000_baseline_review_transition.sql`]

## Catalogue coverage and finite delivery scope

`buildDeterministicPlanningInput` already loads reviewed recipes, applies `approveRecipe` with effective saved constraints, maps slots to candidates and checks that each required slot has at least one candidate. `assertCompleteWeeklyAvailability` is a separate count-capacity check backed by synthetic chickpea/oil candidates; it is not proof the real reviewed catalogue can generate macro-feasible weeks. [VERIFIED: `frontend-new/lib/orchestration/candidate-adapter.ts`; `frontend-new/lib/orchestration/verified-catalogue.ts`]

Reuse the real admission and `orchestrateWeek` paths in a dry-run coverage report. Report total/draft/reviewed/calculated counts, ingredient/source gaps, rejection reason counts per diet/allergy/prep cohort, slot capacities with duplicate snack slots accounted for, and an actual deterministic seven-day scheduling result. Counts are necessary but insufficient: scheduler also enforces daily calorie/protein bands, portion range 0.7–1.5, similarity/repetition and practical weekly quantities. [VERIFIED: `frontend-new/lib/orchestration/schedule.ts`; `frontend-new/lib/orchestration/validate.ts`; PROPOSAL: reporting]

**Known structural gap:** `MAX_SAME_PROTEIN_PER_DAY=2` applies to broad `proteinType`, and all vegan recipes carry plant. Three/five all-vegan meal slots are infeasible regardless of catalogue size. Do not invent mixed classifications or add duplicate plant recipes as a workaround. Implement an explicit evidence-backed plant protein-family variety policy (e.g. distinct legumes/soy/grains/nuts) with defaults preserving animal-protein safeguards, or visibly report vegan schedules unsupported until that scoped policy is implemented. [VERIFIED: `frontend-new/lib/orchestration/schedule.ts`, `canUseCandidate` filtering; PROPOSAL: policy solution]

**Recommended bounded scope:** calculation/conversion engine; immutable evidence contracts; new-review enforcement/reviewer breakdown; deterministic pending-draft preparation; real coverage diagnostics; a small sourced ingredient/recipe demonstration slice plus synthetic e2e fixtures. Catalogue expansion is complete only when actual reviewed content meets explicitly named supported profiles. Human cook-through/rights confirmation remains real operational work, not an automated pass. [PROPOSAL]

The five `OVONA_ORIGINAL_RECIPE_SEEDS` are pending only and include names/IDs that do not match current taxonomy (`chicken-breast` versus taxonomy chicken, for example). Reuse draft content only after checking taxonomy, measured quantities and nutrient evidence; do not promote the seed file automatically. [VERIFIED: `frontend-new/lib/recipes/ovona-original-seeds.ts`; `frontend-new/lib/recipes/taxonomy.ts`]

## Nutrition source choice

The official UK CoFID publication offers the 2021 workbook and user guide; the page was last updated 19 March 2021. Its guide describes evaluation of food composition data and permits reuse under OGL v3 subject to identified third-party material. [CITED: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid ; https://assets.publishing.service.gov.uk/media/60538e66d3bf7f03249bac58/McCance_and_Widdowsons_Composition_of_Foods_integrated_dataset_2021.pdf]

Use a pinned, attributed, narrow extraction from an official dataset or explicit supplier-label evidence. Missing/trace values require explicit parsing policy; do not silently coerce unknown cells to zero. Exact CoFID food mappings have not been selected or validated in this research. Do not claim a named recipe's nutrition is verified until its actual rows, basis and state are checked. [PROPOSAL; source mapping work remains open]

## Don't Hand-Roll

| Problem | Reuse | Avoid |
|---|---|---|
| Recipe approval/auth/atomicity | Existing reviewer guard, lifecycle and RPC | Parallel review write path |
| Dietary/allergen admission | `approveRecipe`, taxonomy, saved constraint merger | Inferring safety from nutrient database text |
| Planning feasibility | `buildDeterministicPlanningInput`, `orchestrateWeek` | Separate simplified feasibility algorithm |
| Import review state | `createPendingRecipeImport` | Pre-setting reviewed flags to make coverage green |
| Test database isolation | `baselineDatabaseTarget` guard | Loading `.env.local` for destructive database tests |

[VERIFIED: named modules and `frontend-new/scripts/baseline-database-target.ts`; recommendation based on their inspected contracts]

## Common Pitfalls

- Source snapshots changing without recipe-version changes would make old plans irreproducible; pin data and calculation policy versions. [PROPOSAL]
- Batch/serving/portion/household scaling must not multiply twice. Existing adapter, validator, shopping materialization and final ingredient ledger use different stages of that contract. [VERIFIED: `candidate-adapter.ts`; `approval.ts`; `orchestration/shopping.ts`; `ingredient-ledger.ts`]
- The final ledger currently groups exact name/unit combinations and aliases each/unit/slice to piece; it does not convert kg to g. Preserve its final-ingredient role; shared exact unit normalization can be reused there later, but plan revision persistence remains Phase 3. [VERIFIED: `frontend-new/lib/ingredient-ledger.ts`; `.planning/mvp-reset/ROADMAP.md`]
- The import CLI currently checks only pending flags before upserting; `createPendingRecipeImport` performs stronger structural/source/audit validation. Reuse the latter in any new nutrition preparation/import path rather than copying the weak CLI check. [VERIFIED: `frontend-new/scripts/import-recipe-library.cjs`; `frontend-new/lib/recipes/imports.ts`]
- Do not equate a database row's approved flag with numerical consistency; current JSON schema checks do not recalculate nutrients. [VERIFIED: `20261012_recipe_library.sql`; `repository.ts`]

## Runtime State Inventory

| Category | Verified finding | Planned action |
|---|---|---|
| Stored data | `recipe_library` stores complete JSON records keyed id/version; approved rows are immutable | Additive contracts; no rewrite of hosted rows |
| Live service config | No hosted deployment inspection performed in this research | Do not infer deployed migration state |
| OS registered state | No OS change required by proposed domain modules | None |
| Secrets/environment | Existing app uses Supabase environment; database test harness demands explicit disposable variables | Never copy app environment into tests |
| Build artifacts | Existing dependencies installed; Node available | No install required |

[VERIFIED: migrations, test harness, package inspection and executable probe; uninspected state explicitly noted]

## Environment Availability

Node v24.11.1 and installed TypeScript/Supabase dependencies executed successfully. This child's probes found neither `%LOCALAPPDATA%/OvonaTools/supabase/supabase.exe` nor `%LOCALAPPDATA%/OvonaTools/postgres/pgsql/bin/psql.exe`, and no 54321 listener. The parent history records prior local tools/DB success, so recheck the parent environment rather than treating old process handles as live. [VERIFIED: executed path/listener probes 2026-10-29; parent history]

Database integration needs an actually available fresh disposable target; retain guard failure as BLOCKED rather than skip/pass. Pure calculation, route mock and coverage tests do not require a database. [VERIFIED: `tests/database/baseline.integration.test.ts`; PROPOSAL: phase test separation]

## Validation Architecture

Nyquist validation is enabled. Existing framework is Node built-in test runner; quick command `node --test tests/orchestration/recipe-nutrition.test.ts`; full command `npm run test:orchestration`, then `npx tsc --noEmit --incremental false` and `npm run lint`. [VERIFIED: `.planning/config.json`; `frontend-new/package.json`; PROPOSAL: new filename]

| Requirement area | Required tests |
|---|---|
| Units/servings | kg/g, l/ml, source-volume basis, explicit density/count conversion; missing/invalid/negative/nonfinite evidence; raw/cooked mismatch; multi-serving batch |
| Calculation | Hand-computable synthetic line/batch/serving expectations; stable rounding; no input mutation; source revision changes; missing source/unknown is not zero |
| Approval | Complete calculation approved; tampered macros/source/conversion rejected; legacy reads retained; no new calculated badge on legacy |
| Planning | Calculated per-serving macros admitted through real adapter and scaled once; final validator agrees; restrictions remain hard |
| Coverage | Duplicate snack demand, insufficient safe slots, capacity versus actual feasibility, honest legacy/draft exclusions, deterministic report |
| Database | New migration bootstrap/order and access protections if new tables/RPCs are introduced; immutable source/approved versions; rollback |

[PROPOSAL grounded in inspected contracts]

Wave 0: add meaningful hand-calculated synthetic fixtures and explicit supported-profile matrix; no framework installation. Sample focused tests per task; full suite once per integrated wave and at final gate. Preserve the existing Phase 1 103-test baseline as regression coverage. [VERIFIED: Phase 1 reports; PROPOSAL: sampling]

## Security Domain

Applicable control areas: authentication/session handling on reviewer routes; reviewer role and service-only writes; input validation for source snapshots/quantities; immutable provenance. Reuse verified `getUser`/reviewer guards and JSON validators. Never put service keys or supplier credentials into browser-visible evidence. [VERIFIED: `frontend-new/app/api/recipe-review/route.ts`; `frontend-new/lib/recipe-reviewer.ts`; PROPOSAL: extending same boundaries]

No new crypto scheme or arbitrary source-URL fetching is required. Prefer fixed official-source imports with explicit file input; if server-side downloads are added, restrict permitted schemes/hosts and payload size to prevent SSRF and unbounded ingestion. [PROPOSAL]

## Assumptions Log

No unverified factual claim is used as a locked decision. Proposed schemas, supported-profile breadth, exact source mappings and review policy are recommendations for the planner, not assertions that functionality exists. [VERIFIED: scope of this research]

## Planning resolutions

All three research questions were resolved in the executable plans; none remains an architectural blocker.

1. **Resolved — supported probe matrix:** Plan 02-03 task 2 names seven diagnostic cohorts, including mixed three/five meals, vegetarian, vegan, pescatarian, a strict preparation limit and the reported restrictive five-meal profile. Plan 02-04 task 2 reports actual reviewed coverage and content shortfalls; the matrix does not claim universal feasibility. [DECIDED: `02-03-PLAN.md`; `02-04-PLAN.md`]
2. **Resolved — human content review:** Plan 02-04 retains pending status for prepared real recipes and explicitly reports remaining source-rights/cook-through review through the existing five-attestation workspace. Software checks do not auto-attest or establish genuine reviewed coverage. [DECIDED: `02-04-PLAN.md`]
3. **Resolved — nutrition transition:** All new approval conversions require complete calculated evidence, including the exported import converter and operational CLI boundaries. Previously approved legacy versions remain readable and plannable with honest labels; deleting the optional calculation or changing its method cannot bypass the new-approval gate. [DECIDED: `02-02-PLAN.md`; parent confirmation 2026-10-29]

## Sources and Confidence

HIGH: inspected repository files explicitly cited above, executed deterministic draft export, Node/tool probes. HIGH: official GOV.UK CoFID publication and official user guide opened 2026-10-29. MEDIUM: recommended scope and architecture because exact source rows/content review remain implementation work. No package upgrade recommendation or external nutrition values were invented. [VERIFIED: research actions]

Valid until code or phase decisions change; external source metadata should be rechecked at ingestion. [PROPOSAL]
