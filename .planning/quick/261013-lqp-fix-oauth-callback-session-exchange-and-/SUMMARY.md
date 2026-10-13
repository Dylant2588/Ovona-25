---
id: 261013-lqp
title: Fix OAuth callback session exchange and planner redirect
date: 2026-10-13
status: complete
---

## Outcome

The OAuth callback now waits for Supabase to consume and persist the browser
session before it asks for the authenticated user. Once a session is present,
it removes the callback fragment from the visible URL and continues to meals
or onboarding.

## Validation

- `npx tsc --noEmit --pretty false` — passing
- `npm run lint -- --quiet` — passing
