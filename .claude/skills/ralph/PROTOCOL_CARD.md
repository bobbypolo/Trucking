# Ralph Protocol Card (condensed state machine)

## Loop: STEP 2->3->4->5->loop | all passed->STEP 6

| Step     | current_step         | Action                                               | Key Decision                             |
| -------- | -------------------- | ---------------------------------------------------- | ---------------------------------------- |
| STEP 1   | (init)               | Validate prd.json, init state, plan-PRD sync         | Schema error? -> STOP; drift? -> re-sync |
| STEP 1.5 | (branch)             | Create/resume feature branch                         | --                                       |
| STEP 2   | STEP_2_FIND_NEXT     | Find first unpassed story                            | All passed? -> STEP 6                    |
| STEP 3   | (checkpoint+plan)    | Clean-tree check, plan-PRD re-sync, plan check       | Dirty/gap/drift? -> STOP or auto-regen   |
| STEP 4   | STEP_4_DISPATCH      | Launch ralph-worker (conditional worktree/sequential) | ralph-worker returns RALPH_WORKER_RESULT   |
| STEP 5   | STEP_5_HANDLE_RESULT | Per-result atomic prd.json write + commit validation | PASS -> merge; FAIL -> retry/skip        |
| STEP 6   | (end)                | Sprint summary + PR prompt                           | --                                       |
| STEP 7   | (cleanup)            | Silent post-sprint housekeeping                      | Failures logged, never block sprint      |

## PASS Path (STEP 5)

1. ralph-worker internally validates qa_receipt: exists, 11 steps, overall=PASS, criteria match
2. ralph-worker runs diff review: 5 questions (Q1-Q5) all YES required
3. ralph-worker commits directly on feature branch (branch-inline)
4. ralph-worker runs regression gate
5. Ralph outer loop: update prd.json passed=true, log to verification-log.jsonl
6. Reset consecutive_skips=0, increment stories_passed -> STEP 2

## FAIL Path (STEP 5)

- attempt < max_attempts(4): increment attempt, store failure summary -> STEP 4 (retry)
- attempt >= max_attempts: skip story, increment consecutive_skips -> STEP 2

## Circuit Breaker

consecutive_skips >= circuit_breaker_threshold (from workflow.json ralph section, default 3) -> STOP sprint -> STEP 6

## Parallel Dispatch (parallelGroup)

When `parallel_dispatch_enabled` is true in `workflow.json`, stories with the same `parallelGroup` and all `dependsOn` satisfied dispatch simultaneously via multiple Agent tool calls in a single message. Each worker receives `isolation: "worktree"` — it implements and commits in an isolated git worktree branch.

**Merge-back**: After all parallel workers return, Ralph merges worktree branches in story-ID order using `git merge --no-ff <worktree-branch>`.

**Conflict recovery**: On merge conflict, run `git merge --abort` to restore clean state, then treat the story as FAIL with context for retry against updated HEAD.

**Cleanup**: After successful merge, run `git worktree remove <path>` to remove the worktree directory.

When `parallel_dispatch_enabled` is false, stories dispatch sequentially branch-inline as the fallback path.

## State Files

- **Read/Write**: `.claude/.workflow-state.json` (ralph section: consecutive_skips, stories_passed, stories_skipped, current_story_id, current_attempt, current_step, prior_failure_summary, checkpoint_hash)
- **Read + update passed**: `.claude/prd.json`
- **Append**: `.claude/docs/progress.md`, `verification-log.jsonl`
