---
name: health
description: Verify environment is ready for development.
---

Run environment health checks by executing actual commands and reporting results:

## Checks to Run

1. **Git**: Run `git status` — report if repo is clean or dirty
2. **Python**: Run `python --version` — report if Python is available
3. **Node**: Run `node --version` — report if Node is available (skip if not a JS project)
4. **Hooks config**: Read `.claude/settings.json` — verify it exists and has all 4 event types (SessionStart, PreToolUse, PostToolUse, Stop)
5. **Test command**: Check `CLAUDE.md` or `PROJECT_BRIEF.md` for a configured test command
6. **Formatters**: Check if `ruff` and/or `prettier` are available (run `ruff --version`, `npx prettier --version`)
7. **Verify marker**: Read `.workflow-state.json` `needs_verify` field via `read_workflow_state()` from `_lib.py` — report status (CLEAR if null, ACTIVE if set)
8. **Project files**: Check if `PLAN.md`, `ARCHITECTURE.md`, `HANDOFF.md` exist in `.claude/docs/`
9. **Workflow config**: Check if `.claude/workflow.json` exists — report configured commands (test, lint, format)
10. **Project commands configured**: Run the validator and report results at the correct severity level (FAIL for critical commands, WARN for optional ones).
11. **Root kind and concurrent activity**: Classify the current working directory via `_lib.root_kind()` (one of `canonical_root`, `linked_human_worktree`, or `worker_worktree`) and run `_lib.concurrent_root_guard_decision()`. Report `FAIL` only when the current root is `canonical_root` and at least one linked human worktree has a non-empty `ralph.current_story_id` or `needs_verify` set. Otherwise report `PASS` (solo canonical root, linked human worktree, or worker worktree) or `WARN` when helper discovery fails. Idle sibling worktrees must never fail this check.
12. **Sprint artifacts**: Check whether sprint-namespaced paths exist. Read `ralph.active_sprint_id` from `.workflow-state.json`. If set, verify the sprint directory `.claude/sprints/<sprint-id>/` exists and report contents (PLAN.md, prd.json present or missing). If not set, check legacy singleton paths (`.claude/docs/PLAN.md`, `.claude/prd.json`). Report PASS if artifacts found, INFO if none (fresh session).

## Critical Check: Project Commands

Before rendering the results table, run the deterministic validator:

```python
import sys
sys.path.insert(0, ".claude/hooks")
from _lib import validate_project_commands

result = validate_project_commands()
# result = {"status": "PASS"|"FAIL"|"WARN", "project_mode": "...", "failures": [...], "warnings": [...], "configured": {...}, "mode_error": "..."}
```

### If result["status"] == "FAIL"

Output this block BEFORE the health table. This is a **hard failure** — Ready to Develop is **NO**.

```
FAIL: Project command contract is invalid in workflow.json:
```

For each key in `result["failures"]`, output one of these lines:

- `project_mode` → `  - project_mode: must be explicitly set to self_hosted or host_project`
- `project_test` → `  - project_test: still TODO — required host-project test command is missing`
- `project_lint` → `  - project_lint: still TODO — required host-project lint command is missing`
- `project_test` with ADE self-tests in host_project mode → `  - project_test: points at .claude/hooks/tests but host_project mode must use the project's own tests`

For each key in `result["warnings"]`, output:

- `project_type_check` → `  - project_type_check: still TODO (optional — WARN only)`

Then output:

```
Action required: Edit .claude/workflow.json so project_mode is explicit and the host-project commands match that mode.
```

Set check #10 to **FAIL** in the table. **Ready to Develop: NO** — list the unconfigured critical commands as the reason.

### If result["status"] == "WARN"

Output a warning block (project_type_check is TODO but critical commands are configured):

```
WARN: Optional project commands not configured in workflow.json:
  - project_type_check: still TODO (type checking is optional)

This does not block development.
```

Set check #10 to **WARN** in the table. **Ready to Develop** remains YES.

### If result["status"] == "PASS"

Output the configured commands:

```
PASS: All project commands configured:
  - project_test: <value>
  - project_lint: <value>
  - project_type_check: <value>
```

Set check #10 to **PASS** in the table.

## Output Format

## Environment Health Check

| #   | Check            | Status         | Notes                                                                            |
| --- | ---------------- | -------------- | -------------------------------------------------------------------------------- |
| 1   | Git repository   | PASS/FAIL      | [clean/dirty + branch]                                                           |
| 2   | Python           | PASS/FAIL      | [version or not found]                                                           |
| 3   | Node             | PASS/SKIP      | [version or not found]                                                           |
| 4   | Hooks config     | PASS/FAIL      | [event types found]                                                              |
| 5   | Test command     | PASS/WARN      | [command or not configured]                                                      |
| 6   | Formatters       | PASS/WARN      | [which are available]                                                            |
| 7   | Verify marker    | CLEAR/ACTIVE   | [needs_verify value from .workflow-state.json; null = CLEAR]                     |
| 8   | Project files    | PASS/WARN      | [which exist]                                                                    |
| 9   | Workflow config  | PASS/WARN      | [configured commands]                                                            |
| 10  | Project commands | PASS/FAIL/WARN | [FAIL if project_mode is missing/invalid or host_project points at TODO/ADE self-tests; WARN if only project_type_check is TODO] |
| 11  | Root activity    | PASS/FAIL/WARN | [FAIL only for canonical root + active sibling (current_story_id or needs_verify); PASS for solo canonical root, linked human worktree, or worker worktree; WARN on discovery error] |
| 12  | Sprint artifacts | PASS/INFO      | [sprint-id and available artifacts, or "no active sprint"] |

### Workspace Banner

After the health table, display a workspace banner based on `root_kind`:

- **`canonical_root`**: Display warning:
  ```
  WARNING: Canonical repo root — for inspection, admin, and recovery only.
  For issue work, run /ralph-plan or /ralph (auto-enters a worktree).
  Alternative: python .claude/scripts/start-ralph-session.py --name <issue-name>
  ```

- **`linked_human_worktree`**: Display confirmation:
  ```
  Session root OK for Ralph work.
  ```

- **`worker_worktree`**: Display:
  ```
  Worker worktree — internal Ralph agent context.
  ```

### Sibling Sessions

If sibling linked worktrees exist (discovered via `git worktree list --porcelain`), list them:

```
Active sessions:
  session/issue-a  ->  C:\...\sessions\myrepo\issue-a  [ralph active: STORY-003]
  session/issue-b  ->  C:\...\sessions\myrepo\issue-b  [idle]
```

For each sibling, check its `.claude/.workflow-state.json` for `ralph.current_story_id` to determine activity status.

### Ready to Develop: YES / NO

[If NO, list what needs to be fixed — project_mode must be explicit, host_project must not point at .claude/hooks/tests, and project_test/project_lint TODO values are blockers; project_type_check TODO is a WARN only]
