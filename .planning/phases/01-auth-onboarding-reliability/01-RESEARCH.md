# Phase 1: Auth + Onboarding Reliability - Research

**Researched:** 2026-04-13
**Domain:** Next.js + Supabase auth/session reliability for onboarding and persisted planner state
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use hybrid auth guard behavior: prefer cookie session, then bearer fallback, with bounded retry on transient failures.
- **D-02:** Redirect to `/login` only on explicit unauthorized outcomes, not on initial uncertainty/timeouts.
- **D-03:** Use tiered criticality for onboarding writes: block progression only when canonical `/api/preferences` save fails.
- **D-04:** Treat secondary profile/allergy sync as best-effort; continue flow with explicit warning and retry path.
- **D-05:** `/api/preferences` is the single writer contract for preference/profile persistence logic.
- **D-06:** Remove/avoid parallel direct-table write behavior from page-level UI handlers where API coverage exists.
- **D-07:** Execute a scripted reliability checklist with deterministic route/API assertions.
- **D-08:** Pair scripted checks with targeted manual UX smoke for onboarding -> meals -> refresh -> return-session flow.

### the agent's Discretion
- Retry backoff values and max attempts (bounded).
- Exact warning/toast copy for secondary sync failures.
- Script-first vs command-set-first checklist tooling, as long as deterministic and repeatable.

### Deferred Ideas (OUT OF SCOPE)
- None.
</user_constraints>

<research_summary>
## Summary

Phase 1 has two core reliability gaps in current code paths: auth certainty boundaries and duplicate write pathways during onboarding. `resolveRequestAuth` already implements cookie-first plus bearer fallback, but page/API callers still need explicit handling for "unauthorized" versus "transient/no-session-yet" outcomes to prevent incorrect redirects. This directly impacts `AUTH-01`, `AUTH-02`, and `LOG-02`.

On onboarding, the current page still writes directly to `profiles` and `user_allergies` after `/api/preferences` succeeds. That conflicts with the single-writer decision and creates divergence/constraint risk (`ONB-01`, `ONB-02`, `ONB-03`). The most robust pattern is to keep all persistence semantics in `/api/preferences`, return structured partial-success metadata, and let UI present non-blocking warnings with retry affordances.

**Primary recommendation:** Implement Phase 1 as three plans: (1) unify auth certainty handling across routes/pages, (2) enforce `/api/preferences` as canonical onboarding writer with compatibility fallback semantics, (3) add deterministic scripted + manual reliability checks.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.x | App Router, route handlers, auth-protected pages | Existing runtime and routing model |
| `@supabase/supabase-js` | current repo | Supabase auth/session + DB access | Current auth/data integration |
| `@supabase/auth-helpers-nextjs` | current repo | Route-handler cookie session binding | Existing server auth bridge |

### Supporting
| Tooling | Purpose | When to Use |
|---------|---------|-------------|
| `npm run lint --prefix frontend-new` | static regression check | after each auth/onboarding change |
| deterministic PowerShell script in `frontend-new/scripts` | repeatable route/API assertions | before execution handoff and UAT |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cookie+bearer hybrid | cookie-only auth | Simpler, but fails on valid bearer-only client requests |
| API single-writer | direct page-level table writes | Faster local patching, but higher drift/constraint failure risk |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Auth certainty envelope
**What:** Resolve auth once per request path, classify outcomes into `authorized`, `unauthorized`, and `transient`.
**When to use:** Any protected API route and page gate.
**Implementation focus:** `frontend-new/lib/serverAuth.ts`, route handlers under `frontend-new/app/api/**`.

### Pattern 2: Single canonical writer for onboarding preferences
**What:** Frontend sends one payload to `/api/preferences`; route performs compatibility fallback for schema drift and secondary sync.
**When to use:** onboarding submit and preferences panel save.
**Implementation focus:** `frontend-new/app/onboarding/page.tsx`, `frontend-new/app/api/preferences/route.ts`, `frontend-new/app/meals/page.tsx`.

### Pattern 3: Tiered failure handling
**What:** Block only on canonical write failure; warn on secondary sync failures with retry path.
**When to use:** all onboarding and preference-save UX.
**Implementation focus:** structured API response payload and UI notice/toast handling.
</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Premature login redirect loops
**What goes wrong:** User gets redirected to `/login` during transient session uncertainty.
**Why it happens:** Caller treats any auth error as unauthorized.
**How to avoid:** Redirect only on explicit unauthorized conditions (`401/403` or confirmed `user == null`).

### Pitfall 2: Persistence drift between API and page-level writes
**What goes wrong:** `/api/preferences` succeeds but direct profile/allergy writes fail, causing conflicting UX and state.
**Why it happens:** duplicate write ownership in onboarding page.
**How to avoid:** enforce API single-writer ownership and return partial-success telemetry.

### Pitfall 3: Unrepeatable reliability validation
**What goes wrong:** reliability checks are ad hoc and regressions reappear.
**Why it happens:** no scripted assertions for onboarding->meals and plan state auth fallback.
**How to avoid:** commit scripted checks and a short manual smoke checklist tied to Phase 1 criteria.
</common_pitfalls>

## Validation Architecture

Nyquist-compatible validation for this phase should use:
- Quick signal per task: lint + grep assertions for exact strings/handlers changed.
- Wave-level checks: deterministic API assertion script for auth fallback and onboarding save semantics.
- Manual-only checks: login callback routing and onboarding->meals->refresh UX path.

Primary artifacts:
- `.planning/phases/01-auth-onboarding-reliability/01-VALIDATION.md`
- `frontend-new/scripts/phase1-reliability-check.ps1` (to be created by plan execution)
- `.planning/phases/01-auth-onboarding-reliability/01-UAT.md` (to be created by plan execution)

<sources>
## Sources

### Primary (HIGH confidence)
- `frontend-new/lib/serverAuth.ts`
- `frontend-new/lib/supabaseServer.ts`
- `frontend-new/app/api/preferences/route.ts`
- `frontend-new/app/api/meal-plan/state/route.ts`
- `frontend-new/app/onboarding/page.tsx`
- `frontend-new/app/meals/page.tsx`
- `frontend-new/app/auth/callback/page.tsx`
- `.planning/phases/01-auth-onboarding-reliability/01-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
</sources>

<metadata>
## Metadata

**Research scope:**
- Cookie + bearer auth behavior in page and API boundaries
- Onboarding persistence ownership and fallback semantics
- Deterministic validation path for reliability outcomes

**Confidence breakdown:**
- Auth/session handling: HIGH
- Onboarding persistence strategy: HIGH
- Validation strategy: MEDIUM (script and UAT artifacts created during execution)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13
</metadata>

---
*Phase: 01-auth-onboarding-reliability*
*Research completed: 2026-04-13*
*Ready for planning: yes*
