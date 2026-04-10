---
name: audit
description: Run end-to-end workflow integrity audit — validates PLAN.md, prd.json, tests, verification logs, architecture, hooks, git hygiene, test quality, and error handling resilience.
context: fork
---

# /audit — End-to-End Workflow Integrity Audit

## Mode Resolution (run first)

Read the invocation argument (the first word after `/audit`, if any). Resolve it:

```python
import sys
sys.path.insert(0, ".claude/hooks")
from _lib import AuditMode
from _audit_lib import get_audit_sections

mode_arg = "<first word of invocation args, or None if omitted>"
mode = AuditMode.resolve(mode_arg)
active_sections = get_audit_sections(mode)
```

Log at the top of your output:

```
Mode: <mode.value> — Sections: <comma-separated active_sections>
```

For each section number 1–10: if the section number is **not** in `active_sections`, record:

```
SKIP (mode: <mode.value>)
```

and move to the next section. Do **not** evaluate the section's checks.

**Resolve sprint paths first:** Call `_lib.active_sprint_paths()` to get `plan_path`, `prd_path`, `progress_path`, and `verification_log_path`. Use these resolved paths for all artifact references below. Falls back to legacy singleton paths when no `active_sprint_id` is set.

Run all 10 audit sections in order. For each check, record PASS, FAIL, or SKIP with evidence. Missing files are SKIP (not FAIL) with reason.

## Section 1: PLAN.md Completeness

Read the resolved `plan_path`. If not found: **SKIP** `"PLAN.md not found"`.

- [ ] Goal section filled (not placeholder brackets)
- [ ] At least 1 phase defined
- [ ] Every phase passes the **tiered completeness check** (see procedure below)
- [ ] All Done When items use R-PN-NN format (regex: `R-P\d+-\d{2}`)
- [ ] Risks & Mitigations section filled (not placeholder)
- [ ] Dependencies section present

### Tiered Phase Completeness Procedure

For each phase block in PLAN.md:

1. Read the **"Phase Type:"** line from the phase header (e.g., `**Phase Type**: `foundation``). If the line is absent, treat as `module` (conservative default).

2. Apply the appropriate check set based on phase type:

   | Section              | foundation | module / integration / e2e |
   | -------------------- | ---------- | -------------------------- |
   | Changes table        | Required   | Required                   |
   | Done When            | Required   | Required                   |
   | Verification Command | Required   | Required                   |
   | Interface Contracts  | **SKIP**   | Required                   |
   | Data Flow            | **SKIP**   | Required                   |
   | Testing Strategy     | **SKIP**   | Required                   |

3. For **foundation** phases: emit `SKIP (foundation phase — optional section)` for Interface Contracts, Data Flow, and Testing Strategy. Do **not** emit FAIL for these missing sections.

4. For **module / integration / e2e** phases: all six sections are required. Emit FAIL for any missing section.

5. Record the phase type alongside each check result for traceability (e.g., `PASS [foundation]`, `FAIL [module]`).

## Section 2: prd.json <-> PLAN.md Alignment

Read the resolved `prd_path`. If not found: **SKIP** `"prd.json not found"`.

- [ ] `version` field equals `"2.0"`
- [ ] Forward check: every prd.json acceptanceCriteria `id` exists in the plan's Done When
- [ ] Backward check: every plan R-PN-NN ID appears in at least one prd.json story's criteria
- [ ] Story count vs phase count comparison (flag mismatches)
- [ ] `gateCmds` entries match plan Verification Commands (semantic comparison)
- [ ] `planRef` points to an existing file
- [ ] `plan_hash` check: if prd.json has a `plan_hash` field, compute normalized hash via `compute_plan_hash()` from `_qa_lib.py` (hashes only R-marker lines, sorted) and compare against stored hash. **FAIL** if mismatch (R-marker criteria changed but prd.json not regenerated). **SKIP** if `plan_hash` field absent (legacy prd.json without hash). **PASS** if hashes match.

## Section 3: Test Coverage Traceability

For each R-PN-NN ID found in prd.json:

- [ ] Grep test files for `# Tests R-PN-NN` marker — flag untraceable criteria (no linked test)
- [ ] If prd.json specifies `testFile`: verify the file path exists (Glob)
- [ ] Flag orphan tests: test files with `# Tests R-PN-NN` markers that don't match any prd.json criterion
- [ ] Summary: X/Y criteria traceable, Z orphan tests

If no test files exist: **SKIP** `"No test files found"`.

## Section 4: Verification Log Integrity

Read the resolved `verification_log_path` (JSONL format — one JSON object per line). If the file is missing and no phases are completed: **SKIP** `"No verification log (no phases completed)"`. If missing but stories are marked `passed: true`: **FAIL** `"Stories passed but no verification log"`.

**Namespace isolation**: Use `read_verification_log(path, plan_hash=current_hash)` from `_qa_lib.py` to scope the audit to the current planning cycle. Read the current plan hash from `prd.json["plan_hash"]`. If `plan_hash` is absent from prd.json (legacy format), fall back to `read_verification_log(path)` (no filter) with a **WARNING** `"prd.json has no plan_hash — reading all verification entries (no namespace isolation)"`.

Legacy entries (entries without a `plan_hash` field) are excluded from the filtered view. If any legacy entries exist, emit an informational **WARNING** `"[N] legacy entries without plan_hash found — these belong to prior planning cycles and are excluded from this audit"`. This is NOT a failure.

Parse each line with `json.loads()`. If a line fails to parse, emit a **WARNING** `"Corrupt JSONL line [N]: skipping"` and continue processing remaining lines. Do not treat corrupt lines as FAIL — only warn.

**Sentinel entries (`type == "plan_replacement"`)**: Before performing story coverage checks, scan all parsed entries for entries with `"type": "plan_replacement"`. These sentinels are created by `--log-plan-replacement` when PLAN.md is replaced mid-sprint. For each such sentinel:

- Emit an **INFO** message: `"plan_replacement sentinel found: old=[old_plan_hash], new=[new_plan_hash], reason=[reason]"`.
- Collect the `old_plan_hash` values from all sentinels whose `new_plan_hash` matches the current `plan_hash`. Call this set `covered_old_hashes`.
- When performing story coverage checks below, treat entries with `plan_hash` in `covered_old_hashes` as equivalent to entries with the current `plan_hash` (cross-hash coverage resolution). Stories verified under the old plan hash before the sentinel was written count as covered under the new plan hash.
- Sentinel entries themselves must **NOT** appear in the `entries` list used for story coverage checks — they are metadata only.

**Manual injection entries (`"injected": true`)**: After collecting all regular entries (excluding sentinel type entries), count entries that have an `"injected": true` field. If the count is greater than zero:

- Emit a **WARNING** (not FAIL): `"[N] manual injection entries found — these were injected via --inject-verification and should be reviewed"`.
- Include these entries in story coverage checks (a manually injected PASS entry counts as a PASS for `/audit` purposes — the WARNING provides visibility without blocking the audit).

- [ ] Every story with `passed: true` in prd.json has at least one JSONL entry with matching `story_id` and `overall_result: "PASS"` (within current plan_hash namespace, including cross-hash coverage from plan_replacement sentinels)
- [ ] No unresolved FAIL entries: for each `story_id`, the most recent entry should be `"PASS"` (a FAIL followed by a later PASS is resolved)
- [ ] Each entry contains required fields: `story_id`, `timestamp`, `overall_result`
- [ ] If entry has `qa_steps` array: verify each step has `step`, `name`, `result` fields
- [ ] If entry has `spot_check` object: verify it contains gate command results

## Section 5: Architecture Conformance

Read `.claude/docs/ARCHITECTURE.md`. If not found: **SKIP** `"ARCHITECTURE.md not found"`.

- [ ] Content is populated (not just placeholder brackets)
- [ ] No `[AUTO-DETECTED]` tags remaining unchecked
- [ ] Components listed match actual file structure (spot-check top-level dirs)

### Documentation Drift Detection

Run these count-based checks to catch undocumented additions and stale counts. All mismatches are **FAIL**.

**Agent count**:

```bash
ls .claude/agents/*.md | wc -l
```

Extract the agent count stated in ARCHITECTURE.md (search for a line matching `\d+ agents` or a table row count under an "Agents" heading). If the file count does not match the stated count: **FAIL** `"Agent count drift: N files on disk vs M stated in ARCHITECTURE.md"`.

**Skill count**:

```bash
ls .claude/skills/*/SKILL.md | wc -l
```

Extract the skill count stated in ARCHITECTURE.md (search for a line matching `\d+ skills` or `\d+ slash commands`). If the file count does not match the stated count: **FAIL** `"Skill count drift: N files on disk vs M stated in ARCHITECTURE.md"`.

**Execution model cross-reference**:
Check the Ralph execution model described in ARCHITECTURE.md against `.claude/agents/ralph-worker.md`:

- If ARCHITECTURE.md contains "branch-inline" or "directly on feature branch", verify ralph-worker.md also describes branch-inline execution (e.g., contains "no worktree isolation" or "directly on" the feature branch). If ralph-worker.md instead describes worktree isolation as the primary model: **FAIL** `"Execution model drift: ARCHITECTURE.md says branch-inline but ralph-worker.md says worktree-isolated"`.
- If ARCHITECTURE.md describes "worktree isolation" as the primary Ralph execution model, verify ralph-worker.md also describes worktree isolation. If ralph-worker.md says "no worktree isolation": **FAIL** `"Execution model drift: ARCHITECTURE.md says worktree-isolated but ralph-worker.md says branch-inline"`.
- Note: Both files may legitimately mention "worktree" in non-primary contexts (e.g., cleanup, backward-compatible fields). Only flag if the **primary execution model** is contradictory.

**README count consistency**:
If `README.md` exists in the project root, check whether it states an agent count or skill count. If the README count differs from the ARCHITECTURE.md count or the on-disk count: **FAIL** `"README count drift: README.md states M agents/skills but ARCHITECTURE.md or disk shows N"`.

If any stated count cannot be parsed from ARCHITECTURE.md (e.g., no numeric count found), emit **WARN** `"Cannot parse [agent/skill] count from ARCHITECTURE.md — manual check required"` and do not FAIL that sub-check.

## Section 6: Hook Chain Health

Check all 6 hook files exist in `.claude/hooks/`:

- [ ] `pre_bash_guard.py` exists
- [ ] `post_format.py` exists
- [ ] `post_bash_capture.py` exists
- [ ] `stop_verify_gate.py` exists
- [ ] `post_compact_restore.py` exists
- [ ] `post_write_prod_scan.py` exists
- [ ] `_lib.py` exists and importable (`python -c "import sys; sys.path.insert(0,'.claude/hooks'); import _lib; print('OK')"`)

Check supporting utilities exist:

- [ ] `qa_runner.py` exists and runnable (`python .claude/hooks/qa_runner.py --help`)
- [ ] `test_quality.py` exists and runnable (`python .claude/hooks/test_quality.py --help`)

Check runtime state via `.claude/.workflow-state.json`:

- [ ] `needs_verify` field: non-null (needs verification) or null (clean)
- [ ] `stop_block_count` field: value > 0 (blocked) or 0 (clean)
- [ ] `.claude/workflow.json` valid JSON (if present)

## Section 7: Git Hygiene & Production-Grade Code

If not in a git repository: **SKIP** `"Not a git repository"`.

- [ ] No secrets in uncommitted changes: grep staged/unstaged for `.env` patterns, API keys, tokens
- [ ] No debug prints in committed source files: `grep -rn "print(\|console\.log\|debugger\|binding\.pry" --include="*.py" --include="*.js" --include="*.ts" src/ lib/` (adjust paths)
- [ ] Conventional commit format in recent commits: `git log --oneline -10` all match `feat:|fix:|docs:|chore:|refactor:|test:|ci:`
- [ ] No merge conflict markers in tracked files: `grep -rn "<<<<<<\|======\|>>>>>>" --include="*.py" --include="*.js" --include="*.ts" --include="*.md"`
- [ ] Work is on a feature branch (not main/master): `git rev-parse --abbrev-ref HEAD`
- [ ] No TODO/HACK/FIXME/XXX in committed source files: `grep -rn "TODO\|HACK\|FIXME\|XXX" --include="*.py" --include="*.js" --include="*.ts" src/ lib/`
- [ ] No bare except/catch blocks in committed source files
- [ ] No hardcoded URLs, ports, or credentials in source files
- [ ] No unused imports in committed source files (ruff/eslint if available)
- [ ] No `git add -A` or `git add .` in recent git reflog: `git reflog --format='%gs' -20`
- [ ] `.gitignore` includes: `.claude/worktrees/`, `.claude/.workflow-state.json`, `.claude/docs/verification-log.jsonl`

## Section 8: Test Quality Scan (Mock Abuse & Assertion Quality)

Run the automated test quality analyzer for programmatic detection:

```bash
python .claude/hooks/test_quality.py --dir [test-directory] --prd [resolved prd_path]
```

Parse the JSON output and report findings. If `test_quality.py` is not available, fall back to manual analysis below.

Use the active project's test directory here. Do not hardcode an ADE-only test path in host-project guidance.

For each test file containing `# Tests R-PN-NN` markers:

If no test files with R-PN-NN markers exist: **SKIP** `"No traceable test files found"`.

### Self-mock detection

- Does the test import `mock`/`patch`/`MagicMock`?
- Is the mock target the same module/function the test claims to test?
- **YES → FAIL** `"Self-mocking: test mocks what it is supposed to test"`

### Assertion-free test detection

- Does the test contain `assert`/`assertEqual`/`expect`/`assert_called` statements?
- **ZERO assertions → FAIL** `"Assertion-free: test proves nothing"`

### Strategy mismatch detection

- Read prd.json `testType` for this criterion's R-PN-NN ID
- Read PLAN.md Testing Strategy Real/Mock column for this test
- **If Strategy says "Real" but test uses mock/patch → FAIL** `"Strategy mismatch: plan says Real, test uses Mock"`

### Heavy mock detection

- Count `mock`/`patch` decorators + context managers in test
- Count real (non-mocked) dependencies
- **If >80% dependencies mocked → WARNING** `"Heavily mocked: [X]% dependencies are mocked"`

### Mock-only assertion detection

- If test ONLY asserts `mock.called` / `mock.call_count` / `mock.assert_called_with`
- AND does NOT assert any return value or state change
- **→ WARNING** `"Mock-only assertions: verifies call happened but not correctness"`

## Section 9: Error Handling Resilience

Analyze error handling quality in changed source files using the `silent-failure-hunter` agent from the `pr-review-toolkit` plugin.

**SKIP conditions**:

- `"No source files changed"` — if `git diff main...HEAD --name-only --diff-filter=d` returns no source files (`.py`, `.js`, `.ts`)
- `"pr-review-toolkit plugin not available"` — if the `silent-failure-hunter` agent cannot be invoked

**Procedure**:

1. Get changed source files: `git diff main...HEAD --name-only --diff-filter=d` filtered to `*.py`, `*.js`, `*.ts`
2. If no source files in the diff: **SKIP** `"No source files changed"`
3. Invoke `silent-failure-hunter` agent against the changed files. If agent is not available: **SKIP** `"pr-review-toolkit plugin not available"`
4. Collect findings by severity: CRITICAL, HIGH, MEDIUM

The `silent-failure-hunter` agent analyzes:

- Catch specificity (bare except/catch blocks)
- Fallback masking (errors swallowed without logging)
- Error propagation (exceptions re-raised with context)
- Logging quality (structured error messages)

**PASS/FAIL criteria**:

- **PASS** if no CRITICAL findings
- **FAIL** if any CRITICAL findings detected

HIGH and MEDIUM findings are reported as warnings but do not cause FAIL.

- [ ] Changed source files identified via `git diff main...HEAD --name-only --diff-filter=d`
- [ ] `silent-failure-hunter` agent invoked against changed files
- [ ] No CRITICAL error handling findings (PASS) or CRITICAL findings present (FAIL)
- [ ] HIGH/MEDIUM findings listed as warnings

### Built-in Fallback (when silent-failure-hunter is unavailable)

If the `silent-failure-hunter` agent cannot be invoked (plugin unavailable), run the built-in fallback pattern scan on each changed source file instead of skipping:

For each `.py`, `.js`, or `.ts` file in the diff:

- Grep for **silent-swallow**: `except.*pass` with no log statement following — catches exceptions silently discarded
- Grep for **error-mask-none**: `except.*return None` or `except.*= None` without logging — masks errors with None return
- Grep for **error-mask-false**: `except.*return False` without logging — masks errors with False return
- Grep for **bare-except**: `except:` (no exception type specified) — catches all exceptions including SystemExit
- Grep for **broad-except**: `except Exception:` or `except BaseException:` without re-raise or structured logging

**Reporting**:

- Each pattern match is reported as a MEDIUM finding (not CRITICAL)
- If any pattern found: append WARNING `"Built-in fallback detected [N] potential silent-failure patterns"`
- If no patterns found: PASS `"Built-in fallback scan: clean"`
- This fallback does NOT produce FAIL results — it is advisory only

## Section 10: GitHub Protocol

Validate branch naming, commit format, issue linkage, and PR readiness. Read `github` config from `workflow.json`.

**SKIP conditions**: If `github` section is absent from `workflow.json`: SKIP `"No GitHub protocol configured"`.

**Checks**:

1. **Branch name convention**: Current branch must match `ralph/<issue>-<slug>` or `ralph/<slug>` pattern. WARN if it doesn't match.
2. **Conventional commits**: Run `git log main..HEAD --format=%s`. Each subject must match `^(feat|fix|docs|chore|refactor|test|perf|ci|build|style|revert)(\([^)]+\))?: .+`. FAIL if any non-merge commit subject is non-conventional.
3. **Issue ref present**: If `github.require_issue_ref` is `true`, check `ralph.issue_ref` in workflow state. FAIL if empty.
4. **PR exists**: If sprint is complete (all stories passed or skipped), check `ralph.pull_request_number > 0` or run `gh pr list --head [branch] --json number`. WARN if no PR found.
5. **PR sections**: If PR exists, run `gh pr view [number] --json body` and verify all `github.required_pr_sections` appear as `## ` headers. WARN for missing sections.
6. **Reviewers/labels**: If PR exists and `github.default_reviewers` or `github.default_labels` are configured, verify they were applied via `gh pr view [number] --json reviewRequests,labels`. WARN if missing.

**PASS/FAIL**: FAIL if checks 2 or 3 fail. WARN for checks 1, 4, 5, 6. Overall PASS if no FAIL.

## Output Format

```
## Audit Report — [date]

### Summary: [X]/10 sections PASS — Overall: [PASS/FAIL]

### Section 1: PLAN.md Completeness — [PASS/FAIL/SKIP]
[Per-check results with evidence]

### Section 2: prd.json Alignment — [PASS/FAIL/SKIP]
[Per-check results]

... [Sections 3-9] ...

### Critical Issues (must fix)
- [List of FAIL items across all sections]

### Warnings (should fix)
- [List of WARNING items]

### Clean Items
- [List of PASS items confirming workflow integrity]
```
