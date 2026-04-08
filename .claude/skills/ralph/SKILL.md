---
name: ralph
description: Run autonomous V-Model orchestrator v5 — dispatches per-story ralph-worker agents, auto-retries failures (up to 4 attempts per story), auto-skips on exhaustion, circuit breaker stops after N consecutive exhausted stories (configurable via workflow.json ralph.circuit_breaker_threshold, default 3). Only prompts user for PR creation at session end when auto_create_pr is false.
---

# Ralph - V-Model Autonomous Orchestrator v5

You are now operating in **Ralph Mode** — a lean outer loop that dispatches one `ralph-worker` agent per story. Ralph orchestrates; ralph-worker handles all per-story protocol (checkpoint, plan check, implementation, verification, merge).

## Arguments

- Default: Normal orchestration (STEP 1-7).

## Core Rule

Delegation to `ralph-worker` via the **Agent tool** is mandatory. Ralph MUST NOT attempt to implement stories directly. Every story is dispatched to a `ralph-worker` sub-agent with `subagent_type: "ralph-worker"`. The ralph-worker agent handles Phase 0 through Phase 2 internally and returns `RALPH_WORKER_RESULT`.

## STEP 1: Initialize

Display: `"RALPH - V-Model Orchestrator v5 — Mode: Autonomous"`

Read `.claude/prd.json` and validate:

1. Check `version` field exists and equals `"2.0"`. If not: display deprecation warning and **STOP**.
2. Validate each story has: `id`, `description`, `phase`, `acceptanceCriteria` (array), `gateCmds` (object), `passed` (boolean), `verificationRef`. If any missing: display errors and **STOP**.
3. **Plan-PRD drift detection**: Run `check_plan_prd_sync()` from `_qa_lib.py` on `.claude/docs/PLAN.md` and `.claude/prd.json`:
   - If `added` or `removed` non-empty: display drift details, then auto-regenerate via `python .claude/hooks/prd_generator.py --plan .claude/docs/PLAN.md --merge .claude/prd.json --output .claude/prd.json`. Display `"Plan-PRD drift detected — auto-regenerated prd.json with --merge (passed state preserved)."`. Continue.
   - Compare `plan_hash` from sync result against `prd.json["plan_hash"]`. If mismatch: re-run `prd_generator.py --plan .claude/docs/PLAN.md --merge .claude/prd.json --output .claude/prd.json` to resync. Display `"Plan hash updated."`. Continue.
   - If in sync: display `"Plan-PRD sync: OK"` and `"Plan hash: OK"`.
4. Display: `"Found [total] stories, [passed] completed, [remaining] remaining"`
5. Initialize sprint state via `update_workflow_state(ralph={...})` from `_lib.py`. Fields: `consecutive_skips: 0`, `stories_passed: 0`, `stories_skipped: 0`, `feature_branch: ""`, `current_story_id: ""`, `current_attempt: 1`, `max_attempts: 4`, `prior_failure_summary: ""`, `checkpoint_hash: ""`, `cumulative_drift_warnings: 0`.

Startup worktree sweep:

1. `git worktree prune`
2. `git worktree list --porcelain` — for any path matching `.claude/worktrees/agent-*`: `git worktree remove --force [path]`
3. **Baseline QA capture** (mandatory): Run `python .claude/hooks/qa_runner.py --story BASELINE --baseline-capture --steps 2,4,6,8,9,12`. The `--steps 2,4,6,8,9,12` flag limits the baseline to environment steps only (type check, integration, security scan, coverage, mock audit, production scan) — story steps (lint, unit, regression, clean diff, plan conformance, acceptance tests) are not pre-existing failures and should not be baselined. On failure: retry once, then fallback to `echo '{"steps":[],"story_result":"PASS","overall_result":"PASS"}' > .claude/runtime/qa-baseline.json`. A baseline file MUST exist before dispatching stories (prevents pre-existing failures from blocking new work).

## STEP 1.5: Feature Branch Setup

Determine branch name: `ralph/{plan-name}` from PLAN.md title (lowercase, hyphens for spaces), or user-specified.

- **Exists**: `git checkout [branch]` — display `"Resuming branch: [branch]"`
- **New**: `git checkout -b [branch]` — display `"Created branch: [branch] (based on [current-branch])"`

Record branch in state: `update_workflow_state(ralph={"feature_branch": "[branch]"})`.

Ensure prd.json and PLAN.md are on the feature branch: `git add .claude/prd.json .claude/docs/PLAN.md && git diff --cached --quiet || git commit -m "chore: sync prd.json and PLAN.md to feature branch"`.

All story commits go to THIS branch. **NEVER commit directly to main or master.**

## STEP 2: Find Next Story

Update step: `update_workflow_state(ralph={"current_step": "STEP_2_FIND_NEXT"})`.

Re-read sprint state from `.claude/.workflow-state.json` (survives context compaction).

**Mandatory STATE SYNC display:**

```
STATE SYNC: story=[current_story_id] attempt=[current_attempt] skips=[consecutive_skips]
```

From `prd.json`, find the **first story** where `"passed": false`.

- If ALL stories have `"passed": true`: proceed to **STEP 6**.
- If a story is found: continue to STEP 3.

**Phase-boundary note**: Phase transitions are logged for awareness but do NOT trigger a separate regression run. The sprint-end full regression (STEP 6) is the definitive regression check. Story-level regression is handled by qa_runner Step 5.

## STEP 3: Safety Checkpoint + Plan Check

Display story ID, phase, description, acceptance criteria, and gate commands.

Update state: `update_workflow_state(ralph={"current_story_id": "[story.id]", "current_attempt": 1, "max_attempts": 4, "prior_failure_summary": ""})`.

1. Verify working tree is clean: `git status --porcelain`. If dirty: display warning and **STOP**.
2. Record full hash: `git rev-parse HEAD` (NOT `--short`).
3. Display: `"Checkpoint: [short-hash] ([branch-name]) — full: [full-hash]"`
4. Store hash: `update_workflow_state(ralph={"checkpoint_hash": "[full_hash]"})`.
5. Read `.claude/docs/PLAN.md` — extract all R-PN-NN IDs from Done When sections. Compare against story's `acceptanceCriteria` IDs:
   - If ALL found in PLAN.md: display `"Plan check: OK"` and continue.
   - If ANY missing: display `"Plan gap: criteria [missing IDs] not covered by PLAN.md. Run /plan to update, then resume /ralph."` and **STOP**.
6. **Plan-PRD re-sync**: Run `check_plan_prd_sync()` from `_qa_lib.py` on `.claude/docs/PLAN.md` and `.claude/prd.json`. If `added` or `removed` non-empty OR plan_hash mismatch with prd.json: auto-regenerate via `python .claude/hooks/prd_generator.py --plan .claude/docs/PLAN.md --merge .claude/prd.json --output .claude/prd.json`. Display `"Plan-PRD re-sync: updated"`. If in sync: display `"Plan-PRD re-sync: OK"`.
7. **Cumulative drift gate**: Read `cumulative_drift_warnings` from sprint state. Read `cumulative_drift_threshold` from `workflow.json` `ralph` section (default: 10). If `cumulative_drift_warnings >= cumulative_drift_threshold`: display `"CUMULATIVE DRIFT THRESHOLD EXCEEDED: [count] warnings (threshold: [threshold]). Stopping sprint — review accumulated drift before continuing."` and go to STEP 6.

## STEP 4: Dispatch ralph-worker Agent

Update step: `update_workflow_state(ralph={"current_step": "STEP_4_DISPATCH"})`.

Read `.claude/docs/progress.md` if it exists. Read sprint state for `current_attempt`, `prior_failure_summary`, `feature_branch`, `checkpoint_hash`.

**Dependency check (dependsOn):** Check each story's `dependsOn` list. If any dependency lacks `passed: true`, defer to next loop. Call `validate_dependency_receipt(dep_story_id)` for each; if `valid: False`: display reason and go to STEP 6.

**Conditional dispatch:** Read `parallel_dispatch_enabled` from `workflow.json` (default: `true`). If `true` AND a `parallelGroup` has multiple ready stories: dispatch each with `isolation: "worktree"` via multiple Agent calls; wait for all (max `parallel_batch_size`, default 3). If `false`: sequential branch-inline. Stories with no group dispatch sequentially. **Hard rule:** branch-inline dispatch is synchronous-only. NEVER leave a branch-inline worker running async while Ralph continues or idles; only `isolation: "worktree"` workers may run in parallel/async.

Launch **`ralph-worker`** agent via Agent tool with `subagent_type: "ralph-worker"`:

```
RALPH_WORKER_DISPATCH:
{
  "story_id": "[story.id]",
  "phase": [story.phase],
  "phase_type": "[story.phase_type or null]",
  "description": "[story.description]",
  "acceptanceCriteria": [/* array of {id, criterion, testType} */],
  "gateCmds": { "unit": "...", "integration": "...", "lint": "..." },
  "checkpoint_hash": "[full_hash from state]",
  "feature_branch": "[feature_branch from state]",
  "attempt": [current_attempt],
  "max_attempts": 4,
  "prior_failure_summary": "[prior_failure_summary or First attempt — no prior failures]  (may contain enriched fix-log content from prior attempts)",
  "sprint_progress": "[relevant lines from progress.md or First story in sprint]",
  "scope": [story.scope],
  "component": "[story.component]",
  "dependsOn": [story.dependsOn],
  "maxTurns": [story.maxTurns],
  "parallelGroup": [story.parallelGroup or null],
  "allowed_write_paths": [/* exact paths the worker may edit */],
  "required_test_paths": [/* exact test files or test suites the worker must run */],
  "read_only_context": [/* reference-only files */],
  "forbidden_paths": [/* paths the worker must not touch */],
  "complexity": "[story.complexity]"
}
```

Receive result(s) from ralph-worker agent(s). For parallel groups, collect all results before proceeding to STEP 5.

## STEP 5: Handle RALPH_WORKER_RESULT

Update step: `update_workflow_state(ralph={"current_step": "STEP_5_HANDLE_RESULT"})`.

Parse result(s) with graceful error handling — look for `RALPH_WORKER_RESULT:` in each agent output and extract JSON. If missing or malformed for any dispatched story, treat that story as FAIL with summary `"Missing or malformed RALPH_WORKER_RESULT from ralph-worker agent."`. Other parallel stories' results are still processed.

**Per-result atomic writes:** After processing each `RALPH_WORKER_RESULT`, immediately perform an atomic prd.json write (temp file + `os.replace`) for that story's `passed: true` update. This ensures crash-safe state — if Ralph crashes mid-batch, all previously processed stories retain their passed status. Process results in story-ID order (ascending).

**Commit validation:** Before clearing `checkpoint_hash`, run `git log [checkpoint_hash]..HEAD --oneline` to verify commits exist between the checkpoint and HEAD. If output is empty (no commits): treat as FAIL with summary `"no commits between checkpoint and HEAD."` and do not clear the checkpoint. Otherwise, clear checkpoint: `update_workflow_state(ralph={"checkpoint_hash": ""})`.

**Worktree merge-back:** When result includes `worktree_branch`, merge via `git merge --no-ff <worktree-branch>` in story-ID order. On conflict: `git merge --abort`, treat as FAIL with `passed: false` and summary `"Merge conflict: [files]"`. After successful merge: `git worktree remove <path>`.

### If PASSED (`result.passed == true`):

1. Read `drift_threshold` from `workflow.json` `ralph.drift_threshold` (default: 3) and `frontend_gate_severity` from `ralph.frontend_verification` (default: `"warn"`) via `load_workflow_config()`.
2. Dispatch `qa-reviewer` explicitly with `receipt_path`, `checkpoint_hash`, `feature_branch`, and `acceptanceCriteria`; parse the returned `REVIEWER_RESULT` block into `reviewer_result`, then call `validate_story_promotion(receipt_path, reviewer_result, drift_threshold=drift_threshold, frontend_verified=result.get("frontend_verified"), frontend_gate_severity=frontend_gate_severity)` from `_qa_lib.py`. If parsing fails or the call returns `(False, reason)`: treat as FAIL with summary `"Promotion gate blocked: [reason]"`. On success, read `receipt_drift_count` from the `PromotionDecision`.
3. **Update cumulative drift**: Add `receipt_drift_count` to current `cumulative_drift_warnings` in sprint state: `update_workflow_state(ralph={"cumulative_drift_warnings": current + receipt_drift_count})`. Read `cumulative_drift_threshold` from `workflow.json` `ralph` section (default: 10). Display `"Cumulative drift: [new_total] / [threshold]"`.
4. Append verification log entry: compute `plan_hash` via `compute_plan_hash()` from `_qa_lib.py`, then call `append_verification_entry()` with: `story_id`, `timestamp` (ISO 8601 now), `attempt`, `overall_result` ("PASS"), `criteria_verified` (from qa_receipt), `files_changed` (from result), `plan_hash`, `production_violations` (from qa_receipt), `receipt_hash` (from qa_receipt).
5. Update prd.json: set `passed: true`, `verificationRef: "verification-log.jsonl"` for this story.
6. Update state: set `consecutive_skips` to 0, increment `stories_passed`.
7. Display: `"PASSED: [story.id] — Files: [files_changed] — Progress: [stories_passed]/[total]"`
8. Append to `.claude/docs/progress.md`: `### [story.id] — PASS ([date])` with files, criteria count, summary.
9. Auto-continue to STEP 2.

### If FAILED (`result.passed == false`):

Read state for `current_attempt` and `max_attempts`.

**If attempts remaining** (`current_attempt < max_attempts`):

- Increment `current_attempt` in state, store failure summary as `prior_failure_summary` (cap at 2000 chars; truncate from beginning with `[truncated]` if exceeded).
- **Enrich with fix-log**: If `.claude/runtime/fix-log/{story_id}.md` exists, append the last 3 iteration entries (cap at ~1000 chars) under `--- Fix-Log (last 3 iterations) ---` header. If file absent/unreadable: degrade gracefully — use `result.summary` without modification.
- Display: `"FAILED: [story.id] (attempt [current_attempt]/[max_attempts]) — [summary]. Auto-retrying..."`
- Go back to **STEP 4**.

**If exhausted** (`current_attempt >= max_attempts`):

- Auto-skip: increment `stories_skipped` and `consecutive_skips` in state.
- Display: `"EXHAUSTED: [story.id] after [max_attempts] attempts — [summary]. Skipping."`
- Append to `.claude/docs/progress.md`: `### [story.id] — SKIPPED ([date])` with attempts and last failure.

**Circuit breaker**: Read `circuit_breaker_threshold` from workflow.json `ralph` section (default: 3). If `consecutive_skips` >= `circuit_breaker_threshold`: display `"CIRCUIT BREAKER: [threshold] consecutive stories exhausted. Stopping sprint."` and go to **STEP 6**.

Continue to **STEP 2**.

## STEP 6: End of Session

Display: `"RALPH SESSION COMPLETE — Progress: [stories_passed]/[total] ([stories_skipped] skipped) — Branch: [feature_branch]"`

If any stories were skipped, list each with failure summary and attempt count.

**Sprint-end regression gate**: Before PR creation, run the full regression tier:

1. Read `regression_tiers.full.cmd` from `workflow.json` (via `load_workflow_config()`).
2. If found: run the command. If it fails: display `"Sprint-end full regression FAILED — fix before creating PR."` and skip PR creation.
3. If not found: skip (no tiers configured).

### STEP 7: Post-Sprint Cleanup (silent, non-blocking)

`_lib.py` calls — failures logged silently, never block sprint or PR: `prune_worktrees()`, `prune_receipts(receipts_dir, story_ids)`, `rotate_log(verification_log, 500)`, `rotate_log(audit_log, 500)`, `rotate_log(error_history, 100)`.

Also call `strip_orphan_markers(Path(".claude/hooks/tests"), Path(".claude/prd.json"))` from `_lib`; log results; non-blocking. If markers removed, run `pytest --collect-only -q` to verify no corruption.

If ANY stories passed:

Read `auto_create_pr` from `workflow.json` `ralph` section (default: `false`). If `true` AND sprint-end regression passed: auto-push + `gh pr create` without prompting. If `false`: ask user `"Create Pull Request? (Yes / No)"` and push + create on Yes.

Run `/librarian handoff` to save session context. **Archive PLAN.md**: copy `.claude/docs/PLAN.md` to `.claude/docs/PLAN-archive-YYYY-MM-DD.md` and keep the active plan intact rather than overwriting it with placeholder text. **Clear sprint state**: `update_workflow_state(ralph={"current_step": "", "current_story_id": "", "feature_branch": "", "checkpoint_hash": "", "consecutive_skips": 0, "stories_passed": 0, "stories_skipped": 0, "current_attempt": 1, "max_attempts": 4, "prior_failure_summary": "", "cumulative_drift_warnings": 0})`. Display next steps: review PR, run `/audit`, run `/health`.

## Error Recovery

- **prd.json error**: Run `/plan` to regenerate. **Git dirty**: STOP, commit first. **Missing result**: FAIL + retry. **Plan gap**: `/plan` then retry. **Circuit breaker**: Re-read state at STEP 2.
