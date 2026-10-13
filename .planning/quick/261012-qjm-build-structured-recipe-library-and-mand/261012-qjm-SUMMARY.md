# Structured recipe library and approval gate

Completed locally on 2026-10-13.

## Result

- Added an additive `recipe_library` migration containing versioned recipe records, review state, source/rights metadata, nutrition evidence and RLS that only exposes approved recipes to signed-in users.
- Added deterministic export, dry-run import and review scripts. The existing static catalogue exports as `pending_review`; no existing recipe was automatically certified.
- Added one fail-closed approval gate. It rejects incomplete recipe evidence, unrecognised ingredients or restrictions, allergens and possible cross-contact, diet/prep conflicts, dislikes, stale recipe versions, ingredient/method/nutrition edits and unsafe portions.
- Replaced production synthetic verified candidates with reviewed database recipes. Generated plans retain their recipe ID/version, real method, measured ingredients and source-backed nutrition.
- Applied approval before generation responses, swaps, day changes and plan persistence. Client-provided preference data can only add restrictions; it cannot remove saved allergies, diets or dislikes. Failed checks occur before plan replacement writes.
- Removed local browser fallbacks that could have displayed or persisted an unchecked generated plan. Existing saved/cached plans are explicitly marked unchecked until regenerated from reviewed recipes.
- Fixed five-meal scheduling so a day requires two separate snack slots.

## Verification

- `npm run test:orchestration` — 37 passed.
- `npx tsc --noEmit --pretty false` — passed.
- `npm run lint -- --quiet` — passed.

## Deployment status

The migration is prepared but not applied. This workspace has no Supabase administration connection or service-role credential, so no remote schema or review data was changed. Follow `frontend-new/lib/recipes/REVIEW.md` to apply the migration, import the pending catalogue and review enough recipes before requesting a checked plan. Until then, the product deliberately returns a recipe-library readiness message instead of pretending its static recipes are trusted.
