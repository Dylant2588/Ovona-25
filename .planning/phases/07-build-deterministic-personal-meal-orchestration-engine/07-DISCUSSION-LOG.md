# Phase 7: Build deterministic personal meal orchestration engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 07-build-deterministic-personal-meal-orchestration-engine
**Areas discussed:** Constraint ownership, weekly schedule behaviour, replacement scope, shopping aggregation

---

## Constraint ownership

| Option | Description | Selected |
|--------|-------------|----------|
| LLM-led planner | Let an LLM decide constraints and corrections | |
| Deterministic engine with optional LLM adapter | Code enforces safety/nutrition; future LLM use is limited to soft preferences | ✓ |

**User's choice:** Deterministic engine with optional LLM adapter.
**Notes:** Allergies, calories, macros, quantities, and hard constraints must not rely on an LLM.

---

## Weekly schedule behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Recipe selection flow | Require the user to choose individual recipes | |
| Automatic weekly schedule | Generate seven days from the profile and constraints | ✓ |

**User's choice:** Automatic weekly schedule with variety, intentional leftovers, and low effort.

---

## Replacement scope

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild the week | Regenerate every day after a swap | |
| Local replacement | Replace one meal using the remaining week as context | ✓ |

**User's choice:** Local replacement.

---

## Deferred Ideas

- LLM interpretation of free-text preferences after deterministic planning is trusted.
- Family optimisation and clinical nutrition intelligence.
