# Phase 1: Trustworthy baseline — context

Gathered: 2026-10-28. Status: implementation authorised after the user requested continuing phases.

## Locked decisions

- Implement the scope of audit tickets P1.1, P1.2 and P1.3. The original planning-only boundary applied when these documents were created; the user's subsequent request to continue phases authorises scoped Phase 1 execution.
- Reuse Next.js App Router, Supabase, OpenAI SDK and the reviewed recipe pipeline.
- Preserve legacy roadmap/plans and existing uncommitted changes. This folder is the MVP reset Phase 1, not historical Phase 1.
- Preserve hard allergies, may-contain evidence, dietary rules, never-foods, prep limits, review attribution, and seven-day plan checks.
- Dislikes remain soft preferences; do not restore the stale test expectation that they are hard exclusions.
- Recipe approval must convert a valid pending draft into a reviewed proposed version before applying approved-recipe eligibility; do not skip taxonomy or manufacture evidence.
- Atomicity for recipe approval and safety preference persistence is in scope where needed for these fixes; general plan/shopping atomic persistence remains Phase 3.
- No new dependencies without explicit approval. Prefer installed Node test runner and TypeScript tooling.
- No production migrations or deployment. Database verification targets must be demonstrably disposable and isolated; absence of tooling/access is a visible verification blocker, not a pass.
- Do not auto-advance to implementation, regardless of GSD configuration.

## Planning discretion

Choose minimal service extraction, injectable route dependencies, test fixture corrections and additive migrations when justified. A transaction or narrow Supabase RPC can be planned for review/persistence correctness, but must not be applied during planning. UI work is limited to existing messages/loading hooks necessary for the fixes; no new visual design is needed.

## Canonical references

- `.planning/mvp-reset/ROADMAP.md` and `.planning/mvp-reset/REQUIREMENTS.md`: approved scope.
- `frontend-new/app/api/recipe-review/route.ts`, `frontend-new/lib/recipes/imports.ts`, `frontend-new/lib/recipes/approval.ts`, `frontend-new/lib/recipe-reviewer.ts`: review lifecycle and authorisation.
- `frontend-new/lib/orchestration/candidate-adapter.ts`, `frontend-new/lib/orchestration/eligibility.ts`, `frontend-new/lib/generation/context-builder.ts`, `frontend-new/lib/recipes/server-constraints.ts`: dietary integration and saved restrictions.
- `frontend-new/app/api/preferences/route.ts`, `frontend-new/app/onboarding/page.tsx`: safety persistence and caller responses.
- `frontend-new/supabase/migrations/*.sql`: actual database contracts, not proof of deployed state.
- `frontend-new/tests/orchestration/*.test.ts`, `frontend-new/package.json`: current tests and tooling.

## Audit baseline (executed in preceding turn)

64 orchestration tests: 55 pass / 9 fail. TypeScript no-emit/nonincremental: no diagnostics. ESLint: 3 errors / 10 warnings. Ingredient quantity regression: pass. No live database or browser flow verified. Recheck baseline during execution; do not represent this audit as current execution evidence.

## Deferred

Phases 2–5 from scoped roadmap; broad legacy cleanup; production data repair. Approval of this scope is not approval to execute historical roadmap phases.
