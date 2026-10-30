---
status: awaiting_human_verify
trigger: "Investigate and fix the production macro feasibility failure in Ovona fallback meal generation."
created: 2026-09-11T00:00:00+01:00
updated: 2026-09-11T00:35:00+01:00
---

## Current Focus

hypothesis: Confirmed and self-verified — the restricted static catalogue could not meet the profile's per-slot protein share, and in-place enforcement inflated failed plans.
test: Verify in the authenticated production workflow with the exact saved profile.
expecting: A generated fallback plan is safe and within the displayed calorie/protein bounds, or an explicit incomplete response retains normal portions rather than a 3,000 kcal plan.
next_action: Await end-to-end human verification after deployment.

## Symptoms

expected: with saved targets 1,830 kcal/day, 216g protein/day, 118g carbs, 55g fat and allergies Dairy/Shellfish/Nuts/Fish/Sesame, generation must not return a plan around 3,000 kcal/day and 160g protein falsely presented as a usable plan. It must construct a safe, feasible high-protein plan or return transparent infeasibility.
actual: authenticated fresh production Generate plan returns ~3,003 kcal/day and 160g protein/day; all 5 days marked partial. Existing day cards show 1.5 portions.
errors: none reported
reproduction: use the exact profile values above and five meals/day. The latest published fixes added hard-safe availability but not macro feasibility.
started: present after latest hard-safe availability fixes

## Eliminated

## Evidence

- timestamp: 2026-09-11T00:00:00+01:00
  checked: Debug-session setup and supplied production symptoms
  found: The issue is deterministic for a saved, allergen-restricted high-protein profile and reports partial days despite a severe 64% calorie overshoot and 26% protein shortfall.
  implication: This is a feasibility/acceptance failure, not a claim that every exact macro profile can necessarily be satisfied.
- timestamp: 2026-09-11T00:15:00+01:00
  checked: Exact-profile fallback probe followed by macro enforcement
  found: Every day was partial at 3,102-3,168 kcal and 169-178g protein, with all five portions at 1.5. The hard-safe pool contains only a low-protein oats breakfast, white-bean snack, tofu meals, egg meals, and turkey chili; the protein-dense dairy/fish/nut meals are correctly excluded.
  implication: Portion scaling cannot turn this pool into a 1,830 kcal / 216g protein plan. The unsafe presentation is caused by enforcing an infeasible plan in place.
- timestamp: 2026-09-11T00:18:00+01:00
  checked: Fallback creation, alignment, route response, and enforcement control flow
  found: First-day selection is random; later selection admits a top-three random candidate. Both alignment and enforcement clamp each meal to 1.5 before the route serializes a failed result as an incomplete response.
  implication: Macro fit must be made decisive for this constrained profile, and failed enforcement must be non-mutating so the incomplete response remains truthful.
- timestamp: 2026-09-11T00:28:00+01:00
  checked: Focused fallback regression after adding safe protein-forward candidates, feasibility-first selection, and enforcement rollback
  found: The exact dairy/shellfish/nut/fish/sesame profile now passes calorie/protein enforcement while the allergy scan remains clean. A synthetic infeasible plan returns failed enforcement with its original 500 kcal / 25g protein days and 1.0 portions intact.
  implication: The fix both creates a feasible safe path for the reported user and retains a transparent failure mode when targets cannot be met.
- timestamp: 2026-09-11T00:34:00+01:00
  checked: Focused regression repeated 10 times, ESLint, and patch whitespace
  found: All 10 focused runs passed, ESLint completed with 20 existing warnings and no errors, and git diff --check passed. A full TypeScript check reports pre-existing orchestration .ts import and readonly/type errors unrelated to these files.
  implication: The macro fix is stable under repeated local execution and ready for authenticated production verification.

## Resolution

root_cause: The hard-safe static pool had no protein-dense options for every required slot, while random/top-three selection and cost swaps could select meals that could never reach the per-slot protein target within the 1.5 portion cap. Macro enforcement then mutated those impossible days before reporting them as partial.
fix: Added dairy/fish/shellfish/nut/sesame-free turkey and chicken fallback meals, selects protein-viable candidates before variety or cost preference, and rolls back failed macro enforcement to the original safe plan.
verification: Focused regression passed 10/10; it asserts hard allergen exclusions, the exact profile's calorie/protein bounds, and non-mutating failed enforcement. ESLint has no errors (20 unrelated existing warnings). Full TypeScript check remains blocked by unrelated pre-existing orchestration import/type errors.
files_changed: [frontend-new/lib/meal-generator.ts, frontend-new/lib/macro-enforcement.ts, frontend-new/scripts/fallback-regression-test.cjs]
