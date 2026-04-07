# Architecture — LoadPilot (DisbatchMe)

## Project Overview

LoadPilot is a full-stack trucking dispatch and load management platform. The frontend is a React 19 + TypeScript SPA built with Vite. The backend is a Node.js + Express + TypeScript API server. Data is split between Firebase Firestore (real-time, auth) and MySQL (relational loads/fleet data). Google Gemini AI powers document scanning (BOL, Rate Confirmations). Google Maps handles live fleet tracking.

## System Architecture

```
Browser (React SPA)
  │
  ├── Firebase Auth          → Authentication (JWT + Firebase tokens)
  ├── Firebase Firestore     → Real-time data (messages, live tracking)
  └── Express API (server/)  → Business logic, MySQL ops, AI calls
        ├── auth.ts          → JWT middleware
        ├── db.ts            → MySQL connection pool
        ├── firestore.ts     → Firestore helpers
        └── index.ts         → Routes + server entry

External Services:
  ├── Google Gemini AI       → BOL / Rate-Con document parsing
  ├── Google Maps API        → Live fleet map + route display
  └── Azure Maps             → Weather data for route planning
```

## Frontend Components (`components/`)

| Component                  | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `App.tsx`                  | Root router, auth shell                     |
| `Dashboard.tsx`            | Main dispatcher dashboard                   |
| `LoadList.tsx` / `LoadBoardEnhanced.tsx` | Load board and management    |
| `DispatcherTimeline.tsx`   | Timeline view for dispatchers               |
| `GlobalMapView.tsx` / `GlobalMapViewEnhanced.tsx` | Live fleet map   |
| `IFTAManager.tsx`          | IFTA mileage reporting                      |
| `AccountingPortal.tsx`     | Accounting, billing, settlements            |
| `Settlements.tsx`          | Driver settlement calculations              |
| `SafetyView.tsx`           | Safety compliance and logs                  |
| `BolGenerator.tsx`         | BOL PDF generation (jsPDF)                  |
| `Scanner.tsx`              | Camera/screenshot document capture          |
| `Intelligence.tsx` / `IntelligenceHub.tsx` | AI-powered insights       |
| `CommandCenterView.tsx`    | Unified command center                      |
| `CalendarView.tsx`         | Load/driver scheduling calendar             |
| `DriverMobileHome.tsx`     | Mobile-optimized driver view                |
| `BookingPortal.tsx`        | Customer booking portal                     |
| `QuoteManager.tsx`         | Rate quoting                                |
| `Analytics Dashboard.tsx`  | Business analytics and KPIs                 |
| `FileVault.tsx`            | Document storage                            |

## Backend (`server/`)

| File            | Purpose                                      |
| --------------- | -------------------------------------------- |
| `index.ts`      | Express app entry, route definitions         |
| `auth.ts`       | JWT verification middleware                  |
| `db.ts`         | MySQL2 connection pool, query helpers        |
| `firestore.ts`  | Firebase Admin Firestore wrappers            |
| `local_db.ts`   | Local database utilities                     |
| `geoUtils.ts`   | Geographic calculations (distance, IFTA)     |

## Data Flow

### Load Lifecycle
```
Dispatcher creates load → MySQL (loads table)
  → Driver assigned → Firestore (real-time status)
  → Driver updates status → Firestore → Dashboard live update
  → Load complete → MySQL (billing, IFTA calculation)
  → Accounting generates invoice → PDF (jsPDF)
```

### Document Scanning (BOL / Rate-Con)
```
User captures image/screenshot
  → Scanner.tsx → Base64 encode
  → Express API → Google Gemini AI
  → Structured data extracted
  → Auto-populate load form fields
```

## ADE Workflow (`.claude/`)

A portable workflow framework for Claude Code that enforces structured development via 6 agents, 10 slash-command skills, Python hook-based quality gates, and a V-Model orchestrator (Ralph v5) that drives autonomous Plan-Build-Verify loops with persistent worktree-isolated sub-agents. All workflow state is unified in `.workflow-state.json`.

## System Diagram

```
User
  │
  ├── /health, /refresh, /audit        → Skills (read-only diagnostics)
  │     └── /audit Section 9 → silent-failure-hunter (error handling resilience)
  ├── /plan                     → Architect Agent → PLAN.md + prd.json v2 (smart sizing)
  ├── /build-system {slug}              → Unified pipeline (Plan→Build→Audit→Handoff)
  ├── /ralph                            → Ralph Orchestrator v5 (autonomous)
  │     ├── STEP 1: Validate prd.json v2, init sprint state
  │     ├── STEP 1.5: Feature branch (ralph/[name])
  │     ├── STEP 2-3: Find next story, checkpoint + plan check
  │     ├── STEP 4: Dispatch ralph-story (worktree-isolated)
  │     │     └── ralph-story: worker dispatch + QA + merge (returns RALPH_STORY_RESULT)
  │     ├── STEP 5: Handle result — auto-retry or auto-skip
  │     │     ├── merge --abort on conflict (clean recovery)
  │     │     └── Circuit breaker: 3 consecutive skips → stop
  │     └── STEP 6: Sprint summary + PR creation (only user prompt)
  │           └── /code-review (optional post-PR review via plugin)
  └── /verify, /learn, /handoff         → Skills (verification, knowledge, session handoff)

Hooks (always active):
  PreToolUse:Bash  → pre_bash_guard.py        (block dangerous commands)
  PostToolUse:Bash → post_bash_capture.py      (capture errors, detect tests)
  PostToolUse:Edit → post_format.py            (format code, set needs_verify in .workflow-state.json)
  PostToolUse:Edit → post_write_prod_scan.py   (scan for production violations)
  Stop             → stop_verify_gate.py       (block stop if unverified — reads .workflow-state.json)
  SessionStart     → post_compact_restore.py   (session reminder from .workflow-state.json)

Quality utilities:
  qa_runner.py      → Automated 12-step QA pipeline CLI (supports --phase-type for adaptive QA)
  test_quality.py   → Test quality analyzer (assertion, mock, strategy checks)
  plan_validator.py → Plan quality validator (verbs, R-markers, test file coverage)
```

## Components

### Agents (`.claude/agents/`)

| Agent             | Purpose              | Key Behavior                                                               |
| ----------------- | -------------------- | -------------------------------------------------------------------------- |
| `architect.md`    | Planning             | Produces PLAN.md, no code                                                  |
| `builder.md`      | Implementation       | Follows plan, TDD, selective staging                                       |
| `/verify` skill   | Verification         | 12-step pipeline via qa_runner.py incl. acceptance tests + prod-grade scan |
| `librarian.md`    | Documentation        | Updates knowledge, decisions, handoffs                                     |
| `ralph-story.md`  | Story orchestration  | Per-story agent: checkpoint, plan check, worker dispatch, QA, merge        |
| `ralph-worker.md` | Story implementation | Worktree-isolated worker: Build + QA with fix loop, persists until pass    |

### Skills (`.claude/skills/`)

| Skill          | Purpose                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `ralph`        | V-Model orchestrator v5 — autonomous Plan-Build-Verify per story                                            |
| `plan`         | Create PLAN.md + auto-generate prd.json v2                                                                  |
| `audit`        | 9-section end-to-end workflow integrity audit (incl. error handling resilience via `silent-failure-hunter`) |
| `verify`       | Run phase verification commands                                                                             |
| `health`       | Environment readiness check                                                                                 |
| `refresh`      | Re-sync context mid-session                                                                                 |
| `build-system` | Unified plan-build-audit-handoff pipeline                                                                   |
| `brainstorm`   | Structured idea generation with build strategy                                                              |
| `learn`        | Capture lessons learned                                                                                     |
| `decision`     | Record architecture decisions (ADRs)                                                                        |
| `handoff`      | Session handoff with state detection                                                                        |

### Hooks (`.claude/hooks/`)

| Hook                      | Event                  | Purpose                                                                                                                       |
| ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pre_bash_guard.py`       | PreToolUse:Bash        | Block destructive commands (rm -rf, force push, etc.)                                                                         |
| `post_format.py`          | PostToolUse:Edit/Write | Auto-format, set `needs_verify` in `.workflow-state.json`                                                                     |
| `post_bash_capture.py`    | PostToolUse:Bash       | Log errors, clear `needs_verify` in `.workflow-state.json` on successful test run                                             |
| `post_write_prod_scan.py` | PostToolUse:Edit/Write | Two-tier enforcement: security violations BLOCK (exit 2), hygiene violations WARN (exit 0). Records in `.workflow-state.json` |
| `stop_verify_gate.py`     | Stop                   | Block stop if `needs_verify` or `prod_violations` set in `.workflow-state.json`. Force-stop clears all (escape after 3)       |
| `post_compact_restore.py` | SessionStart           | Remind about workflow rules, read current state from `.workflow-state.json`                                                   |
| `_lib.py`                 | Shared                 | Common utilities (audit_log, parse_hook_stdin, quality scanning, verification log)                                            |
| `_prod_patterns.py`       | Shared                 | 43 production violation regex patterns (7 BLOCK, 6 WARN) + `scan_file_violations()`                                           |
| `_qa_lib.py`              | Shared                 | QA helpers (prd schema validation, R-marker validation, plan hash, story complexity estimation)                               |

### Quality Utilities (`.claude/hooks/`)

| Utility             | Type       | Purpose                                                                                                                                                                                         |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qa_runner.py`      | CLI script | Automated 12-step QA pipeline. All steps automated. Supports `--phase-type` for adaptive QA and `--plan` for conformance checks.                                                                |
| `test_quality.py`   | CLI script | Analyzes test files for assertion presence, self-mock patterns, mock-only assertions, R-markers.                                                                                                |
| `plan_validator.py` | CLI script | Validates PLAN.md quality: measurable verbs in Done When, R-PN-NN format IDs, Testing Strategy completeness, no placeholder verification commands, Test File column coverage in Changes tables. |

### Verification Logs (`.claude/docs/`)

| File                     | Format | Purpose                                                             |
| ------------------------ | ------ | ------------------------------------------------------------------- |
| `verification-log.jsonl` | JSONL  | Structured verification log. One JSON object per line. Append-only. |
| `verification-log.md`    | MD     | Human-readable verification summaries. Append-only. Gitignored.     |

## Data Flow

### Feature Development (Ralph)

1. User runs `/plan` → Architect produces `PLAN.md` with R-PN-NN requirements
2. `/plan` Step 7 auto-generates `prd.json` v2 from PLAN.md
3. User runs `/ralph` → validates prd.json, creates `ralph/[name]` feature branch
4. Per story: dispatches `ralph-story` sub-agent (which manages worker, QA, and merge)
5. On PASS: merges worktree branch via `git merge --no-ff` (abort on conflict → auto-retry)
6. On FAIL: auto-retry up to 4 attempts, then auto-skip. Circuit breaker at 3 consecutive skips
7. Verification results appended to `verification-log.jsonl` (structured) and `verification-log.md` (human-readable)
8. Progress appended to `.claude/docs/progress.md`, sprint state persisted to `.claude/.workflow-state.json` (ralph section)
9. At end: sprint summary + `gh pr create` (only user interaction point)

### Traceability Chain

```
PLAN.md R-PN-NN requirements
    ↓ (extracted by /plan Step 7)
prd.json v2 acceptanceCriteria[].id
    ↓ (enforced by Builder TDD)
Test files: # Tests R-PN-NN markers
    ↓ (validated by QA Step 11 / qa_runner.py)
verification-log.jsonl: structured JSONL entries per story
    ↓ (audited by /audit Section 4)
Full traceability: requirement → story → test → verification
```

### Hook Chain

```
Edit/Write code → post_format.py sets needs_verify in .workflow-state.json
    ↓           → post_write_prod_scan.py scans for violations
    ↓               ├── severity=block → exit 2 (BLOCK), records in .workflow-state.json
    ↓               └── severity=warn  → exit 0 (WARN),  records in .workflow-state.json
    ↓
Run tests → post_bash_capture.py detects test command
    ↓
Tests pass → needs_verify cleared + prod_violations cleared in .workflow-state.json
    ↓
Stop session → stop_verify_gate.py reads .workflow-state.json → allowed if all clear
    ↓  (blocked) → 3 consecutive attempts → force-stop (clears all flags)
```

## Key Design Decisions

> For detailed decision records, see `docs/decisions/`

| Decision                | Choice                                                               | Rationale                                                                          |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Worktree isolation      | Sub-agents work in git worktrees                                     | Failed work never touches feature branch                                           |
| Selective staging       | Explicit file paths, never `git add -A`                              | Prevents accidental inclusion of state files                                       |
| Hook fail-closed        | Hooks exit 2 on error (block)                                        | Safety over convenience                                                            |
| R-PN-NN convention      | `R-P{phase}-{seq:02d}` format                                        | Machine-parseable, human-readable traceability                                     |
| prd.json v2             | Structured objects, not flat strings                                 | Enables typed criteria, test linking, gate commands                                |
| Feature branches        | `ralph/[name]`, never commit to main                                 | Clean main, PR-based review                                                        |
| Autonomous loop (v5)    | No user prompts between stories                                      | Fully autonomous sprint, only PR prompt at end                                     |
| Worker persistence      | ralph-worker persists until criteria pass                            | No escalation thresholds — fix loop until pass or maxTurns                         |
| `memory: user`          | Agent memory at `~/.claude/agent-memory/`                            | `project` writes to worktree (destroyed on cleanup); `user` persists               |
| Unified state file      | `.claude/.workflow-state.json`                                       | Single file for all workflow state; survives context compaction                    |
| Merge conflict recovery | `git merge --abort` → treat as FAIL                                  | Without abort, feature branch stays in conflicted state                            |
| No hooks in worker      | Worker inherits settings.json hooks                                  | Frontmatter hooks stack (not replace), causing double-firing                       |
| Progress inline         | Orchestrator embeds progress context in prompt                       | progress.md is gitignored → not present in worktree                                |
| Two-tier enforcement    | Security=BLOCK (exit 2), hygiene=WARN (exit 0)                       | Security violations must be fixed immediately; cleanup can wait                    |
| Unified state tracking  | Single `.workflow-state.json` replaces markers                       | Atomic reads/writes, no orphan marker files, single source of truth                |
| Plan-PRD sync           | SHA-256 hash + R-marker drift detection                              | Prevents running against stale stories if plan changes                             |
| Adaptive QA             | `--phase-type` skips irrelevant QA steps                             | Foundation phases skip integration tests; e2e phases run all                       |
| /build-system pipeline  | Unified plan-build meta-command                                      | Chains full lifecycle with user approval gates                                     |
| Cherry-pick plugins     | Optional plugins (code-review, pr-review-toolkit) with graceful skip | Don't integrate plugins into inner QA loop; workflow degrades gracefully if absent |

## Product Design Rationale

> Rationale for non-obvious product shape decisions. The "why" behind what's built — extracted from the 2026-03-24 post-rework product audit before that audit doc was removed from the repo.

### Map Capability Placement

**Decision (2026-03-24):** Keep fleet-location capability, but remove the standalone `Fleet Map` destination from production nav. Treat the map as an *embedded* operational capability, not a first-class destination.

**Why:**

- A standalone Fleet Map page plus an embedded map inside Operations Center / Load Detail creates two parallel surfaces where dispatchers can watch trucks, which duplicates KPIs and confuses where live monitoring "belongs."
- The real product value is live truck location inside the workflow the dispatcher is already using (Ops Center, load detail, optional split view on load board) — not a dedicated page visited out of context.
- Tracking capability itself must remain real: live pings, provider setup, per-truck provider vehicle-ID mapping, connection health, fallback state when configured but no pings are arriving. Deletion is about *nav placement*, not the underlying feature.

**How to apply:**

- Map component (`components/GlobalMapViewEnhanced.tsx` or successors) stays — but only as an embedded widget inside Ops Center, load detail, and the load board split view. No top-level `Fleet Map` nav entry.
- `/api/tracking/live` and `/api/tracking/webhook` remain the canonical live-tracking pipeline. A real admin surface for telematics setup (provider + credentials + vehicle mapping) must exist — do not require engineering to hand-wire new providers.
- When adding a new "look at the map" entry point: ask whether the user is inside an operational workflow. If yes, embed. If no, reconsider whether the entry point should exist.

### Load Intake Model

**Decision (2026-03-24):** Support two clearly different load-creation flows, with driver-submitted intake treated as a first-class operational workflow, not a side feature.

1. **Dispatcher-created load** — dispatcher picks broker/customer + driver, then builds the load. This is the current `LoadSetupModal` path.
2. **Driver-submitted load intake** — driver arrives, uploads paperwork (BOL / rate con / scale ticket / POD), OCR drafts a load record, dispatch approves, and the load auto-appears in schedule + load board.

**Why:**

- The stakeholder expectation is that drivers do the first keystroke — they receive paperwork on the road, upload it, and the load *materializes* in the system without dispatch having to pre-stage broker/customer/driver selections.
- The old flow assumed dispatch already knew broker/customer/driver before any document-driven intake could finish. That's the inverse of how the business actually operates.
- Document-upload-for-existing-loads (current behavior) is not the same thing as driver-first intake. Having only the former means drivers can attach paperwork but cannot *originate* a load from paperwork, which breaks the primary operational motion.

**How to apply:**

- Driver app must have a `Driver Load Intake` entry point: scan/upload → OCR draft → prompt only for missing required fields → submit for dispatch review.
- OCR output lands as either a new load directly OR a `Pending Intake` record requiring dispatch approval (choose based on confidence / policy).
- After approval, the load must automatically appear in schedule + load board with no further dispatcher data entry.
- When touching load-creation code: preserve both flows. Do not regress driver-intake by assuming a pre-selected broker/driver context.

## File Organization

```
/
├── CLAUDE.md              # Machine instructions (auto-loaded)
├── WORKFLOW.md            # User guide and reference (on-demand)
├── PROJECT_BRIEF.md       # Project context
├── .mcp.json.example      # Per-project MCP server template
├── .gitignore             # Includes runtime state exclusions
└── .claude/
    ├── agents/            # 4 role-based agents (incl. ralph-worker)
    ├── rules/             # Path-specific rules (code-quality.md)
    ├── skills/            # 11 slash commands (incl. build-system)
    ├── hooks/             # 6 Python hooks + shared libs (_lib, _prod_patterns, _qa_lib) + CLI tools (qa_runner, test_quality, plan_validator)
    ├── scripts/           # Deployment (new-ade.ps1, update-ade.ps1)
    ├── templates/         # config.yaml, qa_receipt_fallback.json
    ├── errors/            # Runtime error logs (gitignored)
    ├── docs/
    │   ├── PLAN.md        # Current implementation plan
    │   ├── ARCHITECTURE.md # This file
    │   ├── HANDOFF.md     # Session state
    │   ├── knowledge/     # lessons.md, conventions.md
    │   ├── decisions/     # ADRs (000-template.md, README.md)
    │   └── brainstorms/   # Brainstorm outputs
    ├── prd.json           # Ralph stories (v2 schema)
    ├── settings.json      # Hook wiring (4 event types)
    └── workflow.json      # Test commands/patterns config
```

### What is committed vs ignored

| Committed (workflow definitions)  | Ignored (runtime state)               |
| --------------------------------- | ------------------------------------- |
| `SKILL.md`, agent `.md` files     | `.claude/.workflow-state.json`        |
| `prd.json` (schema template)      | `.claude/worktrees/`                  |
| Hook `.py` files, `_lib.py`       | `.claude/docs/verification-log.md`    |
| `qa_runner.py`, `test_quality.py` | `.claude/docs/verification-log.jsonl` |
| `PLAN.md`, `ARCHITECTURE.md`      | `.claude/docs/progress.md`            |
|                                   | `.claude/errors/`                     |

## Deployment

- **Environment**: Local CLI (Windows/macOS/Linux)
- **Distribution**: `new-ade.ps1` (new projects), `update-ade.ps1` (existing projects)
- **Repository**: github.com/bobbypolo/ClaudeWorkflow

## Enforcement Matrix

Every anti-pattern detected by the ADE maps to a specific detector, pipeline stage, and severity level.

| Anti-Pattern                                        | Detector             | Pipeline Stage                     | Severity |
| --------------------------------------------------- | -------------------- | ---------------------------------- | -------- |
| Dangerous shell commands (rm -rf, force push, etc.) | pre_bash_guard       | PreToolUse:Bash                    | BLOCK    |
| Security violations (secrets, injection)            | post_write_prod_scan | PostToolUse:Edit/Write             | BLOCK    |
| Hygiene violations (debug prints, TODOs)            | post_write_prod_scan | PostToolUse:Edit/Write             | WARN     |
| Unformatted code after edit                         | post_format          | PostToolUse:Edit/Write             | BLOCK    |
| Unverified changes at session end                   | stop_verify_gate     | Stop                               | BLOCK    |
| Self-mocking / mock-only assertions                 | mock_audit           | QA Step 9 (test quality)           | WARN     |
| Missing assertions in test functions                | assertion_check      | QA Step 9 (test quality)           | WARN     |
| Excessive mock setup (>5 mocks per test)            | heavy_mock           | QA Step 9 (test quality)           | WARN     |
| No negative/error-path tests                        | negative_test        | QA Step 9 (test quality)           | WARN     |
| Only happy-path coverage                            | happy_path_only      | QA Step 9 (test quality)           | WARN     |
| Unmeasurable Done When criteria                     | vague_criteria       | Plan validation                    | FAIL     |
| Missing R-PN-NN format IDs                          | r_id_format          | Plan validation                    | FAIL     |
| Production files without test coverage              | test_file_coverage   | Plan validation                    | FAIL     |
| Placeholder syntax in verification commands         | placeholder_commands | Plan validation                    | FAIL     |
| Hardcoded credentials in source code                | hardcoded-secret     | PostToolUse:Edit/Write (prod scan) | BLOCK    |
| String concatenation in SQL queries                 | sql-injection        | PostToolUse:Edit/Write (prod scan) | BLOCK    |
| os.system with string formatting                    | shell-injection      | PostToolUse:Edit/Write (prod scan) | BLOCK    |
| print()/console.log() in production code            | debug-print          | PostToolUse:Edit/Write (prod scan) | WARN     |
| Bare except clause                                  | bare-except          | PostToolUse:Edit/Write (prod scan) | WARN     |

## Constraints & Limitations

- Hooks require Python 3.10+ in PATH
- Ralph worktree isolation requires git 2.15+
- MCP servers support global (`~/.claude.json`) and per-project (`.mcp.json`) configuration
