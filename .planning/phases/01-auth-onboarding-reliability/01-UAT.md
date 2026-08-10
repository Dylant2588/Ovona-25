---
status: partial
phase: 01-auth-onboarding-reliability
source: [01-VALIDATION.md]
started: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

# Phase 01 Human UAT

## Current Test

Awaiting manual run on local environment with Supabase project active.

Result values: `Pass`, `Fail`, or `Blocked`.

## Tests

### 1. Returning session route behavior (AUTH-01, AUTH-02)
expected: Signed-in users route to `/meals`; users without valid auth route to `/login` only after explicit unauthorized state.
steps:
- Sign in with Google.
- Load `/auth/callback` and wait for redirect.
- Sign out and re-open `/auth/callback`.
result: pending

### 2. Onboarding canonical save path (ONB-01)
expected: Onboarding submit succeeds through `/api/preferences` and does not require direct page-level `profiles`/`user_allergies` writes.
steps:
- Complete goal, weight, height, activity fields.
- Click Finish.
- Confirm redirect to `/meals?onboarding=ready`.
result: pending

### 3. Secondary sync warning + retry path (ONB-02)
expected: If secondary sync (`profileSaved` or `allergiesSynced`) fails, user sees warning with Retry and Continue options.
steps:
- Trigger partial sync condition in `/api/preferences` (e.g., temporary table/column mismatch in dev).
- Submit onboarding.
- Verify warning alert appears with Retry and Continue buttons.
result: pending

### 4. Skip defaults path (ONB-03)
expected: "Skip for now" saves starter defaults and lands user on `/meals?onboarding=skipped` with usable starter preferences.
steps:
- Click Skip for now on onboarding.
- Verify meals page loads and generation can proceed.
result: pending

### 5. Plan state auth fallback stability (LOG-02)
expected: `/api/meal-plan/state` returns 401 for explicit unauthorized and 503 for transient auth resolution failure without 500 regressions.
steps:
- Call `/api/meal-plan/state?weekStart=2026-04-14` without session token.
- Confirm unauthorized status.
- Simulate transient auth failure and confirm 503 status.
result: pending

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

None recorded yet.

## Run Log

| Date | Tester | Result (`Pass`/`Fail`/`Blocked`) | Notes |
|------|--------|-----------------------------------|-------|
| pending | pending | pending | pending |
