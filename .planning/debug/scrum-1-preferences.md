---
status: awaiting_human_verify
trigger: SCRUM-1 preference save/load and generation audit
created: 2026-10-30
updated: 2026-10-30
---

## Current Focus
hypothesis: Confirmed context omissions are repaired; root is checking full ticket integration.
test: Focused preference save, draft, signature, dietary admission and context tests.
expecting: No omission of likes or valid zero macro targets; no weakened hard allergy exclusions.
next_action: Root performs integrated tests and live verification; user reviews SCRUM-1.

## Symptoms
expected: Meal generation honors all saved preferences and allergies, with safe fallback.
actual: User previously reported preferences not saving; hosted atomic save RPC was missing.
errors: Previously PGRST202 for save_safety_preferences.
reproduction: Save food preferences, reload, generate a plan.
started: Existing application; SCRUM-1 review on 2026-10-30.

## Eliminated

## Evidence
- 2026-10-30: Root's fresh read-only hosted probe returns 42501 for anonymous save_safety_preferences, establishing the RPC now exists (the previous PGRST202 deployment gap is no longer current evidence).
- 2026-10-30: New focused reproductions fail: requested and legacy-profile likes disappear from the generation planning brief; explicit saved zero carb/fat targets become 70g/45g minimum defaults.
- 2026-10-30: Server hard constraints already union all saved allergy/never-food/diet sources and fail closed on unavailable sources; existing tests cover these paths.
- 2026-10-30: Both initial reproductions pass after context repair. Added partial requested zero macro override coverage also passes. Focused suite initially 35/35; added third context test passes separately.
- 2026-10-30: Current preference drawer scope confirmed with root: dietary mode, allergies, avoid/never/liked foods, prep limits and cuisines. Legacy taste/complexity fields have no reviewed recipe evidence model in active planner and are not invented here.
- 2026-10-30 follow-up: Root's live save/reload showed selection mismatch. Current source already uses canonical allergy selection/toggle helpers in planner and onboarding; their tests pass. Cuisine checkboxes used exact-case includes even though save RPC lowercases values. Canonical dietary_mode was ignored on reload in favour of lifestyle.
- 2026-10-30 follow-up repair: New preference-options helpers match/toggle cuisines case-insensitively without discarding unknown values. Reload uses canonical dietary_mode, including explicit null mixed, with legacy fallback only if canonical field is absent. Added three regression cases; combined form/onboarding/draft suite passes 12/12.

## Resolution
root_cause: Context reads likes from only one saved source and uses truthiness plus derived-target floors for valid explicit zero targets.
fix: Union saved and legacy profile likes, forward requested likes into planning input; distinguish missing explicit macro values from valid zero carbs/fat and apply calculated floors only to derived values.
verification: Tests failed before repair and passed afterward; focused preference/dietary/input suite 35 passed, then expanded context suite 3 passed. Focused ESLint passed (only existing baseline-browser-mapping stale-data notice). Root owns full regression and actual user save verification. Hosted RPC current existence is verified, but an anonymous permission failure does not by itself verify an authenticated save.
files_changed: [frontend-new/lib/generation/context-builder.ts, frontend-new/tests/orchestration/context-preferences.test.ts, frontend-new/app/meals/page.tsx, frontend-new/lib/preference-options.ts, frontend-new/tests/orchestration/preference-options.test.ts]
