# SCRUM-26: Daily catalogue coverage

Extended the existing file-only diagnostic with explicit day/week scope, hard never-food constraints and soft dislikes. It reuses the production scheduler and approval rules, retaining weekly defaults and separate legacy-compatible versus calculated-only results. Added regressions for daily coverage, hard versus soft turkey handling, owner-shaped restrictions, malformed probes, and serving scaling.

## Evidence

Read-only hosted snapshot retrieved 2026-11-04T11:51:14.297Z: 38 approved unique recipes, no malformed records, all 38 legacy-attested and zero ingredient-calculated. SHA256 cada7edee298a6f0d0ff782b5f968bfc439bbd52c1ec83ff2e4607474c36d41d. No recipes or user preferences were changed.

The existing reviewed catalogue produced a complete daily scheduler witness for balanced three-meal targets (28 admitted recipes), the confirmed owner five-meal/allergy/turkey-excluded cohort (16 admitted), and the same cohort with turkey soft-avoided (18 admitted). An unsupported one-minute preparation cohort admitted zero recipes and failed safely. The historical cohort ID says five-minute; its actual numeric preparation limit is one minute, recorded in daily-cohorts.json. Scope-specific reports are in coverage-evidence.json.

No additional recipes were needed for these supported compatibility cohorts. This is not universal coverage. Calculated-only coverage fails for every cohort because no approved source-calculated recipes exist. Legacy macro attestation must not be represented as independently calculated nutrition or micronutrient completeness; SCRUM-27 addresses presentation and supported evidence.

## Checks and acceptance

- Full orchestration suite: 220 passed, zero failed or skipped.
- TypeScript noEmit: passed.
- ESLint: zero errors, nine existing warnings.
- Actual owner restrictions and goals were read from the local app; SCRUM-25 live daily generation, swap and reload provide an additional application witness.
- New recipe/version criteria are conditional and not invoked: sufficient existing approved content was reused without modifying immutable records.
- Unsupported cohorts, hard/soft distinction, units and serving arithmetic covered by deterministic tests.

Raw hosted snapshots and reviewer attribution are excluded from commits. No schema/dependency changes, live writes, deployment or merge. Ready for review with the explicit calculated-source limitation above.
