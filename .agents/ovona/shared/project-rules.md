# Ovona project rules

Shared by every Ovona agent. Role files build on these rules and do not repeat them.

## Start here

Read `AGENTS.md` first. It stays authoritative for product intent and constraints.

Core value: users reliably hit their protein and calorie goals with minimal decision-making.

## Codebase

- The active app is `frontend-new`: Next.js App Router, strict TypeScript, Supabase, OpenAI SDK and MUI.
- `backend/` and `ovona/` are legacy.
- `.release-macro-fix/` is not the active app. Do not work there by mistake.

## Layering

- UI lives in `frontend-new/app/`.
- Route handlers in `frontend-new/app/api/**/route.ts` stay thin.
- Domain logic lives in `frontend-new/lib/` and `frontend-new/lib/generation/*`.
- Resolve auth through `resolveRequestAuth(request)` in `frontend-new/lib/serverAuth.ts`.
- Return structured JSON errors with explicit status codes, and log with contextual prefixes such as `[meal-plan]`.

## When docs disagree

These sources win over older docs:

1. `frontend-new/package.json`
2. The actual tests and code
3. Recent `.planning/quick/*/*-SUMMARY.md` files

Known stale docs:

- `.planning/codebase/TESTING.md` says no tests exist. In fact 61 test files exist.
- `AGENTS.md` says Next 16.0.1. `frontend-new/package.json` has 16.0.10.
- The position in `.planning/STATE.md` may lag quick-task work.

Do not edit these docs unless asked.

## Product safety

- Dietary and allergy checks fail closed.
- Never fabricate prices, retailer data, nutrition values or evidence.
- Show unknowns as unknown.
- Keep writes schema-compatible, because Supabase differs across environments.
- Use a deterministic fallback when AI paths fail.
- Keep the UX low in cognitive load.

## Workflow

- File-changing work starts through a GSD command (`/gsd-quick`, `/gsd-debug` or `/gsd-execute-phase`) unless the user explicitly bypasses it.
- OpenSpec lives under `openspec/`. Use it only when the task is an OpenSpec change.

## Never

- Merge or deploy.
- Push without being asked.
- Add dependencies.
- Run migrations or database integration tests against a live target.
- Print secrets.
- Stage unrelated work.

Stage by explicit path, never with a catch-all add. The worktree often holds unrelated changes, and the root `.gitignore` is a directory, so no root ignore rules apply.
