---
status: awaiting_human_verify
trigger: "Also the ingredients don't look quite right"
created: 2026-10-29
updated: 2026-10-29
---

## Current Focus

hypothesis: User clarified that four-decimal display is too precise, while large weekly egg-white totals are a separate generation issue. Need practical display rounding without the old coarse steps or fabricated count/zero errors.
test: Actual examples and quantity-preservation regressions pass: 14.1725g→14g, 583.4498g→583g, 0.025kg→25g, 1.4567 eggs→1.5; ledger remains unchanged.
expecting: Whole grams/ml, readable fractional counts and nonzero subgram quantities; persisted quantities/macros remain untouched.
next_action: Parent verifies actual recipe/shopping display while continuing separate excessive egg-white generation investigation.

## Symptoms

expected: Ingredient quantities and units shown for a saved meal match its reviewed batch/servings and final portion.
actual: User reports ingredients do not look quite right on localhost:3000/meals; exact example not yet observed.
errors: None reported.
reproduction: View current meal plan ingredients.
started: Reported after Phase 2 implementation.

## Eliminated

## Evidence

- checked: User clarification forwarded by parent
  found: User considers 2590g weekly egg whites impractical and 14.1725g cocoa / 583.4498g cucumber overprecise.
  implication: Four-decimal presentation is not the desired UX. Use practical nearest-gram/ml display, preserve fractional counts and source quantities; parent owns generation/basket concentration diagnosis.

- checked: ingredient-display.ts full file
  found: humaniseAmount rounds 11–100g to 10g, 100–500g to 25g, low ml values to 10ml, kg/l to one decimal; countable units round to an integer with minimum one. formatIngredientLineForDisplay additionally extracts only integer digits from quantity text.
  implication: Materialized fractional servings can be displayed as materially different amounts even without a storage/scaling error.
- checked: ingredient-ledger.ts full file and previous resolved ingredient-quantity-excess.md
  found: Current ledger sums final meal.ingredients once; previous reported excess was selection composition, not duplicate aggregation.
  implication: Do not assume aggregation is causing the current report.
- checked: actual meals-page formatter call sites and minimal Node reproduction
  found: Expanded recipe passes final ingredient.amount/unit/name directly to formatter. Inputs 1.4 each Eggs, 0.5 each Avocado, 84g Oats, 7ml Olive oil and 0.025kg Spinach become 1 Egg, 1 Avocado, 80g, 10ml and 0kg. Zero eggs becomes one egg.
  implication: Display alone misrepresents quantities independently of any storage bug.
- checked: new ingredient-display.test.ts before fix
  found: All three tests fail on the observed defects; source recipe adapter divides batch quantities once and approval validates final quantities against recipe/servings/portion.
  implication: A formatting-only correction is warranted; no generation/scaling changes are supported by current evidence.
- checked: distinct count-unit ledger reproduction and a fourth failing regression
  found: Two slices of Bread plus one each Bread merge into three piece Bread, displayed as three Breads; the original ledger aliases slice to piece without conversion evidence.
  implication: Slice identity must stay separate from whole count units; no portion or nutritional changes are needed.

## Resolution

root_cause: Shared ingredient display rounds measured mass/volume to coarse steps and fractional counts to integers; it then parses only integer digits and forces minimum count one. Separately, final ledger aliases slices to generic pieces and merges incompatible count bases. Both change the quantity/unit a user is instructed to use.
fix: Shared formatter uses practical nearest-gram/ml display, one decimal for fractional counts/small measures, and converts sub-unit kg/l into g/ml. Small positive values never become zero, zero is zero and invalid values show unavailable. Exact count presentation remains available explicitly. Ledger preserves slice units instead of merging them with each/piece. No changes to generation, serving/portion arithmetic, persisted meal quantities or nutrition.
verification: Updated user-example/quantity-preservation and slice regressions pass; combined display, final shopping ledger and calculated adapter tests 10/10 PASS, zero skips. Original formatter and slice defects were reproduced before correction. TypeScript/focused ESLint passed on the earlier correction; rerun for practical presentation is in progress. Actual user meal/browser comparison and impractical weekly egg-white amount remain with parent.
files_changed: [frontend-new/lib/ingredient-display.ts, frontend-new/lib/ingredient-ledger.ts, frontend-new/tests/orchestration/ingredient-display.test.ts]
