---
quick: 261014-l7m
status: complete
---

# Exact shopping ledger and practical legacy generation

The meals page now rebuilds its saved shopping list from the final ingredient
JSON shown in the plan, rather than accepting an old cached list with the same
plan ID. The fallback catalogue portions for egg whites and ready-to-eat turkey
were reduced, weekly recipe/source selection now honours repetition limits, and
an infeasible high-protein request is refused instead of filling a basket with
impractical quantities. `ingredient-quantity-regression-test.cjs` verifies both
the refusal and a practical generated basket.

Validation: `node scripts/ingredient-quantity-regression-test.cjs` and
`npx tsc --noEmit --pretty false` pass from `frontend-new`.
