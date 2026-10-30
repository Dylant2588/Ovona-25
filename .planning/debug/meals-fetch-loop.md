---
status: awaiting_human_verify
trigger: "Investigate and fix the repeated-fetch loop on the Ovona meals page."
created: 2026-08-11T22:19:51+01:00
updated: 2026-08-11T22:27:10+01:00
---

## Current Focus

hypothesis: Confirmed—request effects must be keyed to the account ID rather than the re-published Supabase User object.
test: Verify the authenticated `/meals` page in Chrome after deployment by observing the Network panel for 45 seconds.
expecting: The initial bounded request group completes once; no recurring requests for preferences, profiles, allergies, history, logs, or shopping list occur without a user action.
next_action: Await production/UAT confirmation.

## Symptoms

expected: loading /meals makes one bounded set of requests per relevant state change.
actual: Chrome Network screenshot shows repeated cycles within ~45 seconds: user_preferences, profiles, user_allergies, plan_history, meal_logs, shopping-list?weekStart, and shopping-list endpoints repeatedly return 200.
errors: no errors reported; endpoints return 200.
reproduction: authenticated /meals after plan generation.
started: observed current production UAT.

## Eliminated

## Evidence

- timestamp: 2026-08-11T22:19:51+01:00
  checked: Debug session initialization
  found: No active non-resolved debug session existed.
  implication: This investigation owns a new persistent session file.
- timestamp: 2026-08-11T22:24:10+01:00
  checked: Request-producing effects in frontend-new/app/meals/page.tsx
  found: Preferences (user_preferences, profiles, user_allergies) depends on `user`; history (plan_history, meal_logs) depends on `user` and `plan?.id`; shopping-list depends on `user`; plan loading also depends on `user`.
  implication: A changed user object identity directly explains the synchronized cycles across the otherwise independent request groups.
- timestamp: 2026-08-11T22:24:10+01:00
  checked: frontend-new/lib/auth-context.tsx
  found: Every Supabase auth event unconditionally calls `setUser(session?.user ?? null)`, with no guard for the same user ID.
  implication: A session refresh can republish a new User object and retrigger every meals effect that keys off object identity.
- timestamp: 2026-08-11T22:24:10+01:00
  checked: Common-pattern scan and git history
  found: This is an Async/Timing plus State Management pattern: subscription state updates feed directly into request-effect dependency arrays. The relevant effects predate the current UAT changes.
  implication: The loop is a dependency-identity feedback issue, not HTTP retry behavior or an endpoint failure.
- timestamp: 2026-08-11T22:26:15+01:00
  checked: Targeted dependency stabilization in frontend-new/app/meals/page.tsx
  found: The request effects now depend on `userId` (`user?.id ?? null`) rather than the User object; all effect-local database/storage keys use the same primitive.
  implication: Auth refreshes for the same user no longer satisfy React's changed-dependency condition, while sign-in/sign-out and account changes still do.
- timestamp: 2026-08-11T22:26:15+01:00
  checked: npm run lint --prefix frontend-new
  found: Completed with 0 errors. Seven existing warnings remain, none introduced by this change.
  implication: The targeted dependency change is type/lint valid.
- timestamp: 2026-08-11T22:27:10+01:00
  checked: npm run build --prefix frontend-new
  found: Production build completed successfully; the only output warnings concern baseline-browser-mapping staleness and multiple lockfiles.
  implication: The changed meals page compiles, type-checks, and prerenders successfully.

## Resolution

root_cause: Meals request effects depend on the full Supabase `User` object. The auth provider republishes that object for each auth event—even when the account ID is unchanged—so equivalent session updates rerun the preference, history, plan, and shopping-list effects in lockstep.
fix: Introduced the stable `userId` primitive and changed meals-page request-effect dependencies and query/storage references from the User object to that ID.
verification: `npm run lint --prefix frontend-new` completed with zero errors, and `npm run build --prefix frontend-new` completed successfully. Authenticated browser verification remains required.
files_changed: [frontend-new/app/meals/page.tsx]
