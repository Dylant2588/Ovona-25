---
quick: 261014-rvw
status: complete
---

# Private recipe review workspace

Added `/review-recipes` and its authenticated server API. The API reads pending
drafts with the service role only after the signed-in user holds a `reviewer` or
`admin` role in `recipe_reviewer_roles`. Approval requires five human
attestations, creates a new immutable approved recipe version, and closes the
pending draft. Rejection closes the pending draft without making it available to
planning.

The reviewer page sends the authenticated Supabase bearer token to its API so
the server can resolve the signed-in user's reviewer role. Verified live after
the role migration: the workspace loaded 38 pending drafts.

Validation: `npx tsc --noEmit --pretty false` and
`node --test tests/orchestration/recipe-imports.test.ts` pass from
`frontend-new`.

## Draft data repair

Pending drafts with no measured method are now blocked by the reviewer UI and
cannot be approved. `frontend-new/scripts/repair-pending-recipe-drafts.cjs`
repairs only those pending records from the local catalogue; it does not touch
reviewed versions or grant approval. On 2026-10-14 it repaired 16 drafts in
the hosted project. The repaired Chipotle Turkey Chili and Blueberry Protein
Oats display their methods after a page refresh.
