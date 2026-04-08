# Claude Workflow (ADE) — User Guide

> For machine-enforced rules and standards, see `CLAUDE.md`

## Overview

A portable, opinionated workflow framework for Claude Code that provides structured planning, autonomous V-Model orchestration (Ralph v5), quality enforcement via Python hooks, and end-to-end traceability from requirements to verified production-grade code.

## Commands

| Action         | Command                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| Tests          | `python -m pytest .claude/hooks/tests/ -v`                                              |
| Lint           | `ruff check .`                                                                          |
| Format         | `ruff format .`                                                                         |
| QA Runner      | `python .claude/hooks/qa_runner.py --help`                                              |
| Test Quality   | `python .claude/hooks/test_quality.py --dir .claude/hooks/tests --prd .claude/prd.json` |
| Plan Validator | `python .claude/hooks/plan_validator.py --plan .claude/docs/PLAN.md`                    |

The `Tests` command above is for the workflow repo in `self_hosted` mode. Host-project installs route through `workflow.json.project_mode` and the host project's own `project_*` commands.

---

## Project Modes

`workflow.json` uses an explicit top-level `project_mode` contract:

- `self_hosted` means this repository is running its own ADE self-tests and workflow checks.
- `host_project` means the workflow is installed into another project and `project_*` commands must target that project, not `.claude/hooks/tests`.
- Host-project `/verify` and `/audit` must fail closed if required `project_*` commands are missing or still point at ADE self-tests.

---

## How This Workflow Works

### The Big Picture

This workflow turns Claude Code into a structured development system. Instead of ad-hoc coding, every feature goes through a disciplined pipeline:

```
You describe what you want
    -> Architect creates a phased plan (PLAN.md)
    -> Plan is decomposed into testable stories (prd.json)
    -> Ralph autonomously builds each story with TDD
    -> Every story is verified by a 12-step QA pipeline
    -> Passing work is merged to a feature branch
    -> You review and create a PR
```

### The Three Modes of Working

**1. Ralph Mode (Autonomous)** — For feature implementation. You describe what you want, Ralph builds it story by story with no intervention needed until PR creation. This is the primary workflow.

**2. Manual Mode (Role-Based)** — For fine-grained control. You invoke agents directly (`Act as Builder`, `Act as QA`) and run verification manually. Useful for debugging or one-off tasks.

---

## Step-by-Step: Building a Feature with Ralph

### Step 1: Start Your Session

```
/health          # Verify environment (git, Python, gh CLI)
# If resuming, re-read PLAN.md, ARCHITECTURE.md, HANDOFF.md, and workflow.json.project_mode
```

Check `.claude/docs/HANDOFF.md` if resuming from a prior session.

### Step 2: Plan the Feature

If the problem is still fuzzy or you want to compare approaches first, run:

```
/brainstorm [topic]
```

That writes a structured ideation note under `.claude/docs/brainstorms/` that `/plan` can reuse.

Tell Claude what you want to build:

```
Act as Architect. Plan [describe your feature]
```

Or use the slash command:

```
/plan
```

**What happens:**

1. The Architect agent reads your codebase, identifies affected files, and produces `.claude/docs/PLAN.md`
2. PLAN.md contains phased implementation with:
   - Discovery findings (existing code, patterns, constraints)
   - Per-phase changes, interface contracts, data flow, testing strategy
   - Requirements tagged with `R-PN-NN` IDs (e.g., `R-P1-01`, `R-P2-03`)
   - Blast radius assessment and risk mitigations
3. Step 7 of `/plan` auto-generates `.claude/prd.json` — structured stories with acceptance criteria, test types, and gate commands

**Review the plan before proceeding.** This is your chance to adjust scope, add requirements, or change the approach.

### Step 3: Run Ralph

```
/ralph
```

**What happens (fully autonomous):**

1. **Initialize**: Validates prd.json schema, shows story count and progress
2. **Feature branch**: Creates `ralph/[plan-name]` branch (or resumes existing one)
3. **For each story** (no user interaction):
   - Displays story details and acceptance criteria
   - Creates a safety checkpoint (requires clean working tree, stops if dirty)
   - Verifies PLAN.md covers all story criteria (stops if gaps found)
   - Dispatches a `ralph-worker` sub-agent (which implements inline on the feature branch)
   - Story agent implements with TDD: writes failing tests first, then code to pass them
   - Story agent runs full 12-step QA pipeline and fixes any failures
   - **On pass**: Commits directly to feature branch, records progress
   - **On fail**: Auto-retries (up to 4 attempts per story with failure context)
   - **On exhaustion**: Auto-skips after 4 failed attempts
   - **Circuit breaker**: Stops if 3 consecutive stories are exhausted
4. **Session end** (only user interaction): Shows sprint summary, offers PR creation

### Step 4: Review and Ship

After Ralph completes:

```
/audit           # Validate end-to-end integrity (optional but recommended)
/librarian       # Save session state, archive the plan, and preserve history
```

Ralph will prompt you to create a PR via `gh pr create` with an auto-generated summary.

---

## Step-by-Step: Manual Mode (Without Ralph)

For one-off tasks, debugging, or when you want direct control:

### Step 1: Plan

```
Act as Architect. Plan [your task]
```

### Step 2: Build (One Phase at a Time)

```
Act as Builder. Implement Phase 1
```

The Builder agent:

- Reads PLAN.md and finds the current phase
- Runs a plan sanity check (files exist, signatures match, tests specified)
- Implements with TDD: test first, then code
- Tags tests with `# Tests R-PN-NN` markers
- Runs verification commands
- Escalates if stuck (2 compile errors, 3 test failures)

### Step 3: Verify

```
/verify
```

The QA agent runs all 12 verification steps (see QA Pipeline section below).

### Step 4: Repeat

Continue with `Act as Builder. Implement Phase 2`, then `/verify`, etc.

### Step 5: Wrap Up

```
/librarian       # Save session state, archive the plan, and preserve history
```

---

## Slash Command Reference Matrix

### Core Workflow Commands

| Command         | Category    | When to Use                          | What It Does                                                                                                                                                                                                              | Requires                             |
| --------------- | ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `/brainstorm`   | Research    | Before planning a complex or ambiguous feature | Produces a structured option analysis with tradeoffs, recommendation, and build strategy saved under `.claude/docs/brainstorms/`.                                                                                       | Topic or problem statement           |
| `/ralph`        | Build       | Feature implementation               | Autonomous Plan-Build-Verify loop through all stories. Auto-retries failures, auto-skips exhausted stories, circuit breaker at 3 consecutive skips. Only prompts for PR at end.                                           | prd.json v2 (generated by /plan)     |
| `/plan`         | Plan        | Before `/ralph` or manual building   | Architect creates phased PLAN.md with R-PN-NN requirements. Step 7 auto-generates prd.json v2 stories.                                                                                                                    | Description of desired feature       |
| `/verify`       | QA          | After manual build phases            | Dispatches QA agent to run 12-step verification pipeline against current phase's acceptance criteria.                                                                                                                     | Active phase in PLAN.md              |
| `/health`       | Diagnostics | Start of session                     | Checks git status, Python version, gh CLI auth, hook wiring, required files. Reports any issues.                                                                                                                          | Nothing                              |
| `/librarian`    | Session     | End of session or after a major milestone | Archives session state, handoff notes, and completed plan context without resetting PLAN.md to placeholder text.                                                                                                         | Nothing                              |
| `/audit`        | QA          | After Ralph sprint or before PR      | 9-section end-to-end integrity audit: PLAN.md completeness, prd.json alignment, test coverage, verification logs, architecture conformance, hook chain health, git hygiene, test quality scan, error handling resilience. | Existing PLAN.md and implementation  |

### Knowledge Management Commands

| Command       | Category  | When to Use                         | What It Does                                                                                                                                                              | Requires                     |
| ------------- | --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `/librarian`  | Knowledge | After solving an unexpected problem or making a durable decision | Captures lessons, decisions, and session handoff context in `.claude/docs/`. Keeps history intact and archives completed plans instead of overwriting them. | Description of what happened |

### Command Priority Guide

**Every session**: `/health` -> (your work) -> `/librarian`

**Feature build (recommended)**: `/brainstorm` (optional) -> `/plan` -> `/ralph` -> `/audit` -> `/librarian`

**Manual build**: `/plan` -> `Act as Builder` -> `/verify` -> `/librarian`

**As needed**: `/librarian` (after surprises, decisions, or session wrap-up)

---

## Quality Enforcement Details

### Quality Utilities

Standalone scripts called by `/verify`, `/audit`, `/plan`, and Ralph:

| Utility             | What It Does                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qa_runner.py`      | Automated 12-step QA pipeline CLI. Runs lint, tests, security scan, mock audit + story coverage gate, R-marker validation, production scan. Supports `--phase-type` for adaptive QA. Outputs structured JSON. |
| `test_quality.py`   | Test quality analyzer CLI. Detects assertion-free, self-mock, mock-only tests. Validates R-PN-NN markers against prd.json. Structured JSON output.                                                            |
| `plan_validator.py` | Plan quality validator CLI. Checks measurable verbs in Done When criteria, R-PN-NN format IDs, Testing Strategy completeness, no placeholder verification commands, Test File column coverage.                |

### QA Pipeline (12 Steps)

Two execution paths exist for the QA pipeline:

- **Ralph workers** use the inline 12-step pipeline from `ralph-worker.md` (self-contained, no external reads)
- **Manual `/verify`** runs the full 12-step pipeline via `verify/SKILL.md` + `qa_runner.py`

In both cases, ALL 12 steps execute (adaptive QA via `--phase-type` may skip inapplicable steps):

| Step | Check                               | Failure Means                                                                                   |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1    | Lint (zero warnings)                | Code style violations                                                                           |
| 2    | Type check (mypy/tsc if configured) | Type errors                                                                                     |
| 3    | Unit tests (all pass)               | Logic errors                                                                                    |
| 4    | Integration tests (if applicable)   | Module interaction failures                                                                     |
| 5    | Regression check                    | Broke existing functionality                                                                    |
| 6    | Security scan                       | Hardcoded secrets, injection patterns                                                           |
| 7    | Clean diff                          | Debug prints, TODOs, commented-out code                                                         |
| 8    | Coverage report                     | Uncovered new code paths                                                                        |
| 9    | Mock audit + story coverage gate    | Self-mocking, no assertions, story file coverage < 80%, weak assertions, missing negative tests |
| 10   | Plan Conformance Check (automated)  | Blast radius, R-markers, or plan deviation issues                                               |
| 11   | Acceptance test validation          | R-PN-NN criteria not covered by passing tests                                                   |
| 12   | Production-grade code scan          | ANY violation = FAIL (see standards in CLAUDE.md)                                               |

### Gate Tiers

The QA pipeline supports three execution tiers. Agents select the appropriate tier based on context:

| Tier | Invocation | Approx. Time | Use Case |
| ---- | ---------- | ------------ | -------- |
| 1 | Targeted gate cmd (e.g., `pytest -k story_test --tb=short`) | ~8s | Fix-loop feedback: run only the story's targeted gate command to iterate quickly |
| 2 | `--gate-only` (story-classified steps: 1,3,5,7,10,11) | ~30s | Standard story QA: first QA run and post-fix final confirmation |
| 3 | Full pipeline (all 12 steps, no flags) | ~300s | Sprint-end regression and `/verify` invocations |

**Ralph story agent execution order**: Tier 2 (first QA run) -> Tier 1 (each fix iteration) -> Tier 2 (final confirmation before PASS).

### Emergency QA Path (Mid-Sprint Manual Bypass)

When a story's QA pipeline cannot run automatically (e.g., a hash-mismatch prevents receipt generation, or a mid-sprint plan replacement invalidates prior log entries), use one of the two fallback paths below. In `host_project` mode, the test directory must be the host project's tests, not `.claude/hooks/tests`.

**Option A — Retrospective standalone QA** (preferred when code is accessible):

```bash
python .claude/hooks/qa_runner.py --story STORY-NNN --prd .claude/prd.json     --plan .claude/docs/PLAN.md --test-dir [project test dir]
```

If exit 0: a receipt is written to `.claude/runtime/receipts/` and a verification log entry is appended automatically with the current `plan_hash`. `/audit` Section 4 will recognise the entry as a valid PASS.

**Option B — Manual injection fallback** (when Option A is not viable):

```bash
# Step 1: Inject a manual verification entry
python .claude/hooks/qa_runner.py --story STORY-NNN --inject-verification     --result PASS --note "Manually verified: [criteria confirmed against code]"

# Step 2 (if PLAN.md was replaced mid-sprint): create hash-continuity sentinel
python .claude/hooks/qa_runner.py --story BASELINE --log-plan-replacement     --old-hash <previous-plan-hash> --new-hash <current-plan-hash>     --reason "Plan replaced: <brief description>"
```

The `--inject-verification` flag writes an entry with `"injected": true` to the verification log. `/audit` Section 4 will emit a WARNING (not FAIL) for each injected entry and count them in the summary.

The `--log-plan-replacement` flag appends a `type: "plan_replacement"` sentinel entry. `/audit` Section 4 uses this sentinel to apply cross-hash coverage resolution: stories verified under the old plan hash count as covered under the new plan hash.


---

## Configuring Frontend Verification

### project_frontend_test Auto-Trigger (Step 4)

When `project_frontend_test` is configured in `workflow.json`, qa_runner.py automatically runs your frontend test command during **Step 4 (Integration Tests)** whenever changed files include frontend extensions (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`).

In `host_project` mode, `project_frontend_test` must be the host project's own frontend test command. In `self_hosted` mode, the workflow repo can use ADE self-tests as usual.

**Behavior:**

- If `project_frontend_test` starts with `"TODO"` or is empty: the frontend sub-check is **skipped** (no failure)
- If changed files contain no frontend extensions: the frontend sub-check is **skipped**
- If changed files include frontend extensions and the command is configured: the command **runs**
  - Exit 0: evidence shows "frontend tests passed"
  - Exit non-zero: Step 4 returns FAIL with evidence showing "frontend tests failed"
- Result is worst-of-both: if integration passes but frontend fails, Step 4 returns FAIL

**Configure in `workflow.json`:**

```json
"project_frontend_test": "npx vitest run"
```

Common values: `"npx vitest run"`, `"npx jest --ci"`, `"npx playwright test"`.

### Activating Custom Steps

Custom steps in `workflow.json` are disabled by default (`"enabled": false`). To activate a step, set `"enabled": true` and replace the placeholder `"cmd"` value with a real command.

**Example — enable the build-check step for a Vite project:**

```json
{
  "name": "build-check",
  "enabled": true,
  "command": "npx vite build",
  "after_step": 1,
  "severity": "fail",
  "_note": "Compile check — catches TypeScript and import errors before tests run."
}
```

**Example — enable vitest as a custom post-lint step:**

```json
{
  "name": "vitest-unit",
  "enabled": true,
  "command": "npx vitest run --reporter=verbose",
  "after_step": 1,
  "severity": "fail",
  "_note": "Runs Vitest unit suite after lint. Enabled for projects using Vite."
}
```

Custom steps support both `"command"` and `"cmd"` keys interchangeably.

### _smoke_check.py CLI Usage

`_smoke_check.py` is a standalone HTTP health checker that verifies endpoints return 2xx responses. It requires no external dependencies — only Python stdlib (`urllib.request`).

**Basic usage:**

```bash
python .claude/hooks/_smoke_check.py --endpoints /health --port 3000
```

**Full argument reference:**

```bash
python .claude/hooks/_smoke_check.py \
  --endpoints /health /api/status \
  --port 3000 \
  --host 127.0.0.1 \
  --timeout 5
```

| Argument | Default | Description |
| --- | --- | --- |
| `--endpoints` | (required) | One or more URL paths to check (e.g., `/health`, `/api/ping`) |
| `--port` | `3000` | Port the dev server is listening on |
| `--host` | `127.0.0.1` | Hostname or IP of the dev server |
| `--timeout` | `5` | Seconds before a request times out |

**Exit codes:**

- `0` — All endpoints returned 2xx
- `1` — Any endpoint returned non-2xx, connection was refused, or timed out
- `2` — Invalid arguments (printed by argparse)

**Using with the smoke-test custom step:** Set `"enabled": true` in the `smoke-test` entry in `workflow.json`. The step runs after Step 3 (unit tests) and reports as a warning by default (`"severity": "warn"`) so it does not block story promotion.

### Promotion Gate Behavior

Frontend verification failures follow the severity configured in `workflow.json`:

```json
"ralph": {
  "frontend_verification": "warn"
}
```

- `"warn"` (default): Browser verification failures are logged but do not block promotion.
- `"fail"`: Browser verification failures block promotion and require manual resolution.

---

## Ralph v5 — Detailed Behavior

### Autonomous Loop

Ralph v5 runs without user intervention between stories:

```
STEP 1:   Validate prd.json v2 schema, initialize sprint state file
STEP 1.5: Create/resume feature branch (ralph/[plan-name])
STEP 2:   Find next story (first with passed: false). Re-read sprint state from file.
STEP 3:   Safety checkpoint (clean-tree check, record HEAD hash) + plan check
STEP 4:   Dispatch ralph-worker agent (implements inline on feature branch: TDD, QA, commit)
           ralph-worker returns RALPH_STORY_RESULT
STEP 5:   Handle result:
           - PASS -> update prd.json, record progress, loop to STEP 2
           - FAIL -> auto-retry (up to 4 attempts) with failure context
           - EXHAUSTED -> auto-skip, increment circuit breaker counter
           - CIRCUIT BREAKER -> stop if 3 consecutive stories exhausted
STEP 6:   Sprint summary + PR creation prompt (only user interaction)
```

### Ralph Story Agent (Sub-Agent)

Each story is handled by a `ralph-worker` agent — a dedicated sub-agent that:

- Works on the Ralph feature branch. **Branch-inline is synchronous-only**; only `isolation: "worktree"` workers may run in parallel/async
- Is **self-contained** — checkpoint verification, implementation, TDD, 12-step QA, and commit all happen in one agent
- **Ignores escalation thresholds** — persists until criteria pass or maxTurns (200)
- Runs TDD: failing test first (`# Tests R-PN-NN`), then implementation
- Runs full 12-step QA pipeline (with adaptive `--phase-type` support)
- **Fix loop**: If QA fails, fixes violations and re-verifies (does NOT just report)
- Uses `memory: user` — lessons persist at `~/.claude/agent-memory/ralph-worker/` across sessions
- Inherits all hooks from `settings.json` (no hooks in frontmatter — avoids double-firing)

### Sprint State Persistence

All workflow state is persisted to `.claude/.workflow-state.json` (survives context compaction). See `ralph/SKILL.md` for schema details and field descriptions.

### Traceability Chain

Every requirement is tracked end-to-end: PLAN.md requirement -> prd.json story -> test file R-marker -> verification log. See `.claude/docs/knowledge/conventions.md` for the full traceability diagram and naming conventions.

---

## Recovery

- **Rewind session**: `Esc Esc` or `/rewind`
- **Check errors**: Read `.claude/errors/last_error.json`
- **Restore selected files**: `git restore --worktree --staged <files>`
- **Save work before retry**: `git stash push -u -m "recovery"`
- **Reset only what you intend**: avoid wiping the whole worktree; restore the specific files you want to discard

## Repo Structure

For the complete directory tree and file descriptions, see `.claude/docs/ARCHITECTURE.md`. Key entry points: `CLAUDE.md` (machine rules), `WORKFLOW.md` (this file), `.claude/` (all workflow files).

## Deployment

### New Project

```powershell
.claude/scripts/new-ade.ps1 "C:\Path\To\NewProject"
```

### Update Existing Project

```powershell
.claude/scripts/update-ade.ps1 "C:\Path\To\ExistingProject"
```

Updates workflow infrastructure (agents, skills, hooks, rules, scripts, settings, templates) without touching project-specific docs (PLAN.md, HANDOFF.md, ARCHITECTURE.md, prd.json, lessons.md).
