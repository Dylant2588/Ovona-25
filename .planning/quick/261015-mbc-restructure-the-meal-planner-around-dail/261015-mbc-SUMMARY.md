---
task: 261015-mbc
status: ready-for-human-verification
---

# Daily-first meal planner and same-day protein variety

The selected day is the planner's primary task: the plan header and horizontal day selector lead directly into that day's meal cards and actions. Weekly nutrition and the shopping list remain after the daily workflow as optional disclosures.

## Changed

- `frontend-new/app/meals/page.tsx`
  - Keeps selected-day meals in a semantic daily section, directly under the day selector.
  - Retains narrow-screen action disclosure behaviour and existing meal actions.
  - Corrects recipe control ARIA linkage to the individual recipe panel.
- `frontend-new/lib/orchestration/schedule.ts`
  - Normalises protein sources before applying the two-meals-per-day cap.
  - Treats missing protein metadata as one `other` category, so it cannot bypass the cap.
- `frontend-new/tests/orchestration/schedule.test.ts`
  - Covers compliant five-meal days, a turkey-only catalogue failing safely, and missing protein metadata.

## Verification

- `node --test tests/orchestration/schedule.test.ts` — passed (8 tests)
- `npx eslint app/meals/page.tsx` — passed
- `npx tsc --noEmit --pretty false` — passed

## Human verification remaining

Open `/meals` at phone and desktop widths. Select another day and confirm its meal list follows the selector immediately; expand the nutrition and shopping disclosures below it; then generate a plan and confirm no day shows a protein source in three meals.
