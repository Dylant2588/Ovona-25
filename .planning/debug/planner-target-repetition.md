---
status: awaiting_human_verify
trigger: "Let's do that x — fix target reliability and repeated slot foods"
created: 2026-10-12
updated: 2026-10-12
---

## Current Focus
hypothesis: Fresh fallback meets unchanged bounds; saved failed plan is stale. Restricted slot catalogue causes repeated turkey snacks.
test: Parent is generating a fresh plan in the signed-in browser after rejecting saved failed plan.
expecting: Current plan meets targets and has chicken and turkey snacks, while hard allergies remain excluded.
next_action: Verify fresh regenerated recipes and obtain user workflow confirmation.

## Symptoms
expected: Practical varied safe meals meeting unchanged calorie/protein bounds.
actual: Screenshot has seven partial days, Tuesday 2153 kcal versus 1830 and 228g protein versus 216, turkey breakfast and both snacks.
errors: Seven days could not meet targets.
reproduction: Saved authenticated plan with five slots and restricted allergies.
started: Existing saved plan; generation timestamp unknown.

## Eliminated

## Evidence
- checked: Existing macro-feasibility session and working changes
  found: Prior fixes already add safe turkey/chicken candidates and failed-enforcement rollback, awaiting human verification.
  implication: Preserve existing edits and test fresh generation before changing behavior.
- checked: Existing exact-profile fallback regression before edits
  found: Fresh generation and enforcement already pass 1830 kcal / 216g protein bounds.
  implication: Screenshot failure is not reproduced by current fallback; existing feasibility patch is necessary and preserved.
- checked: Hard-safe protein-viable catalogue for five slots
  found: Breakfast's only viable option is turkey rice; both viable snacks were turkey, one combined turkey and oats.
  implication: Selection cannot provide a different snack protein without adding a safe practical option.
- checked: Replaced turkey oat candidate with chicken/cucumber/tomato snack and explicit cooking steps
  found: Five fixed Math.random values all produce passing exact-profile plans with two snacks including chicken and no oat-pot snack; allergy scan passes for each.
  implication: Practical snack diversity improves without relaxing target bounds or allergies.
- checked: Focused ESLint and git diff check
  found: Both pass; baseline-browser-mapping age notice is unrelated.
  implication: Scoped edits are ready for browser verification; whole-file commit would incorrectly include pre-existing feasibility work.

## Resolution
root_cause: Restricted allergy-safe catalogue offered only turkey-based protein-viable snacks, so selection repeated turkey across breakfast and both snacks. Current fresh exact-profile generation passes; saved stale failed plan is under browser verification.
fix: Replaced the turkey/oat snack candidate with a chicken and vegetable snack using existing ingredient nutrition mappings, including explicit cooking instructions. Added explicit turkey breakfast/snack instructions covering dry rice, spinach, rolled oats, vegetables and already-cooked turkey; breakfast total time is now35min and snack10min.
verification: Exact-profile regression passes; five deterministic selection seeds pass unchanged enforcement, snack diversity, and hard-allergy checks. Focused ESLint and diff whitespace checks pass. Parent browser confirms fresh seven-day plan passes existing bounds; Tuesday is 1901 kcal vs 1830 and 233g protein vs216, within unchanged 95–108% calories and 98–110% protein, with Chicken & Cucumber second snack. This is bounded fit, not exact numerical equality.
files_changed: [frontend-new/lib/meal-generator.ts, frontend-new/scripts/fallback-regression-test.cjs]
