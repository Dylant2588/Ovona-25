# Phase 1: Auth + Onboarding Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 1-auth-onboarding-reliability
**Areas discussed:** Session guard behavior, Onboarding failure handling UX, Single source of truth for preference writes, Reliability validation depth

---

## Session guard behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Strict redirect when no session cookie | Any missing session state sends user immediately to `/login`. | |
| Hybrid fallback with retry and explicit unauthorized redirect | Use cookie session first, fallback bearer auth, bounded retries, redirect only on explicit unauthorized. | ? |
| Optimistic local state with delayed auth checks | Keep UI alive and defer auth enforcement until later interactions. | |

**User's choice:** Auto mode -> recommended option selected (hybrid fallback with explicit unauthorized redirect).
**Notes:** Aligns with reliability requirement to avoid false-negative login loops during transient Supabase/session states.

---

## Onboarding failure handling UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block until all writes succeed | User cannot proceed unless every onboarding persistence operation succeeds. | |
| Tiered criticality with canonical-save gate and best-effort secondary sync | Block on `/api/preferences` failure; allow progress on secondary sync failures with warning/retry path. | ? |
| Always continue silently on partial writes | Never block and do not surface persistence warnings. | |

**User's choice:** Auto mode -> recommended option selected (tiered criticality).
**Notes:** Preserves data correctness for core preference contract while reducing friction for non-critical mirror writes.

---

## Single source of truth for preference writes

| Option | Description | Selected |
|--------|-------------|----------|
| Keep dual write paths for resilience | Maintain both API and direct table-write paths. | |
| API-only writer contract (single source of truth) | Route preference/profile persistence through `/api/preferences` contract. | ? |
| Direct client writes to Supabase tables | Persist primarily from client code without API abstraction. | |

**User's choice:** Auto mode -> recommended option selected (API-only writer contract).
**Notes:** Reduces schema-drift failures and keeps compatibility logic centralized.

---

## Reliability validation depth

| Option | Description | Selected |
|--------|-------------|----------|
| Manual smoke checks only | Validate flow manually without scripted assertions. | |
| Scripted checklist + API assertions + targeted manual smoke | Add repeatable checks for route/API reliability plus focused UX verification. | ? |
| Full end-to-end automation suite in this phase | Build a complete automated E2E suite now. | |

**User's choice:** Auto mode -> recommended option selected (scripted checklist + API assertions + targeted manual smoke).
**Notes:** Balances phase speed and reliability evidence without over-investing in full automation yet.

## the agent's Discretion

- Exact retry/backoff tuning values within existing bounded retry architecture.
- Exact user-facing warning copy for secondary sync failures.
- Choice of checklist implementation format (script file vs command-runbook), provided repeatability is preserved.

## Deferred Ideas

None.
