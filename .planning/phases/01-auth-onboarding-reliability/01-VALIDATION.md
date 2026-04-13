---
phase: 01
slug: auth-onboarding-reliability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | lint + scripted API assertions (PowerShell) |
| **Config file** | `frontend-new/eslint.config.mjs` |
| **Quick run command** | `npm run lint --prefix frontend-new` |
| **Full suite command** | `powershell -ExecutionPolicy Bypass -File frontend-new/scripts/phase1-reliability-check.ps1` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint --prefix frontend-new`
- **After every plan wave:** Run `powershell -ExecutionPolicy Bypass -File frontend-new/scripts/phase1-reliability-check.ps1`
- **Before `/gsd-verify-work`:** Run lint + reliability script + manual smoke checklist
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01, AUTH-02 | T-01-01 | Unauthorized redirects only on explicit unauthorized state | lint + grep | `rg -n "unauthorized|bearer fallback|auth" frontend-new/lib/serverAuth.ts frontend-new/app/meals/page.tsx` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | LOG-02 | T-01-02 | `/api/meal-plan/state` keeps cookie/bearer fallback behavior without 500 regressions | script | `powershell -ExecutionPolicy Bypass -File frontend-new/scripts/phase1-reliability-check.ps1 -Mode plan-state` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | ONB-01, ONB-02 | T-01-03 | Canonical `/api/preferences` is only blocking write path | lint + grep | `rg -n "/api/preferences|profiles\\.upsert|saveAllergiesToTable" frontend-new/app/onboarding/page.tsx frontend-new/app/api/preferences/route.ts` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 1 | ONB-03 | T-01-04 | Secondary sync failures are warning-only with retry path | script | `powershell -ExecutionPolicy Bypass -File frontend-new/scripts/phase1-reliability-check.ps1 -Mode onboarding` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | AUTH-01, AUTH-02, LOG-02 | T-01-05 | End-to-end onboarding->meals->refresh passes with persisted context | script + manual | `powershell -ExecutionPolicy Bypass -File frontend-new/scripts/phase1-reliability-check.ps1 -Mode full` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend-new/scripts/phase1-reliability-check.ps1` - deterministic API assertions for auth/onboarding reliability
- [ ] `.planning/phases/01-auth-onboarding-reliability/01-UAT.md` - manual UX smoke steps and expected outcomes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auth callback route decision (login/onboarding/meals) feels correct to user | AUTH-02 | depends on real browser session/cookies and navigation behavior | Sign in, complete callback, verify routing for new and returning users |
| Onboarding warning messaging for secondary sync failures is clear | ONB-02 | UX clarity and timing not reliably captured by static checks | Force secondary sync fail path, verify warning/toast copy and retry affordance |
| Meals page preserves onboarding notice and then clears query params | ONB-03 | visible UX and router behavior | Complete onboarding with defaults and full setup, verify notices and cleaned URL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing script/checklist references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
