---
id: 261013-lvl
title: Move recipe details inline and refine planner mobile-first layout
date: 2026-10-13
status: complete
---

## Outcome

Recipe details now expand beneath the meal card that opened them. Mobile keeps
the card's meal identity and actions together, followed immediately by the
ingredients and method; desktop gains the same predictable hierarchy.

## Validation

- `npx tsc --noEmit --pretty false` — passing
- `npm run lint -- --quiet` — passing
