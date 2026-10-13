---
id: 261013-fwx
title: Add planned social meals with explicit nutrition status and shopping-list exclusion
date: 2026-10-13
status: complete
---

## Outcome

Users can replace a planned meal with **Meal out**. It stays visible in the
week, is labelled `Nutrition not verified`, and its ingredients are omitted
from the shopping list. Swapping that card adds a reviewed recipe back.

The persistence boundary accepts only the exact zero-ingredient,
zero-macro social-meal shape. It continues to reject unreviewed recipes,
altered ingredients, and forged nutrition. A day with a declared meal out is
not judged against the usual calorie/protein target because that meal is
explicitly unknown.

## Validation

- `npm run test:orchestration` — 39 passing
- `npx tsc --noEmit --pretty false` — passing
- `npm run lint -- --quiet` — passing

## Follow-up

Add a budget preference and retailer comparison only after recipe price
evidence is reviewed. Current local estimates must not be presented as a
verified best-shop recommendation.
