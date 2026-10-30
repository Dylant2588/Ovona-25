---
phase: 01-trustworthy-baseline
plan: "03"
subsystem: safety-preferences
status: automated_verified_locally
tags: [preferences, auth, transactions]
key-files:
  created:
    - frontend-new/lib/preferences-persistence.ts
    - frontend-new/supabase/migrations/20261028091000_baseline_safety_preferences.sql
    - frontend-new/tests/orchestration/preferences-route.test.ts
  modified:
    - frontend-new/app/api/preferences/route.ts
    - frontend-new/app/onboarding/page.tsx
    - frontend-new/app/meals/page.tsx
---

# Plan 03 implementation summary

Update 2026-10-29: real isolated tests passed for owner isolation, omitted safety fields, three-store allergy union, concurrent first saves and insertion-failure rollback. PostgreSQL execution caught and fixed CASE-expression parentheses in the new migration. Earlier pending notes below are the historical checkpoint; current evidence is 01-VERIFICATION.md. The existing/live application database has not received the migration.

Preference parsing preserves omitted patch keys and validates supported profile, target and taste fields. Actual POST verifies identity with the explicit access token and calls only authenticated save_safety_preferences. Missing function/schema returns preferences_schema_unsupported; no reduced direct-write fallback exists. Existing callers show an actionable message and retain values for retry.

The proposed SQL transaction derives ownership from auth.uid(), allowlists fields, serialises first saves with a per-owner advisory lock, unions saved allergy stores and updates preferences/profile together. Omitted safety fields survive; allergy removals are not introduced.

## Verification

Eight parser/actual-route tests are part of the parent's passing new tests in the 97-test suite. Complete suite: 88 pass and nine historical failures. TypeScript passed. SQL was not applied or executed; database guarantees remain pending actual integration tests.

## Commits

No commits created; unrelated work preserved.

## Deviations and limits

Allergy synchronisation inserts missing union terms instead of deleting existing rows, preserving row IDs/severity and making rollback less destructive. No dependency changes. Missing deployed RPC intentionally blocks preference saves with HTTP 503; deploying the migration requires a verified isolated test first and later rollout approval. Executor interruption prevented its summary; parent reconstructed it from inspected code and executed checks. Independent review remains pending.

## Self-Check: PASSED

Production parser/route and planned migration exist with actual-route tests. Database transaction and caller browser verification are not claimed complete.
