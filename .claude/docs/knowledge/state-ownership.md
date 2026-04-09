# State Ownership Contract

This document is the canonical reference for which layer owns which mutable state
file, what mutation rules applies, and how each field behaves under context-budget
degradation. The runtime chain is Ralph (orchestrator) -> ralph-worker (story agent).
Framing this chain as a **runtime reliability concern** -- not an API support concern
-- is deliberate: the primary failure modes are context-budget exhaustion, state
handoff fidelity loss, and audit gaps, not interface mismatches.

See also: `.claude/hooks/_lib.py` `DEFAULT_WORKFLOW_STATE` for the authoritative
Python defaults; `.claude/docs/ARCHITECTURE.md` Data Flow section for the owner
layer table.

---

## State Files and Owners

| File | Owner Layer | Mutation Rules |
| ---- | ----------- | -------------- |
| `.claude/.workflow-state.json` | Hooks + Ralph orchestrator | Hooks write `needs_verify` and `stop_block_count` via `write_marker` / `clear_marker`. Ralph orchestrator writes the `ralph` subsection (story progress, checkpoint hash, current step). ralph-worker NEVER writes this file directly. Atomic writes via `write_atomic()` with retry on `PermissionError`. |
| `.claude/prd.json` | Ralph orchestrator (outer loop only) | Ralph marks `passed: true` per story after a verified merge. ralph-worker reads it but never writes it. |
| `.claude/docs/verification-log.jsonl` | Ralph orchestrator | Appended once per story attempt (PASS or FAIL) by the outer loop after receiving RALPH_WORKER_RESULT. Append-only; never truncated by workflow code. |
| `.claude/docs/progress.md` | Ralph orchestrator | Appended after each story result. Gitignored -- not present in worktrees. ralph-worker receives progress context embedded in the dispatch prompt. |
| `.claude/receipts/` (QA receipts) | ralph-worker agent | Written by `qa_runner.py` during story verification. One receipt per story attempt. ralph-worker returns the receipt object in `RALPH_WORKER_RESULT`; Ralph outer loop writes it to disk. |
| `.claude/hooks/_lib.py` `DEFAULT_WORKFLOW_STATE` | Source -- hooks team | Defines schema defaults. Changing this dict changes what `read_workflow_state()` returns for missing keys. Any new field must be added here and documented in this file. |
| `.claude/runtime/fix-log/{story_id}.md` | ralph-worker agent | Append-only during fix loop iterations within a story attempt. Each iteration appends a structured entry (failing steps, changes made, files touched, outcome). Deleted on successful QA pass (cleanup). Created with `mkdir -p` on first write. File is gitignored under `.claude/runtime/`. Non-fatal if read/write fails (degrades to status quo). |

### Fields Within `.workflow-state.json`

| Field | Owner | Mutation Event |
| ----- | ----- | -------------- |
| `needs_verify` | `post_format.py` hook (set), `post_bash_capture.py` hook (clear) | Set when a code file is edited; cleared when tests pass. |
| `stop_block_count` | `stop_verify_gate.py` hook | Incremented each time Stop is blocked; reset to 0 when marker is cleared. |
| `ralph.consecutive_skips` | Ralph orchestrator | Incremented on story skip; reset to 0 on story pass. |
| `ralph.stories_passed` | Ralph orchestrator | Incremented after successful story merge. |
| `ralph.stories_skipped` | Ralph orchestrator | Incremented after max_attempts exhausted. |
| `ralph.feature_branch` | Ralph orchestrator (STEP 1.5) | Set once at sprint start; never changed mid-sprint. |
| `ralph.current_story_id` | Ralph orchestrator (STEP 2-3) | Updated before each story dispatch. |
| `ralph.current_attempt` | Ralph orchestrator (STEP 4) | Incremented on each dispatch; reset to 0 at story start. |
| `ralph.max_attempts` | Ralph orchestrator (STEP 1) | Set from prd.json at sprint start; not mutated after. |
| `ralph.prior_failure_summary` | Ralph orchestrator (STEP 5) | Written after a FAIL result; cleared after a PASS. |
| `ralph.current_step` | Ralph orchestrator | Tracks orchestrator position (e.g., "STEP 4") for compaction recovery. |
| `ralph.checkpoint_hash` | Ralph orchestrator (STEP 4 pre-dispatch) | Full git hash written before story dispatch; used for `git reset --hard` on merge conflict. |
| `ralph.current_story_updated_at` | `update_workflow_state()` (auto-managed) | ISO-8601 UTC timestamp; refreshed automatically on **every** ralph-section write while `current_story_id` is non-empty (story start, progress writes for `current_step` / `checkpoint_hash` / `cumulative_drift_warnings`). Forced to `""` when `current_story_id` is empty or cleared by `_sanitize_workflow_state()`. Read-only advisory consumer: the canonical-root concurrency guard's story-activity TTL filter (Phase 2 of parallel-ralph support). The timestamp tracks story **liveness across all ralph writes**, not just story-start writes — this is the load-bearing semantic. Caller-supplied timestamps in the same payload always win, allowing tests to inject deterministic values. |

---

## Parallel Dispatch and Worktree Workers

When `parallel_dispatch_enabled` is true in `workflow.json`, multiple ralph-worker agents
run concurrently, each in an isolated git worktree. The following invariants apply:

**Constraint — worktree workers do not write `.workflow-state.json`**: Each worktree worker operates
in isolation. The `is_worktree_path()` guard in `_lib.py` prevents any hook from writing
to `.workflow-state.json` when running inside a `.claude/worktrees/` path. Worktree workers
are read-only consumers of workflow state, identical to branch-inline workers.

**Merge-back is single-writer**: After all parallel workers return RALPH_WORKER_RESULT,
the Ralph outer loop (single writer) merges worktree branches in story-ID order. This
preserves the single-writer invariant for the feature branch during the merge phase.

**State isolation during parallel execution**: Each worktree worker gets its own git index
and working tree. Changes in one worktree do not affect another. The only shared resource
is the `verification-log.jsonl` file, which uses `_locked_append()` for safe concurrent appends.

---

## Sibling Worktree Discovery (Read-Only Advisory)

The helpers `root_kind()`, `iter_linked_human_worktrees()`, and
`read_worktree_state_summary()` in `_lib.py` classify the current working directory
and read other linked worktrees' `.claude/.workflow-state.json` files to compute
advisory concurrency signals for session-start messaging, `/health` checks, and the
`/ralph` canonical-root guard. **Sibling linked worktree discovery is read-only
advisory state, not a new mutable authority source.** Specifically:

- No hook, skill, or helper writes to another worktree's `.workflow-state.json`.
- Discovery is fail-open: missing, unreadable, empty, or malformed sibling state
  files are skipped silently. Discovery failures never raise, never block, and
  never emit warnings beyond the calling surface's own advisory output.
- The single-writer invariants below remain unchanged — each worktree is still the
  sole writer of its own `.workflow-state.json`, and `is_worktree_path()` remains
  the canonical detector for Ralph worker worktrees under `.claude/worktrees/agent-*`.

---

## Single-Writer Invariants

1. **One writer per field**: Each field in `.workflow-state.json` has exactly one
   owner layer. No two agents write the same field. Violations cause race conditions
   and silent state corruption.

2. **Hooks write lifecycle flags**: `needs_verify` and `stop_block_count` belong to
   the hook layer exclusively. Ralph orchestrator reads but never writes them.

3. **Ralph orchestrator owns the `ralph` subsection**: Only the outer Ralph loop
   (`ralph` SKILL.md) writes the `ralph` dict. ralph-worker is a consumer, not
   a writer, of this section.

4. **Ralph orchestrator appends verification-log.jsonl**: ralph-worker returns a
   `qa_receipt` in its result JSON. The Ralph outer loop writes the receipt and
   appends one entry to `verification-log.jsonl` after each RALPH_WORKER_RESULT.

5. **prd.json is write-once per story**: Only the Ralph outer loop marks
   `passed: true` after a verified merge. No retry path writes `passed` back to
   `false`.

6. **Atomic writes are mandatory**: All writes to `.workflow-state.json` MUST use
   `write_atomic()` or `write_workflow_state()` from `_lib.py`. Direct `open()`
   writes bypass the retry-on-PermissionError guard and the tmp-file swap, creating
   partial-write risk on Windows.

---

## Context-Budget Degradation

The Ralph -> ralph-worker chain is a **nested agent invocation**. Each layer
consumes context tokens. When context approaches the budget limit, the agent may
be compacted (context window reset). The following rules define what each layer
must re-read on recovery.

### Ralph Orchestrator (outer loop)

- On compaction: reads `.workflow-state.json` `ralph.current_step` to determine
  where to resume.
- Re-reads `prd.json` to find the next unfinished story.
- Does NOT rely on in-memory state surviving compaction. Every field it needs is
  persisted before dispatch.
- `ralph.checkpoint_hash` is written to state before dispatching ralph-worker so
  the outer loop can find it after compaction (even though the dispatch prompt
  also embeds it for ralph-worker).

### ralph-worker agent (per-story)

- Receives all required state as **pass-by-value in the dispatch prompt**
  (`checkpoint_hash`, `feature_branch`, `acceptanceCriteria`, etc.).
- Does NOT read `.workflow-state.json` for story-execution decisions. The dispatch
  prompt is the authoritative source.
- On compaction within a story run: re-reads PLAN.md and the dispatch prompt
  context. Cannot recover mid-merge -- treats partial state as FAIL.
- **Fix-log as compaction recovery mechanism**: During the inner fix loop,
  ralph-worker appends each iteration to `.claude/runtime/fix-log/{story_id}.md`.
  On compaction, the agent re-reads this file to recover what was already tried,
  avoiding redundant fix attempts. This is the primary compaction-resilience
  mechanism for the ralph-worker fix loop. The fix-log is deleted on successful
  QA pass; if the story fails, its content is embedded in the `summary` field
  of RALPH_WORKER_RESULT for inclusion in `prior_failure_summary` on retry.

### Degradation Failure Modes

| Failure Mode | Detection | Recovery |
| ------------ | --------- | -------- |
| Ralph compacted mid-sprint | `ralph.current_step` stale | Re-read state, re-derive next story from prd.json |
| ralph-worker compacted mid-story | Tests still fail | Worker re-reads criteria, re-runs TDD loop |
| State file corrupt after crash | `read_workflow_state()` returns default | Safe -- defaults allow clean restart |

---

## State Handoff Fidelity

The Ralph -> ralph-worker chain passes state in two ways.

### Pass-by-Value (embedded in dispatch prompt)

These fields are copied into the dispatch prompt text. They are authoritative at
call time and do NOT require the sub-agent to read a file:

| Field | Passed From | Passed To |
| ----- | ----------- | --------- |
| `checkpoint_hash` | Ralph outer loop | ralph-worker dispatch prompt |
| `feature_branch` | Ralph outer loop | ralph-worker dispatch prompt |
| `story_id` | prd.json | ralph-worker dispatch prompt |
| `acceptanceCriteria` | prd.json | ralph-worker dispatch prompt |
| `gateCmds` | prd.json | ralph-worker dispatch prompt |
| `attempt` | Ralph outer loop counter | ralph-worker dispatch prompt |
| `prior_failure_summary` | Ralph outer loop | ralph-worker dispatch prompt |
| `sprint_progress` | progress.md content | ralph-worker dispatch prompt |

**Critical invariant**: ralph-worker reads `checkpoint_hash` from the dispatch
prompt -- NOT from `.workflow-state.json`. The dispatch prompt is the authoritative
source because the state file may be stale if another story ran concurrently or if
the file was not flushed before dispatch.

### Pass-by-Reference (read from file by sub-agent)

These items are too large to embed in the prompt or change frequently enough that
the sub-agent must read the current version:

| Resource | Read By | File Location |
| -------- | ------- | ------------- |
| PLAN.md | ralph-worker (plan check + implementation guide) | `.claude/docs/PLAN.md` |
| prd.json | ralph-worker (criteria IDs, acceptance criteria) | `.claude/prd.json` |
| workflow.json | ralph-worker (gate commands fallback) | `.claude/workflow.json` |

### Fidelity Failure Modes

| Failure | Consequence | Mitigation |
| ------- | ----------- | ---------- |
| `checkpoint_hash` read from stale state file | `git reset --hard` to wrong commit | Always read from dispatch prompt |
| Worker result JSON malformed | Story treated as FAIL | Ralph outer loop uses fallback qa_receipt schema |
| `sprint_progress` stale (progress.md not flushed) | Worker has stale context | Non-blocking -- worker only uses it for informational context |

---

## Auditability Requirements

Each layer must produce enough output that `/audit` can reconstruct the sprint
state without reading runtime-only files.

### Ralph Orchestrator

- Writes one entry to `verification-log.jsonl` per story after receiving RALPH_WORKER_RESULT.
- Updates `prd.json` `passed` flag -- audit can reconstruct sprint progress from
  prd.json alone.
- Writes `ralph.current_step` to state so `/audit` can detect interrupted sprints.

### ralph-worker

- Returns `RALPH_WORKER_RESULT` JSON as the last output, containing:
  - `passed`, `summary`, `files_changed`, `attempt`, `story_id`
  - `qa_receipt` (full 12-step QA receipt from `qa_runner.py`)
  - `prod_violations_checked` flag
- The qa_receipt must contain `criteria_verified` listing all acceptance criteria
  IDs, enabling `/audit Section 4` to verify full traceability.
- Does NOT write to any persistent state file. All audit data flows through the
  Ralph outer loop.

### Audit Reconstruction Path

```
/audit Section 4
    reads verification-log.jsonl (append-only, one entry per story)
        contains story_id, passed, qa_receipt.criteria_verified
    reads prd.json (passed flags per story)
    cross-references PLAN.md R-PN-NN IDs
    -> full traceability: requirement -> story -> test -> verification
```

### Minimum Auditability Invariants

1. Every story attempt (pass or fail) produces one `verification-log.jsonl` entry.
2. Every entry contains the story acceptance criteria IDs in `criteria_verified`.
3. `prd.json` `passed` is updated atomically after a verified merge (never before).
4. QA receipts contain `overall_result` and all 12 step results.
5. No state mutation happens between the last gate command pass and the merge --
   the merge itself is the commit of record.
