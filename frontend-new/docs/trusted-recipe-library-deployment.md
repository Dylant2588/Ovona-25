# Trusted recipe library deployment

This repository contains 38 original Ovona recipe **drafts**. They cover 12
breakfast, 15 snack, 18 lunch, and 18 dinner slot assignments. They are not
approved recipes and must not be shown as checked plans until an accountable
reviewer has verified their ingredients, allergens, method, and nutrition.

## Apply the database changes

Use an administrator connection for the intended Supabase project. Apply both
additive migrations from `frontend-new/supabase/migrations`:

1. `20261012_recipe_library.sql`
2. `20261013_trusted_planning_evidence.sql`
3. `20261013_structured_planning_input.sql`

The last two migrations are order-safe for history columns and preserve the
`accepted`, `eaten`, and `rejected` planning states. Verify the database has
`recipe_library`, `recipe_imports`, `retailer_price_observations`, and the
structured preference/history columns before importing drafts.

## Import without approving

From `frontend-new`, with `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` available only in the administrator environment:

```powershell
node scripts/export-recipe-library.cjs recipes.pending.json
node scripts/import-recipe-library.cjs recipes.pending.json --apply
```

This inserts pending-review rows only. It does not grant browser write access
and does not make a recipe selectable by the planner.

## Review before approval

For each recipe, verify original ownership/rights, batch quantities and units,
ingredient taxonomy/allergen metadata, method, timing, servings, and nutrition
evidence. Create an approved record only after that review, with a named
reviewer and timestamp. Use a new version for corrections; approved versions
remain immutable.

```powershell
node scripts/review-recipe-library.cjs recipe.reviewed.json
node scripts/review-recipe-library.cjs recipe.reviewed.json --apply
```

See `lib/recipes/REVIEW.md` for the full review checklist.
