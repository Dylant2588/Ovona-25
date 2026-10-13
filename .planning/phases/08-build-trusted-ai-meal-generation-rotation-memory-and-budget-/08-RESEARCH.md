# Phase 8: Trusted AI meal generation, rotation memory, and budget-aware retailer planning - Research

**Researched:** 2026-10-13  
**Domain:** Evidence-gated AI meal planning, rotation history, and retailer basket comparisons  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- OpenAI may propose meal combinations and turn a reviewed recipe record into
  a tailored weekly plan.
- Every proposed meal must be checked against persisted preference, dietary,
  allergy, ingredient, nutrition, and method evidence before the plan can be
  stored or shown as checked.
- A failed or incomplete check keeps the existing plan unchanged and exposes a
  clear reason; there is no silent fallback to unreviewed AI recipes.
- The recipe library needs provenance, versioned review status, ingredients,
  method, nutrition evidence, and an approval workflow suitable for trusted
  source imports.

- Look back over the previous fourteen days of accepted/eaten plan meals.
- Avoid repeating the same named recipe during that period where a suitable
  alternative exists; actively vary protein source, cuisine, and format.
- Users do not curate recipes one at a time. Generation should make the week
  for them, with swap/regenerate available after the fact.

- The user sets a general weekly food budget, not a mandatory retailer before
  generation.
- After meals are selected, compare evidence-backed baskets and present the
  best retailer/basket plus price confidence and unmatched items.
- Do not say a basket is cheapest or within budget when prices are estimates,
  stale, incomplete, or lack retailer provenance.

- A declared Meal out is allowed as a nutrition-unknown exception, excluded
  from the shopping list, and visibly distinct from approved recipes.
- Individual-user POC remains the scope. Household, family and medical
  expansion remain later work.

### Claude's Discretion
- Which trusted source ingestion format to use first.
- Whether AI ranks reviewed candidates, creates a structured candidate draft,
  or both, provided it cannot bypass approval.
- UI placement and exact presentation for budget and confidence states.

### Deferred Ideas (OUT OF SCOPE)
- Family and household planning.
- Health-condition expansion beyond existing explicit constraints.
- Social sharing; only the single-user Meal out exception is in current scope.
</user_constraints>

## Summary

Build Phase 8 around a strict two-stage trust model: imported recipe and price records are reviewed and versioned first; OpenAI only selects or proposes a structured draft whose references resolve to those records. The server must re-load the records and run the existing approval boundary immediately before every display-as-checked or persistence path. The current `approvePlanForUser` already fails closed when the recipe library, constraints, ingredient evidence, method, nutrition, identity/version, meals-per-day, or macro limits are invalid. [VERIFIED: codebase `frontend-new/lib/recipes/plan-boundary.ts`, `approval.ts`, `repository.ts`]

The repository already contains most of the internal plumbing: `recipe_library` preserves an immutable approved version, `user_meal_history` is queried over 14 days, and the deterministic orchestrator penalizes recent candidate IDs and rejects unsafe or over-repeated choices. Phase 8 should complete the missing operational evidence: write accepted/eaten history consistently, make history identity version-aware, persist retailer product observations, and calculate retailer comparisons only when every advertised basket claim is traceable and fresh. [VERIFIED: codebase `20261012_recipe_library.sql`, `context-builder.ts`, `orchestration/{candidate-adapter,score,schedule}.ts`, `tesco-prices.ts`]

**Primary recommendation:** Use OpenAI Structured Outputs only for a constrained planning suggestion (`recipeId`, `recipeVersion`, slot, ranking rationale); use the reviewed Supabase library, deterministic orchestration, and approval boundary as the sole authority for nutrition, allergen, ingredient, method, and price claims. [CITED: https://developers.openai.com/api/docs/guides/structured-outputs] [VERIFIED: codebase `frontend-new/lib/recipes/plan-boundary.ts`]

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists in this workspace. [VERIFIED: filesystem check 2026-10-13]

Applicable repository constraints from `AGENTS.md`: keep the Next.js App Router + Supabase + OpenAI SDK stack; use compatibility-safe Supabase writes; favor deterministic fallbacks for responsive local/dev use; keep the individual POC focused; preserve strict TypeScript, MUI UI conventions, structured API errors, and server-side `resolveRequestAuth`. [VERIFIED: `AGENTS.md`]

## Standard Stack

### Core

| Library / component | Version | Purpose | Why standard |
|---|---:|---|---|
| Existing `openai` Node SDK | `^4.104.0` installed | Produce structured candidate/ranking suggestions only | It keeps AI output inside the existing stack; Structured Outputs can constrain a model response to a supplied schema, while server evidence checks remain mandatory. [VERIFIED: `frontend-new/package.json`] [CITED: https://developers.openai.com/api/docs/guides/structured-outputs] |
| Existing Supabase/Postgres | existing project service | Versioned recipe, provenance, price-observation, and user-history persistence | RLS provides row-level authorization; new exposed tables require grants, RLS policies, tests, and indexes on policy filters. [VERIFIED: `frontend-new/supabase/migrations/20260810173000_production_rls_policies.sql`] [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| Existing recipe approval boundary | local | Authoritative pre-display/pre-write safety gate | It already rejects non-approved records, altered ingredient/method/macro/version fields, unsafe portions, and unmet targets. [VERIFIED: `frontend-new/lib/recipes/{approval,plan-boundary}.ts`] |
| Existing deterministic orchestration | local | Schedule approved candidates with variety and bounded nutrition repair | It is deterministic, filters hard constraints, prevents same/similar use except explicit leftovers, and returns reason-coded failure. [VERIFIED: `frontend-new/lib/orchestration/{schedule,validate,score}.ts`] |

### Supporting

| Component | Purpose | When to use |
|---|---|---|
| `recipe_library` JSON record + immutable approved rows | Recipe source/rights, method, ingredient, nutrition, and review evidence | Continue its documented review workflow; add importer metadata only as a backward-compatible JSON-field extension or a sibling table. [VERIFIED: `20261012_recipe_library.sql`, `lib/recipes/REVIEW.md`] |
| `user_meal_history` | Canonical user rotation evidence | Write one id/version/title/protein/cuisine/format record per accepted plan meal; update its state when the user marks it eaten. [VERIFIED: `20260217_generation_pipeline.sql`, `context-builder.ts`] |
| Retailer price-observation table | Product match, pack, price, currency, retailer source URL/identifier, observed-at timestamp, and confidence | Required before exposing retailer-specific totals, “best”, “within budget”, or “cheapest” wording. [ASSUMED] |
| Node built-in test runner | Unit/integration tests | The repository already runs TypeScript orchestration tests with `node --test`. [VERIFIED: `frontend-new/package.json`] |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| OpenAI ranks reviewed candidates | Let OpenAI generate complete recipes | Rejected for Phase 8: generated ingredients, portions, methods, nutrients, allergy flags, and prices have no persisted evidence until a separate import/review process approves them. [VERIFIED: `08-CONTEXT.md`, `lib/recipes/approval.ts`] |
| Product/retailer price observations | Static `PRICE_DB` values | The local database is suitable only as an explicitly unavailable/estimate development fallback because it contains no retailer, observed-at, source, or provenance fields. [VERIFIED: `lib/tesco-prices.ts`] |
| Versioned append-only recipe records | Overwriting an approved JSON record | Rejected: the current database trigger prevents version changes to approved recipes, preserving the identity referenced by a checked meal. [VERIFIED: `20261012_recipe_library.sql`] |

**Installation:** No new package is required for the recommended Phase 8 implementation. [VERIFIED: `frontend-new/package.json`]

## Architecture Patterns

### Recommended Project Structure

```text
frontend-new/
├── lib/recipes/                 # existing evidence schemas, import/review and approval
├── lib/generation/              # context, optional AI suggestion adapter, checked plan build
├── lib/orchestration/           # deterministic candidate schedule and rotation scoring
├── lib/pricing/                 # retailer observations, matching, basket comparison/confidence
├── app/api/meal-plan/           # thin auth/orchestration routes
├── app/api/shopping-list/       # persisted list plus basket-comparison response
└── supabase/migrations/         # versioned schema + RLS/grants/indexes
```

### Pattern 1: Evidence-first recipe import and review

**What:** Import a recipe into a pending version carrying source/rights reference, normalized ingredients, measured method, nutrition reference/method, and reviewer audit metadata. Only an explicit server-side review transition produces an approved version. [VERIFIED: `lib/recipes/types.ts`, `lib/recipes/REVIEW.md`, `20261012_recipe_library.sql`]

**When to use:** Every seed, licensed, public-domain, or imported recipe. A model-created draft may be stored as `pending_review` but must never become a selectable candidate automatically. [VERIFIED: `08-CONTEXT.md`, `lib/recipes/repository.ts`]

**Implementation prescription:** First ingestion format should be a reviewed JSONL/JSON batch checked into an internal admin-only import path, because the existing `RecipeRecord` is JSON-shaped and its exporter already produces deterministic drafts. Retain source URL/reference, rights, importer, imported-at, content hash, and review decision in record or audit table. [VERIFIED: `lib/recipes/types.ts`, `scripts/export-recipe-library.cjs`] [ASSUMED: JSONL is the best first ingestion format]

### Pattern 2: AI is a non-authoritative candidate/ranking adapter

**What:** Send the model only current user constraints plus a bounded list of approved recipe IDs/versions and safe metadata. Require a strict schema containing IDs, versions, requested slot, ordering, and non-factual explanation. Resolve every returned reference against the database; discard unknown, stale, duplicate, or disallowed selections before orchestration. [CITED: https://developers.openai.com/api/docs/guides/structured-outputs] [VERIFIED: `lib/orchestration/candidate-adapter.ts`, `lib/recipes/approval.ts`]

**When to use:** To improve composition and variety after enough reviewed candidates exist. The deterministic scheduler remains the availability and safety fallback. [VERIFIED: `AGENTS.md`, `lib/orchestration/schedule.ts`]

**Example:**

```typescript
// Server-only: model output is only a proposal, never recipe evidence.
type AiSuggestion = {
  choices: Array<{ recipeId: string; recipeVersion: number; slot: MealSlot }>;
};

const allowed = new Map(reviewedRecipes.map((r) => [`${r.id}:${r.version}`, r]));
const proposed = suggestion.choices
  .map((choice) => allowed.get(`${choice.recipeId}:${choice.recipeVersion}`))
  .filter((recipe): recipe is RecipeRecord => Boolean(recipe));
const scheduled = orchestrateWeek(profile, toVerifiedCandidates(proposed), history);
// approvePlanForUser() must run again before any response marked `checked` or write.
```

Source: existing candidate/approval architecture. [VERIFIED: `lib/orchestration/candidate-adapter.ts`, `lib/recipes/plan-boundary.ts`]

### Pattern 3: Persist accepted/eaten rotation history at the approval boundary

**What:** Treat a successfully approved and persisted plan as `accepted`; treat meal-log state `eaten` as a stronger signal. Query exactly `[today - 14 calendar days, today]`, preserving `recipe_id`, `recipe_version`, normalized title/similarity key, protein type, cuisine, format, date, and state. [VERIFIED: `08-CONTEXT.md`, `context-builder.ts`] [ASSUMED: proposed full history payload]

**When to use:** On successful plan-state persistence and `meal_logs` updates. Do not write history for an AI suggestion that failed approval or for an abandoned response. [VERIFIED: `lib/recipes/plan-boundary.ts`, `app/api/meal-plan/state/route.ts`]

**Selection rule:** Exclude the same recipe identity/name during the 14-day window where an eligible alternative exists. Score protein source, cuisine, and format diversity as soft penalties so scarcity returns a safe checked plan instead of failing unnecessarily. [VERIFIED: `08-CONTEXT.md`] [ASSUMED: exact history scoring policy]

### Pattern 4: Retailer comparison is evidence-gated and claim-aware

**What:** Normalize shopping-list ingredients, match them to retailer product observations, calculate packs and totals per retailer, then assign a confidence state before wording the result. [VERIFIED: `lib/tesco-prices.ts`, `app/api/shopping-list/route.ts`] [ASSUMED: retailer observation schema and confidence policy]

**Claim policy:**

| Evidence state | Allowed user-facing language | Forbidden language |
|---|---|---|
| Complete, retailer-provenanced, fresh observations for every required item | “Lowest observed complete basket” and “within budget” if total is at or below the budget | “Cheapest” without a stated comparison set/time. [ASSUMED] |
| Any unmatched item, stale observation, estimated conversion, or missing retailer provenance | “Partial/estimated basket; £X covers matched items” and show unmatched items/age | “Best retailer”, “cheapest”, or “within budget”. [VERIFIED: `08-CONTEXT.md`] |
| No observation data | “Retailer pricing unavailable” | Any monetary retailer claim. [VERIFIED: `app/api/meal-plan/route.ts`, `08-CONTEXT.md`] |

### Anti-Patterns to Avoid

- **Treating model JSON as verified data:** Schema conformance is not evidence of factual correctness; resolve IDs and re-run server approval. [CITED: https://developers.openai.com/api/docs/guides/structured-outputs] [VERIFIED: `lib/recipes/approval.ts`]
- **Overwriting approved records:** Add a new version and link a review/audit entry; the current trigger intentionally protects approved version identity. [VERIFIED: `20261012_recipe_library.sql`]
- **Writing plan history before approval:** Write only through `writeApprovedPlan` or an equivalent callback that has just passed fresh approval. [VERIFIED: `lib/recipes/plan-boundary.ts`]
- **Calling the static price map retailer evidence:** It has no retailer/provenance/freshness metadata. [VERIFIED: `lib/tesco-prices.ts`]
- **Building a single-retailer result then calling it a comparison:** A comparison requires the same normalized basket evaluated against at least two independently evidenced retailer sets. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use instead | Why |
|---|---|---|---|
| Model response parsing | Free-text parsing/regex | Structured Outputs plus runtime ID/version resolution | A schema makes the proposal bounded; the existing server gate still checks trust. [CITED: https://developers.openai.com/api/docs/guides/structured-outputs] [VERIFIED: `lib/recipes/approval.ts`] |
| Allergy and diet interpretation | Separate AI prompt rules | Existing taxonomy plus `approveRecipe` / `validateMealAgainstRecipe` | It canonicalizes allergy aliases and rejects unknown/conflicting ingredient evidence. [VERIFIED: `lib/recipes/{taxonomy,approval}.ts`] |
| Macro/portion correction | Unbounded model arithmetic | Existing bounded deterministic repair and approval bands | It limits portion multiplier to 0.7–1.5 and returns reason-coded infeasibility. [VERIFIED: `lib/orchestration/validate.ts`, `lib/recipes/approval.ts`] |
| Recipe provenance/review | Boolean “trusted” flag in a prompt | Versioned recipe record plus explicit review/audit state | The plan can retain an immutable recipe identity/version and fail closed. [VERIFIED: `lib/recipes/{types,repository,approval}.ts`, `20261012_recipe_library.sql`] |
| User data isolation | Route-only user-ID filtering | Supabase RLS, grants, per-operation policies, indexes, and tests | Supabase documents RLS/grants as separate controls and recommends policy tests. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |

**Key insight:** The model can make a useful choice only after trusted records define the choice set; it must not manufacture the evidence that authorizes its own output. [VERIFIED: `08-CONTEXT.md`]

## Common Pitfalls

### Pitfall 1: Approval on generation but not on persistence

**What goes wrong:** An approved response is altered by a swap, client payload, or later state save and is stored without a second verification. [VERIFIED: `lib/recipes/plan-boundary.ts`]

**How to avoid:** Make `writeApprovedPlan` (or a route-local equivalent) the only persistence gateway. Call it after generation, swap, regenerate-day, and client-driven state save. Test that every forged recipe version, ingredient, method, macro, owner, or incomplete week performs zero writes. [VERIFIED: `tests/orchestration/meal-approval-integration.test.ts`]

### Pitfall 2: Rotation records that omit the stable recipe identity

**What goes wrong:** Text titles drift or collide, so a rename bypasses the 14-day rule or different recipes are treated as the same one. [ASSUMED]

**How to avoid:** Persist recipe ID + version and a normalized similarity key, with title retained only for display. Query 14 calendar days consistently from one server clock. [VERIFIED: `context-builder.ts`] [ASSUMED: identity fields recommendation]

### Pitfall 3: Unchecked price freshness and coverage

**What goes wrong:** A partial, old, or estimated subtotal is labelled “cheapest” or “under budget.” [VERIFIED: `08-CONTEXT.md`]

**How to avoid:** Return `coverage`, `unmatchedItems`, oldest observation time, count of estimates, retailer source, and a derived `claimable` boolean; the UI must derive wording from that boolean only. [ASSUMED]

### Pitfall 4: Exposed operational source or price tables without full policies

**What goes wrong:** A migration enables an RLS policy but leaves broad grants or omits an operation policy. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]

**How to avoid:** In the same migration: enable RLS, revoke default client grants, grant only required operations, create separate select/insert/update/delete policies, index every policy filter, and add pgTAP allow/deny tests. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]

## Code Examples

### Fail closed before plan storage

```typescript
// `write` is not invoked unless the plan is freshly checked against DB records.
await writeApprovedPlan(supabase, user.id, candidatePlan, async (approved) => {
  await persistApprovedPlan(approved);
  await appendAcceptedMealHistory(approved);
  return approved;
}, preferences);
```

Source: boundary API and its zero-write integration tests. [VERIFIED: `lib/recipes/plan-boundary.ts`, `tests/orchestration/meal-approval-integration.test.ts`]

### Safe retailer claim computation

```typescript
const complete = basket.unmatchedItems.length === 0 && basket.items.every((line) => line.observation?.sourceUrl && line.observation?.observedAt);
const fresh = complete && basket.items.every((line) => isFresh(line.observation!.observedAt));
const claimable = complete && fresh && basket.items.every((line) => !line.estimated);

return {
  retailer: basket.retailer,
  total: basket.total,
  unmatchedItems: basket.unmatchedItems,
  confidence: claimable ? "high" : "partial_or_stale",
  canClaimBest: claimable,
};
```

The exact freshness threshold and confidence labels need a product decision before execution. [ASSUMED]

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Prompt asks a model to return recipe facts | Structured outputs constrain response shape; application data still needs independent validation | Current OpenAI documentation accessed 2026-10-13 | Use schema for selection proposals, not as proof of nutrition/allergen/price facts. [CITED: https://developers.openai.com/api/docs/guides/structured-outputs] |
| Static local price list yields a single total | Provenanced, timestamped product observations enable a qualified comparison | Phase 8 recommendation | Requires new persistence and UI confidence states. [VERIFIED: `lib/tesco-prices.ts`, `08-CONTEXT.md`] |

## Open Questions

1. **What retailer data source has permission, coverage, and a stable product/price interface for the initial UK POC?**
   - What we know: current pricing is a local static map with no retailer provenance. [VERIFIED: `lib/tesco-prices.ts`]
   - What is unclear: the permitted collection/API/affiliate source and refresh cadence. [VERIFIED: codebase inspection 2026-10-13]
   - Recommendation: select one compliant source before plan execution; do not ship retailer ranking until it can populate complete observations. [ASSUMED]
2. **What observation age counts as stale for retail pricing?**
   - What we know: the locked decision forbids “cheapest” or “within budget” claims for stale prices. [VERIFIED: `08-CONTEXT.md`]
   - What is unclear: the threshold and whether promotions are included. [VERIFIED: `08-CONTEXT.md`]
   - Recommendation: make it an explicit server policy constant and expose `observedAt` in the response. [ASSUMED]
3. **Should accepted-but-not-eaten plans count equally with eaten meals for rotation?**
   - What we know: the requirement says accepted/eaten; existing history has one generic table. [VERIFIED: `08-CONTEXT.md`, `20260217_generation_pipeline.sql`]
   - Recommendation: write both states, exclude both from hard same-recipe repetition, and give eaten records a higher variety penalty. [ASSUMED]

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node/npm | Next.js routes and test runner | ✓ | project scripts present | — [VERIFIED: `frontend-new/package.json`] |
| Supabase project/database | reviewed recipes, history, price observations | Unknown from local workspace | — | Fixture-based tests only; deployment verification remains blocked until configured. [VERIFIED: codebase inspection 2026-10-13] |
| OpenAI API key | optional AI candidate/ranking suggestions | Unknown from local workspace | — | deterministic reviewed-catalogue scheduler. [VERIFIED: `lib/generation/nutritionist.ts`, `AGENTS.md`] |
| Retailer product/price source | multi-retailer evidence | ✗ in repository | — | show pricing unavailable; do not claim ranking/budget compliance. [VERIFIED: `lib/tesco-prices.ts`, `08-CONTEXT.md`] |

**Missing dependencies with no fallback:** An authorized retailer price source is required for retailer comparison claims. [VERIFIED: `08-CONTEXT.md`]

**Missing dependencies with fallback:** OpenAI credentials can fall back to deterministic scheduling of approved recipes. [VERIFIED: `AGENTS.md`, `lib/orchestration/schedule.ts`]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node built-in test runner | 
| Config file | none — scripts target `tests/orchestration/*.test.ts` | 
| Quick run command | `npm run test:orchestration` | 
| Full suite command | `npm run lint && npm run test:orchestration` | 

### Phase Requirements → Test Map

| Behavior | Test type | Automated command | File exists? |
|---|---|---|---|
| Pending/forged source, nutrition, ingredient, method, or version cannot produce a checked/persisted plan | unit + integration | `npm run test:orchestration` | ✅ approval/library/boundary tests [VERIFIED: `tests/orchestration/meal-approval*.test.ts`, `recipe-library.test.ts`] |
| AI proposal can select only current reviewed IDs/versions and failure leaves prior state untouched | unit + route integration | `npm run test:orchestration` | ❌ Wave 0 |
| 14-day accepted/eaten history excludes exact recipe where alternatives exist and rewards protein/cuisine/format diversity | unit + integration | `npm run test:orchestration` | ❌ Wave 0 |
| Retailer comparison with complete fresh observations has qualified result; incomplete/stale/unmatched data cannot claim best/within budget | unit + route integration | `npm run test:orchestration` | ❌ Wave 0 |
| New Supabase tables isolate user history while catalog/source/price access follows intended roles | pgTAP RLS | `supabase test db` | ❌ Wave 0; CLI/database availability unverified |

### Sampling Rate

- **Per task commit:** `npm run test:orchestration`
- **Per wave merge:** `npm run lint && npm run test:orchestration`
- **Phase gate:** full suite green and policy/RLS tests green before `/gsd-verify-work`. [VERIFIED: project scripts; Supabase test guidance]

### Wave 0 Gaps

- [ ] Add AI proposal resolver tests for invalid ID/version, duplicate slot, unknown recipe, and refusal/timeout.
- [ ] Add history repository/scoring tests for exact 14-day boundary, accepted/eaten precedence, and scarcity fallback.
- [ ] Add price observation/comparison tests for coverage, stale data, estimates, retailer provenance, and prohibited claim wording.
- [ ] Add Supabase migration/RLS pgTAP tests once a local Supabase test environment is available.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | Yes | Resolve request auth server-side before all plan/history/basket operations. [VERIFIED: `lib/serverAuth.ts` usage in routes] |
| V3 Session Management | Yes | Existing cookie/bearer resolver and explicit transient/unauthorized route responses. [VERIFIED: `app/api/meal-plan/state/route.ts`] |
| V4 Access Control | Yes | Supabase RLS/grants/policies for user-scoped records; server-only review/import privileges. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| V5 Input Validation | Yes | Runtime recipe approval, finite numeric checks, exact identity/version checks, and strict date validation. [VERIFIED: `lib/recipes/{repository,approval,plan-boundary}.ts`] |
| V6 Cryptography | No new Phase 8 cryptographic function | Use platform TLS/secrets; do not hand-roll cryptography. [ASSUMED] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Client or model forges a reviewed recipe/version/nutrition/method | Tampering | Re-load approved record and validate exact ID/version/ingredients/steps/macros before rendering checked or persisting. [VERIFIED: `lib/recipes/approval.ts`] |
| User reads or mutates another user’s history/plan | Information disclosure / tampering | Auth check plus RLS policy on `user_id`, least-privilege grants, and RLS tests. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| Prompt causes authoritative-seeming unsupported nutrition/price advice | Tampering / spoofing | Model has no authority to emit verified facts; only approved records and qualified observations support UI claims. [VERIFIED: `08-CONTEXT.md`] |
| Approved recipe is silently overwritten | Tampering | Immutable approved version plus a new reviewed version for corrections. [VERIFIED: `20261012_recipe_library.sql`] |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | JSONL/JSON batch import is the best initial trusted-source ingestion format | Architecture Pattern 1 | Import workflow may need a different operational interface. |
| A2 | Retailer observations need a separate timestamped/provenanced schema and a configurable freshness policy | Supporting / Pattern 4 | Data model and product language may need adjustment for the selected provider. |
| A3 | Recipe ID/version plus similarity key and optional cuisine/format is the right rotation payload | Pattern 3 | Variety scoring could under/over-penalize repetition. |
| A4 | Complete, fresh, non-estimated coverage is required before a “best retailer” claim | Pattern 4 | Product may set a different qualified-claim policy. |
| A5 | Accepted and eaten history should be weighted differently | Open Questions | Rotation behavior needs product calibration. |

## Sources

### Primary (HIGH confidence)

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) — current schema-constrained response guidance.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — grants, RLS, policy and test guidance.
- Repository sources: `frontend-new/lib/recipes/*`, `lib/orchestration/*`, `lib/generation/*`, `lib/tesco-prices.ts`, `app/api/{meal-plan,shopping-list}/*`, and migrations `20260217_generation_pipeline.sql`, `20261012_recipe_library.sql`, `20260810173000_production_rls_policies.sql`.

### Secondary (MEDIUM confidence)

- [Food Standards Agency allergen guidance](https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses) — consulted as a UK domain reference; repository safety architecture remains the implementation authority.

### Tertiary (LOW confidence)

- None; unverified design recommendations are explicitly marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing code/migrations plus current official documentation.
- Architecture: HIGH — it extends existing reviewed-library and deterministic-scheduler boundaries; price-source schema details remain assumed.
- Pitfalls: HIGH — enforced by current tests/code and locked Phase 8 decisions.

**Research date:** 2026-10-13  
**Valid until:** 2026-11-12, except retailer-provider terms/freshness data which must be revalidated when the source is selected.
