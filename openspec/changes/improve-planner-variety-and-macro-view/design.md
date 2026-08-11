## Context

The planner currently uses an AI nutritionist module to create concepts, then applies deterministic ingredient nutrition and a static catalogue fallback. Recent reliability hardening makes the fallback safe, but screenshots show repetitive concepts and daily calories far above target. The current grouped bar chart plots calories and grams together, obscuring adherence.

## Goals / Non-Goals

**Goals:**

- Make AI a constrained source of fresh meal concepts, not a source of truth for nutrition or safety.
- Increase safe rotation and reduce repeated primary proteins across a five-day week.
- Make daily calorie and protein target adherence a precondition for accepted plans.
- Give the planner a compact visual explanation of adherence on desktop and mobile.

**Non-Goals:**

- Clinical nutrition precision, a broad external food database, or unrestricted recipe generation.
- Automatically generating a plan on page load or retrying token-spending requests.
- A general visual redesign outside the weekly totals and macro overview.

## Decisions

### Generate concepts freely, accept plans deterministically

The nutritionist will request candidate concepts beyond the recent rotation, but every candidate will pass ingredient resolution, allergy validation, and macro calculation before selection. Validated catalogue concepts remain the recovery source.

This preserves variety without reintroducing the zero-macro or unsafe-meal failures. Trusting LLM-provided macros was rejected because it conflicts with the nutrition-source-of-truth decision.

### Use daily correction before plan-level enforcement

The generator will compare daily totals to calorie and protein targets after portions are calculated. It will first apply compatible portion and meal substitutions, then return an explicit incomplete result if the tolerance cannot be met.

Correcting only a weekly total was rejected because a user needs each day to be usable, not a weekly average that conceals large daily misses.

### Separate calorie adherence from macro composition

The macro overview will use a calorie-focused chart with target guidance and separate macro progress/summary values in grams. It will show off-target state per day rather than combining all series in one bar scale.

This replaces the current dual-axis grouped bar chart, whose visual equivalence of kcal and grams is misleading.

## Risks / Trade-offs

- [Strict daily tolerances reduce the number of usable concepts] → Use deterministic portion corrections and a larger compatible catalogue before reporting an incomplete plan.
- [More AI candidates increase token spend] → Generate only on explicit user actions, cap candidates, and use rotation history plus catalogue alternatives before issuing another AI request.
- [Expanded catalogue nutrition is incomplete] → Require baseline coverage and reject unresolved concepts before presentation.

## Migration Plan

1. Add validated concept/catalogue variety and target-adherence checks behind the existing explicit generation endpoint.
2. Update the planner response model and display components together.
3. Deploy, generate a Dairy-safe custom-target plan once, and verify varied concepts, daily tolerance, and mobile chart readability.
4. Roll back the deployment if the acceptance gate prevents plan generation; retain the existing catalogue and user data unchanged.
