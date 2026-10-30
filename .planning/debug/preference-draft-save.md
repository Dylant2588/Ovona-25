---
status: awaiting_human_verify
trigger: "My preferences are not saving. Worth checking. That is critical"
created: 2026-10-29
updated: 2026-10-29
---

## Current Focus

hypothesis: Confirmed additional gap: saved-plan preference signatures omit neverFoods, foodLikes and maxPrepMinutes and retain casing changed by persistence.
test: Parent browser save/reload after the missing hosted RPC is repaired.
expecting: Visible draft foods are saved without Enter; changed hard exclusions/prep invalidate old signatures; save/reload formatting alone does not.
next_action: Parent verifies real browser flow and runs integrated checks. Old saved-plan signatures are not rewritten and may require checked regeneration.

## Symptoms

expected: Saving preferences includes nonempty text currently typed into avoid, never-include and liked-food fields, with or without Enter.
actual: Parent observed uncommitted Eggs text in Avoid foods while save uses only existing dislikes array.
errors: Hosted save additionally fails PGRST202 because RPC is unapplied; parent owns that separate cause.
reproduction: Type Eggs in Avoid foods and click Save without pressing Enter.
started: Observed during current critical preference-save investigation.

## Eliminated

- hypothesis: Draft loss explains the RPC failure.
  evidence: Parent independently confirmed missing hosted save_safety_preferences; this is a separate UI data-loss defect.

## Evidence

- checked: frontend-new/app/meals/page.tsx handler references
  found: handleSavePreferencePanel sanitizes array state but never reads dislikeInput, neverFoodInput or foodLikeInput.
  implication: A valid typed value is silently omitted until Enter/comma creates a chip.
- checked: Complete tag/save handlers and onboarding finish payload
  found: Both planner Save and onboarding Finish used committed dislike arrays only. Planner reopen reset only Avoid draft, leaving stale Never/Like drafts from cancelled sessions.
  implication: Use the same draft-aware construction for all saved food lists and reset all three on a fresh drawer opening.
- checked: New helper through real parsePreferencePatch
  found: Three behavioral tests pass for uncommitted values, case/whitespace dedupe, category separation, blank fields and nonmutation/retry after failed save.
  implication: Outgoing field contract preserves typed text and hard/soft category semantics.
- checked: npx tsc --noEmit --incremental false
  found: Exit 0.
  implication: Both real UI callers type-check with the shared helper.
- checked: meal-generator.ts buildProfileSignature
  found: neverFoods, foodLikes and maxPrepMinutes were omitted; raw sorted list casing survived although preference persistence lowercases/collapses whitespace.
  implication: Hard exclusion/prep changes could retain an old signature, while harmless save/reload formatting changes could change it. Parent extended ownership for a minimal signature fix; existing saved plans will not be rewritten.
- checked: Three new tests calling the actual production preferenceSignatureFor via the existing transpile loader
  found: All three failed before the fix; all three pass after including neverFoods/foodLikes/maxPrepMinutes and normalizing food lists. Combined draft/signature tests 6/6 pass; TypeScript exit 0.
  implication: Meaningful preference changes invalidate signatures, while actual parse/save/reload case and whitespace normalization is stable and inputs remain untouched.
- checked: Parent full suite and unchanged meal-variety fallback regression
  found: The first signature normalizer assumed arrays and threw on the legitimate historical `allergies: "Eggs"` representation. Corrected the normalizer to accept unknown and parse legacy delimited text explicitly; all original fixture behavior is preserved.
  implication: Production string/array equivalence regression now proves every allergy remains represented. Invalid non-string entries reject rather than disappearing. Meal-variety, signature and draft checks pass 8/8.

## Resolution

root_cause: Save handlers ignored visible draft text until Enter/comma committed a chip; onboarding Finish had the same dislike omission. Saved-plan signature additionally omitted never-foods, likes and prep limits and differed from persistence normalization.
fix: Shared pure draft/list snapshot includes every nonempty current input, with case/whitespace dedupe. Both real callers use it. Failed saves retain state; confirmed success commits/clears captured drafts. Drawer reopen starts all draft fields clean. buildProfileSignature now includes neverFoods, foodLikes and maxPrepMinutes (standard null/undefined equals 30) and normalizes relevant food lists without changing body/timezone fields or input arrays. Existing plans/signatures are not rewritten; they may require checked regeneration.
verification: Draft/signature/unchanged legacy fallback checks pass 8/8 after correcting a discovered legacy-string normalization regression. Earlier TypeScript pass and focused lint zero errors/pre-existing warnings; parent reruns final integrated checks. Parent owns hosted RPC repair and actual browser verification; these code fixes do not themselves repair the separate PGRST202 persistence failure.
files_changed: [frontend-new/app/meals/page.tsx, frontend-new/app/onboarding/page.tsx, frontend-new/lib/preference-drafts.ts, frontend-new/tests/orchestration/preference-drafts.test.ts, frontend-new/lib/meal-generator.ts, frontend-new/tests/orchestration/preference-signature.test.ts]
