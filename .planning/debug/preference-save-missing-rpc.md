---
status: awaiting_database_admin_access
trigger: User reports preferences not saving on localhost:3000; critical
updated: 2026-10-29
---

# Preference save deployment failure

## Verified cause

The actual user browser drawer displays `Your safety preferences could not be saved. Please try again after the service is updated.` The current `app/api/preferences/route.ts` uses `savePreferencePatch`, which requires the atomic `save_safety_preferences` RPC. An anonymous invalid-patch probe against the configured hosted project returned PGRST202 (function missing); no user write was attempted.

All columns required by the function exist: schema-only service reads (`select(...).limit(0)`) succeeded for profiles, user_preferences and user_allergies. Advertised PostgREST RPC paths included calc_macros only, confirming this is deployment drift, not a failed test of the new function. Earlier phases intentionally tested new functions only in the disposable project; the current local application is connected to the existing hosted project.

## Repair prepared

`.planning/debug/preferences-repair.sql` contains BEGIN/COMMIT around the exact previously verified `20261028091000_baseline_safety_preferences.sql`, a PostgREST schema-cache notification and a function-installed check. It creates/replaces two functions and grants authenticated execution of the owner-scoped RPC. It does not alter tables, invoke the function, or rewrite existing user data. The app's service key cannot execute database DDL, and no management token/direct SQL credentials or authenticated Supabase CLI session were available.

A Supabase SQL editor tab for the configured project was opened; it redirected to sign-in. User was asked asynchronously to sign in or choose receiving SQL. Database installation and live browser save/reload verification remain outstanding until that access is available. Do not claim preferences are repaired merely because isolated tests pass.

## Related confirmed defects being fixed

- Uncommitted visible text (actual user typed `Eggs` in Avoid foods) was omitted when Save was clicked without Enter. Shared draft-to-payload fixes cover all three food inputs and onboarding.
- Cache/profile signatures omitted never-foods, likes and preparation limits and used case-sensitive lists; scoped follow-up is being verified.
- Ingredient display rounded measured quantities and shopping ledger merged slices with whole pieces. Separate debug record: `current-ingredient-quantities.md`. Actual user meal example is still requested.

## Next verification

Apply only the prepared preference repair once an authorised administrator session is available; do not push unrelated Phase 1/2 migrations. Probe function visibility, then save the user's intended existing form values and confirm reload persistence. Preserve hard exclusions, transactionality and safe errors. No reduced-payload fallback or silent field omission is acceptable.
