# Ovona agents

Two Ovona-specific agents, available under the same names in Claude and Codex:

- **`ovona-product-manager`** refines the backlog, prioritises work, writes acceptance criteria and plans features. It does not edit application code.
- **`ovona-fullstack-engineer`** implements Ready Jira stories in the existing architecture, with regression tests and acceptance evidence.

## Layout

The rules live once, under `.agents/ovona/`. Each tool has a thin adapter that points at them.

Source of truth:

- `.agents/ovona/shared/project-rules.md`: project rules and which docs to trust
- `.agents/ovona/shared/jira-workflow.md`: Jira access, Definition of Ready and Done, handoffs
- `.agents/ovona/roles/product-manager.md`: Product Manager role
- `.agents/ovona/roles/fullstack-engineer.md`: Fullstack Engineer role

Adapters:

- `.claude/agents/ovona-product-manager.md`
- `.claude/agents/ovona-fullstack-engineer.md`
- `.codex/agents/ovona-product-manager.toml`
- `.codex/agents/ovona-fullstack-engineer.toml`

Each adapter tells its agent to read `AGENTS.md`, both shared files and its role file first, and to stop and report if any is missing. It then repeats only the critical safety rules.

The Product Manager's saved proposals go in `.planning/product/`, but only when a user explicitly asks for a saved file. That folder is created at that point and isn't in the repo until then.

## Invocation

**Claude**

- Ask for the agent by name.
- For story work, start a main session with `claude --agent ovona-fullstack-engineer`. Subagents can't ask the user questions, so a main session suits GSD better.

**Codex**

- Ask for the agent by name, for example: "Have ovona-product-manager refine SCRUM-n".

## Changing a rule

Edit the shared or role file. Change the adapters only if the inline safety rules change, and keep the Claude and Codex versions of a role in step.

## Enforcement limits

Most of these rules are instructions, not hard controls:

- The Claude Product Manager has no Edit or Bash tool, but Write can't be limited to a folder. Its write limit relies on the agent following instructions.
- Codex limits are instructions only, because a role can't set its own sandbox.
- `/gsd-quick` inside a subagent is untested.

## Source and attribution

Adapted from `alirezarezvani/claude-skills`. The text was rewritten for Ovona, not copied.

- Repository: `alirezarezvani/claude-skills`
- Commit: `8f082544116fc0d014188e521ca40304cdfc86b0`
- Upstream files: `agents/engineering/cs-fullstack-engineer.md` and `agents/product/cs-product-manager.md`
- Licence: MIT License, Copyright (c) 2025 Alireza Rezvani

No upstream script, skill or agent is a runnable dependency of these agents.

## Dependency disposition

| Upstream dependency | Handling |
|---|---|
| 7-question stack grill, decision engine, profiles, project and SaaS scaffolders | Dropped: stack already chosen |
| `code_quality_analyzer.py` | Replaced by existing tests, TypeScript check, ESLint |
| `complexity_checker.py`, `diff_surgeon.py` | Replaced by diff review checklist; optional later install |
| API, database, migration, performance specialists | Replaced by Ovona checklists plus installed `gsd-code-reviewer`, `gsd-security-auditor` |
| SLO, CI/CD specialists | Dropped for now |
| `rice_prioritizer.py`, `user_story_generator.py`, PRD and story templates | Replaced by RICE formula, INVEST checks, Given/When/Then templates written fresh |
| Interview analyser, persona generator | Replaced by manual synthesis when research is supplied |
| OKR, design token, competitor, landing page tools | Dropped: outside role |
| Related `cs-*` agents, `/cs-fullstack-review`, `/tmp` notes | Replaced by GSD agents and `.planning/` records |

## Optional future installs

Each of these needs separate approval:

- `complexity_checker.py` and `diff_surgeon.py`, after checking that they work on TypeScript
- An Atlassian connection for Claude
