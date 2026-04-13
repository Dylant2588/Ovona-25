# Phase 1: Auth + Onboarding Reliability - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Make authentication and onboarding persistence dependable so users can always reach the planner and keep saved profile/preference context across sessions.

Scope is limited to Phase 1 requirements: `AUTH-01`, `AUTH-02`, `ONB-01`, `ONB-02`, `ONB-03`, `LOG-02`.

</domain>

<decisions>
## Implementation Decisions

### Session guard behavior
- **D-01:** Use hybrid auth guard behavior: prefer cookie session, then bearer fallback, with bounded retry on transient failures.
- **D-02:** Redirect to `/login` only on explicit unauthorized outcomes, not on initial uncertainty/timeouts.

### Onboarding failure handling
- **D-03:** Use tiered criticality for onboarding writes: block progression only when canonical `/api/preferences` save fails.
- **D-04:** Treat secondary profile/allergy sync as best-effort; continue flow with explicit warning and retry path.

### Preference write ownership
- **D-05:** `/api/preferences` is the single writer contract for preference/profile persistence logic.
- **D-06:** Remove/avoid parallel direct-table write behavior from page-level UI handlers where API coverage exists.

### Reliability validation depth
- **D-07:** Execute a scripted reliability checklist with deterministic route/API assertions.
- **D-08:** Pair scripted checks with targeted manual UX smoke for onboarding -> meals -> refresh -> return-session flow.

### the agent's Discretion
- Exact retry backoff values and max attempts (within existing bounded-retry pattern)
- Exact warning copy/toast styling for non-blocking secondary sync failures
- Whether checklist tooling is script-first (PowerShell/Node) or documented manual+API command set, as long as repeatable

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase scope
- `.planning/PROJECT.md` - Core value, constraints, and active boundaries
- `.planning/REQUIREMENTS.md` - Phase-1 requirement contract (`AUTH-01/02`, `ONB-01/02/03`, `LOG-02`)
- `.planning/ROADMAP.md` - Phase 1 goal, success criteria, and plan decomposition targets
- `.planning/STATE.md` - Current phase position and known blocker notes

### Architecture and conventions
- `.planning/codebase/ARCHITECTURE.md` - App/API/domain layering and generation flow context
- `.planning/codebase/STRUCTURE.md` - File/module locations for auth/onboarding persistence paths
- `.planning/codebase/CONVENTIONS.md` - Error handling and auth fallback conventions

### Implementation-critical code paths
- `frontend-new/lib/serverAuth.ts` - cookie/bearer auth resolution behavior
- `frontend-new/lib/supabaseServer.ts` - route-handler Supabase client creation
- `frontend-new/app/auth/callback/page.tsx` - auth callback routing behavior
- `frontend-new/app/meals/page.tsx` - protected planner guard and auth fetch retry behavior
- `frontend-new/app/onboarding/page.tsx` - onboarding save flow and post-save routing
- `frontend-new/app/api/preferences/route.ts` - canonical persistence + compatibility fallback logic

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveRequestAuth` (`frontend-new/lib/serverAuth.ts`): reusable auth resolver supporting cookie session + bearer fallback.
- `authFetchWithRetry` (`frontend-new/app/meals/page.tsx`): existing bounded retry wrapper usable as baseline for reliability behavior.
- `/api/preferences` fallback writer (`frontend-new/app/api/preferences/route.ts`): existing schema-compatibility strategy for user preference writes.

### Established Patterns
- API routes return structured JSON with explicit status codes and route-prefixed logging.
- Fallback-first behavior exists across planner stack (graceful degradation preferred over hard failure when safe).
- UI currently uses toast/inline notices for recoverable operations.

### Integration Points
- Onboarding writes originate in `frontend-new/app/onboarding/page.tsx` and should converge on `/api/preferences`.
- Session-driven route decisions live in `frontend-new/app/auth/callback/page.tsx` and planner route guards in `frontend-new/app/meals/page.tsx`.
- Any auth persistence changes must stay compatible with `frontend-new/lib/serverAuth.ts` and Supabase RLS expectations.

</code_context>

<specifics>
## Specific Ideas

- Auto mode selected for this discuss step; recommended defaults were applied to all identified Phase 1 gray areas.
- Preference for resilient behavior: avoid unnecessary login loops and avoid losing onboarding progress when secondary sync fails.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 1 scope.

</deferred>

---
*Phase: 01-auth-onboarding-reliability*
*Context gathered: 2026-04-13*
