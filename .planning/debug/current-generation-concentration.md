---
status: fixing
trigger: "2590 grams of Egg whites; generating different meals every time"
created: 2026-10-29
updated: 2026-10-29
---

## Current Focus

hypothesis: Weekly protein caps inspect broad taxonomy IDs rather than exact ingredient names, so egg whites mapped to egg evade their explicit cap.
test: Reproduce with actual recipe-to-candidate mapping and materialized quantities; inspect history scoring separately.
expecting: A 2590g egg-white week currently passes the practical gate despite its 1000g/adult policy.
next_action: Fix specific-name matching and exact kg conversion, then verify regression and inspect recency identity.

## Symptoms

expected: Practical weekly ingredient quantities, safely varied meals on regeneration, unchanged allergy/macro safeguards.
actual: User reports 2590g egg whites and repeated generated meals. Excess decimal display is handled by another agent.
errors: No runtime error reported.
reproduction: Generate weekly plan and inspect shopping list.
started: Current local app.

## Evidence

- Actual recipe mapper sets ingredient.normalizedName to canonicalId, retaining the specific display name separately.
- Practical gate matches normalizedName only and ignores every unit except g. Its egg-white regex does not match the taxonomy ID egg.
- Scheduler checks this gate at each completed day and final validation; a matching defect can therefore survive both guards.
- Two test-first reproductions fail before repair: actual recipe mapper admits seven 370g Egg whites servings under canonical egg (2590g) with no practical violation, and 1.001kg also bypasses the guard.

## Eliminated

## Resolution

root_cause:
fix:
verification:
files_changed: []

## Verified resolution — 2026-10-29

Status: generation failure repaired and verified in the real localhost:3000 application.

Root causes: the egg-white cap matched canonical `egg` instead of its specific display name; rotation identities disagreed; one shared daily portion multiplier falsely rejected feasible mixed portions; broad poultry/plant repetition groups restricted legitimate combinations; greedy day choices and history ranking exhausted bounded search despite a feasible reviewed week.

Repair: match specific ingredients and g/kg units, enforce caps again after materialization, solve bounded individual portions, derive protein families from reviewed ingredients, backtrack across complete days, and retry deterministic neutral candidate ranking if optional ranking fails. Allergy exclusions, reviewed-recipe admission, calorie/protein bands, portion bounds, and weekly practical caps remain enforced. Regeneration still rejects an identical week. Persist the complete preference signature so the generated plan survives reload.

Verification:
- Actual UI generation succeeded; reload restored the same seven-day, 35-meal plan.
- Read-only hosted persistence check: egg whites 943.0333g/week (previously 2590.3494g), chicken 1067.9412g, turkey 729.2838g. Weekly limits respectively 1000g, 1400g, 1200g.
- Actual shopping UI: 943g egg whites, 9g cocoa powder, 648g cucumber; display rounding does not alter stored ingredient quantities.
- Thursday: 1946 kcal / 216g protein against 1830 kcal / 216g targets, within configured bands.
- Full orchestration regression: 172 passed, zero failed/skipped. TypeScript and focused ESLint passed.
- Screenshot: `.planning/debug/planner-fixed.png`.

Limits/outstanding: hosted `save_safety_preferences` RPC still returns PGRST202; user must run supplied `preferences-repair.sql` in Supabase. Reloaded plans deliberately receive generic unchecked approval from the existing state endpoint and show its warning; persistence alone does not establish fresh recipe approval. Retailer pricing remains unavailable. Earlier lower-bound analysis suggesting egg whites were unavoidable was conditional on the defective grouping/shared-portion rules, not proof of catalogue-wide infeasibility.
