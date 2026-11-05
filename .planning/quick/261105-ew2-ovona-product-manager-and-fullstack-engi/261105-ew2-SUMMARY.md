---
phase: quick-261105-ew2
plan: 01
subsystem: agent-tooling
tags: [agents, claude, codex, jira-workflow, docs]
requires: []
provides:
  - ovona-product-manager agent for Claude and Codex
  - ovona-fullstack-engineer agent for Claude and Codex
  - Shared Ovona project rules and Jira workflow under .agents/ovona
affects: [story refinement, story delivery]
tech-stack:
  added: []
  patterns: [Shared source of truth with thin per-tool adapters]
key-files:
  created:
    - .agents/ovona/README.md
    - .agents/ovona/shared/project-rules.md
    - .agents/ovona/shared/jira-workflow.md
    - .agents/ovona/roles/product-manager.md
    - .agents/ovona/roles/fullstack-engineer.md
    - .claude/agents/ovona-product-manager.md
    - .claude/agents/ovona-fullstack-engineer.md
    - .codex/agents/ovona-product-manager.toml
    - .codex/agents/ovona-fullstack-engineer.toml
  modified: []
decisions:
  - Each role's adapters share the same inline rules; the Codex version adds one Codex Jira rule.
  - The PM adapters repeat the updated output rule (reply by default, file only on explicit request).
metrics:
  duration: about 3 minutes
  completed: 2026-11-05
requirements: [QUICK-OVONA-AGENTS]
---

# Quick Task 261105-ew2 Plan 01: Ovona Agents Summary

Ovona Product Manager and Fullstack Engineer agents for Claude and Codex, with rules held once in `.agents/ovona/` and thin adapters per tool, delivered in one 9-file commit.

## Commit

`0925a91` on `chore/ovona-agents`: `docs(agents): add Ovona product manager and fullstack engineer agents`. It contains exactly the 9 planned files. Nothing was pushed.

## Tasks

| Task | Result |
|------|--------|
| 1. Baseline, shared and role files | Baseline recorded with 34 entries. Four files written. Check printed `checked` with no `MISSING` lines. |
| 2. Adapters and README | Five files written. Both TOML files and both frontmatter blocks parsed. Check printed `ok`. |
| 3. Verify and commit | `verify-agents.py` exited 0 with 0 failures. Exactly 9 paths staged. Post-commit check printed `scope-ok`. |

Per the plan, Tasks 1 and 2 were not committed separately, so one commit covers all three tasks.

## Verification

- The first `verify-agents.py` run reported one failure, described under Deviations. The rerun exited 0.
- The script skipped 16 tokens, all reviewed. They are `.planning/product/` paths (runtime), slash commands, `/tmp` and upstream names in the README, and `node:assert/strict`.
- A separate grep for leftovers found matches only in the README, on table rows or under `## Source and attribution` and `## Optional future installs`.
- After the commit, the worktree outside this directory matched the baseline.
- No application tests were run and Jira was not called, as the plan specifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backticked file extension failed the path check**
- **Found during:** Task 3
- **Issue:** `.agents/ovona/roles/fullstack-engineer.md` put `.ts` in backticks, so the path check read it as a missing repo path.
- **Fix:** Removed the backticks from that extension. The skip list was not widened.
- **Files modified:** `.agents/ovona/roles/fullstack-engineer.md`
- **Commit:** `0925a91`

The commit message also ends with the `Co-Authored-By` line, as the execution instructions required. The plan's message did not show it.

## Known Limitations

- Neither agent has been invoked in Claude or Codex. Files were checked by parsing and content only, so loading by name is unproven until first use.
- `verify-agents.py` is a pre-commit check. Its scope check will now fail if rerun, because the 9 files are committed and no longer appear in `git status`.
- Of the script's checks, only the path check has been seen to fail on a real problem. The others have only been seen to pass, though the separate grep agrees on leftovers.
- The enforcement limits in the README still apply: the Claude PM's Write can't be limited to a folder, Codex limits are instructions only, and `/gsd-quick` inside a subagent is untested.

## Known Stubs

None. The `...` in the commit examples and `SCRUM-n` are intentional templates.

## Quick-task Artifacts

These stay uncommitted in this directory, for the orchestrator to handle:

- `baseline-status.txt`
- `verify-agents.py`
- `261105-ew2-PLAN.md`
- `261105-ew2-CONTEXT.md`
- `261105-ew2-SUMMARY.md`

## Self-Check: PASSED

All 9 files exist at HEAD, commit `0925a91` exists on `chore/ovona-agents`, and `baseline-status.txt` and `verify-agents.py` are present.
