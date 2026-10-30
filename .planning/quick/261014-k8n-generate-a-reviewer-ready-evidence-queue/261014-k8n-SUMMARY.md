---
quick: 261014-k8n
status: complete
---

# Reviewer-ready recipe evidence queue

- Added `scripts/generate-recipe-review-queue.cjs`, a read-only administrator
  script that inventories only `pending_review` recipe drafts.
- Generated `docs/recipe-review-queue.md` from the hosted Supabase project.
- The queue contains 38 drafts and identifies the review evidence still
  required without changing recipe status or making a health/nutrition claim.
