---
status: investigating
trigger: "approved recipes are not reflected and the shopping list still appears not to update correctly"
created: 2026-10-14T00:00:00+01:00
updated: 2026-10-14T00:00:00+01:00
---

## Current Focus

hypothesis: The meal routes intermittently use an invalid Supabase cookie client under Next 16 because the asynchronous cookie store is passed directly to a helper that reads it synchronously.
test: Resolve the cookie store before creating the legacy auth-helper client, then retry generation and inspect the structured rejection log if it still fails.
expecting: State, generation, and shopping routes all resolve the session consistently; any remaining plan rejection reports its exact safe validation reason.
next_action: Ask the user to retry Make a new plan once, then inspect the server log only if a structured validation failure remains.

## Symptoms

expected: After the user approves recipes and regenerates a checked meal plan, the weekly shopping list must derive solely from that current plan's final meal ingredient JSON.
actual: User reports approved recipes are not reflected and the shopping list still appears not to update correctly.
errors: None reported.
reproduction: On /meals, approve recipes via /review-recipes, regenerate plan, inspect shopping list.
started: Persisted from legacy plan/list behavior; a prior change posts current plan to /api/shopping-list but user reports it remains wrong.

## Eliminated

## Evidence

- timestamp: 2026-10-14T00:00:00+01:00
  checked: Client shopping effect, shopping-list API, ingredient ledger, and plan persistence route.
  found: The client POSTs the in-memory plan to /api/shopping-list after plan changes; the API rebuilds using buildShoppingList, which delegates only to buildFinalIngredientLedger over final meal ingredients. The plan-state write deletes any previous shopping-list row for that week.
  implication: A persisted shopping-list cache alone cannot explain an unchanged list after a successful client-side replacement. Primary candidates are an unsuccessful plan regeneration or a later asynchronous response overwriting current state.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Live Supabase recipe-library and plan-history metadata via a read-only service-role query.
  found: There are 22 approved recipes. The latest persisted plan has 7 days and 35 meals, includes an unapproved legacy recipe identity, and every stored meal has no recipe version. Its latest 23-item shopping-list row references that same plan.
  implication: The shopping list is synchronized to the current persisted plan. A checked replacement has not been saved, matching the observed 422 insufficient-reviewed-catalogue response.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Approved recipe slot coverage, stored planning preferences, context defaults, scheduler repetition policy, and generation error path.
  found: The user has five meals per day and no explicit preparation limit. The backend treated that unset value as 15 minutes, while the UI labelled it “No time limit.” Only one approved lunch/dinner recipe is at or below 15 minutes; the two-use weekly cap exhausts it on day three.
  implication: The 422 was caused by a UI/backend constraint mismatch, rather than stale shopping-list data.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Targeted implementation and static validation.
  found: The backend now uses a 30-minute standard when no limit is saved, the preference UI names that standard, and candidate-capacity failures report the affected meal type and next action. TypeScript compilation and 8 focused orchestration tests pass.
  implication: Existing explicit 10/15-minute preferences remain hard limits; unset preferences can use the current reviewed catalogue.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Live regeneration after the 30-minute fallback change.
  found: The UI still reports “This plan couldn't pass recipe checks” and retains the legacy plan.
  implication: The scheduler availability fix alone is insufficient; the final plan-approval boundary must be investigated before any further change.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Live server status and generate-plan AI proposal path.
  found: The live request returns 503. generateWeeklyPlanWithArtifacts calls OpenAI whenever a key exists and throws when the model times out, refuses, is unavailable, or emits invalid ranking JSON, despite the candidates already being server-loaded reviewed recipes.
  implication: AI ranking availability—not recipe evidence or the shopping ledger—is preventing the checked plan from being persisted.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: generate-plan optional AI-ranking branch and approval failure serialization.
  found: The branch threw 503 for any unavailable, refused, timed-out, or malformed model ranking, even though the deterministic scheduler uses only reviewed server records. The final approval error also discarded its first actionable validation message.
  implication: The request was failing because an optional ranker was treated as a required source of truth.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: TypeScript and focused orchestration tests after the change.
  found: TypeScript passes. AI proposal and generation-adapter tests pass. The meal-approval suite has one existing failure in `approveRecipe` allergy/dietary mapping, outside the changed plan-boundary path; 11 of 12 assertions pass.
  implication: The fallback compiles and preserves reviewed-candidate verification. End-to-end live generation remains the required verification.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Live approved recipe-library slot coverage and integrity after the user approved every remaining draft.
  found: There are 38 approved records: 12 breakfast, 15 snack, 18 lunch, and 18 dinner slots. Every approved record has a measured method. At the standard 30-minute limit, only three records are excluded by the saved hard restrictions.
  implication: The repeated failure is not caused by missing approved snack coverage or unrepaired imports; it occurs later in the generation pipeline.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Development-server logs covering state load, shopping-list rebuilds, and generation attempts.
  found: Next 16 reports that `cookies()` returns a Promise, followed by `nextCookies.get is not a function` in `supabaseServer`. The legacy route helper reads the supplied cookie callback synchronously; bearer fallback masks this for some requests but not reliably.
  implication: The authenticated app flow is unstable independently of recipe eligibility. The server client must resolve the Next 16 cookie store first and pass the resolved synchronous store to the legacy helper.
- timestamp: 2026-10-14T00:00:00+01:00
  checked: Targeted server-client change and focused orchestration regression tests.
  found: `supabaseServer` now awaits `cookies()` before constructing the Supabase helper client. The generation route also logs only structured status/code/reasons when rejecting. TypeScript compilation passes and 11 generation, scheduling, and plan-boundary tests pass.
  implication: The route-level session failure is fixed and any remaining 422 can be diagnosed from a specific safe reason rather than guessed from catalogue size.

## Resolution

root_cause: Multiple blockers kept the legacy plan in place: an unset max-prep preference became an implicit 15-minute hard limit; an unavailable optional OpenAI ranker threw a 503 instead of allowing deterministic reviewed scheduling; and the Next 16 async cookie store was passed to a legacy Supabase helper as though it were synchronous, causing authenticated route errors. The approved catalogue itself has adequate coverage.
fix: Changed the unset preparation-time fallback to 30 minutes, made AI-ranking failures fall back to deterministic reviewed scheduling, made final approval failures state an actionable reason, resolved the Next 16 cookie store before passing it to the legacy auth helper, and added structured server logging for remaining plan rejections.
verification: Live Supabase query confirms 38 approved records with 12 breakfast, 15 snack, 18 lunch, and 18 dinner slots; all have methods. TypeScript passes. Eleven focused generation, schedule, and plan-boundary tests pass. One authenticated browser retry is still required to verify the replacement plan persists and the ingredient ledger rebuilds.
files_changed: [frontend-new/lib/generation/context-builder.ts, frontend-new/lib/generation/generate-plan.ts, frontend-new/lib/recipes/plan-boundary.ts, frontend-new/app/meals/page.tsx, frontend-new/lib/supabaseServer.ts, frontend-new/app/api/meal-plan/route.ts]
