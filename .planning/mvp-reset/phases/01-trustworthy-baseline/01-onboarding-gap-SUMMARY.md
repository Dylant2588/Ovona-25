---
phase: 01-trustworthy-baseline
plan: 03-browser-gap
status: browser_preferences_verified
updated: 2026-10-29
requirements: [BASE-05, BASE-07]
---

# Onboarding browser acceptance gap

Browser acceptance exposed a missing caller credential: the browser Supabase client stores its session in local storage, while onboarding posted preferences without the bearer header. The server correctly rejected the unauthenticated request. The cooking-time selection also did not populate the durable `max_prep_minutes` safety field.

## Correction

- `frontend-new/lib/onboarding-preferences.ts`: shared production request function obtains the current browser session, verifies its token with `getUser(token)`, and requires it to match the onboarding page owner. It rechecks the session before sending and after receiving, preventing previous-account responses from completing another account's onboarding. It sends the explicit bearer header without modifying server authentication or cookie policy.
- The same request function writes preparation limits of 10, 15 and 30 minutes for the three existing cooking choices. This value overrides conflicting caller payload values.
- `frontend-new/app/onboarding/page.tsx`: calls the request function and returns with form values intact on session/network failures; existing actionable unsupported-schema handling remains. No success, local onboarding completion markers or redirects occur on these failures.
- `frontend-new/tests/orchestration/onboarding-preferences.test.ts`: exercises the actual production request function and payload through the real preference parser, including all limits, explicit token verification, missing/unverified/switched identities, in-flight account changes, unsupported-schema responses and network failures.
- Browser retest then found lowercased saved allergies rendered unchecked because both forms compared exact display labels. `frontend-new/lib/allergy-options.ts`, wired into onboarding and `frontend-new/app/meals/page.tsx`, compares canonical allergy categories for checkbox selection and toggling. It preserves precise original saved strings (for example, `peanuts` is not rewritten to broader `Nuts`). Round-trip tests cover every displayed allergy, canonical aliases and unchanged precise restrictions.
- Unsupported-schema browser injection exposed a planner catch that replaced the safe error and rendered feedback behind the modal. `frontend-new/lib/preference-feedback.ts` preserves only deliberately constructed safe response messages, with generic unexpected-error fallback. The planner now renders dedicated save failure feedback inside the open drawer, leaves fields available for retry, and clears obsolete “Regenerating” notices after generation succeeds or fails.

## Verification

- `node --test tests/orchestration/onboarding-preferences.test.ts`: 6 passed, zero skipped.
- `npx tsc --noEmit --incremental false`: passed, exit 0.
- Focused ESLint on onboarding/helper/test: passed, exit 0 (existing tool-data freshness notice only).
- Parent browser retest using the isolated application snapshot and synthetic local database account passed: onboarding saved 30 minutes and Dairy, planner saved 15 minutes with Dairy still checked after reload, and temporary missing-RPC injection showed actionable feedback inside the drawer while retaining attempted 10-minute input and keeping database value 15 minutes. The RPC was restored and confirmed.
- Evidence: `01-browser-preferences.png` and `01-browser-safe-failure.png`. Synthetic reviewer approval proof is separately in `01-browser-review.png`; reviewer identity/in-flight behavior is not claimed by this gap summary.
- Full-glob checkpoint during concurrent Phase 2 creation: 110 tests, 109 passed, one file-level startup failure in newly in-flight `recipe-nutrition.test.ts`, zero skips, 1148.55 ms. Immediate focused diagnostic of that new file passed 5/5 in 105.42 ms. This checkpoint is explicitly not a clean final combined gate.

## Deviations

[Rule 1 — Bug] Fixed onboarding's missing bearer credential and missing durable preparation limit found during Phase 1 browser acceptance. No migration, dependency, server-auth rewrite or hosted database access was needed.

[Rule 1 — Bug] Fixed allergy selection display losing checked state after lowercasing during persistence; no server restrictions were weakened and no precise allergy was broadened during hydration.

[Rule 1 — Bug] Fixed modal save failure visibility and actionable-message preservation; cleared contradictory regeneration progress after completion/failure.

No commits were created, as explicitly instructed by the parent to preserve the mixed existing working tree. No changes to historical planning state, unrelated files or hosted user data.

## Self-check

The production helper, caller integration and regression test exist. TypeScript and targeted behavioural tests passed. No mock nutrition/source data or production review attestations were introduced.
