# Lessons Learned

> This file captures insights from issues encountered during development.
> Use `/learn` to add new entries after resolving unexpected problems.

---

## [2026-03-02] - Auto-Stash Consumed by Worker in Shared Worktree

**Tags**: #ralph #git #worktree #safety

**Issue**: Ralph orchestrator auto-stashed the dirty working tree before dispatching a worker. The worker, running in a shared git environment, popped the stash during its operations, destroying the orchestrator's safety checkpoint.

**Root Cause**: Git stashes are global to the repository, not scoped to a worktree. Any process with access to the repo can pop or drop stashes created by another process.

**Resolution**: Replaced auto-stash with a clean-tree requirement. Ralph STEP 4 now checks `git status --porcelain` and STOPs if the tree is dirty, requiring the user to commit or stash manually before running `/ralph`.

**Prevention**: Never use `git stash` as a safety mechanism in multi-agent or worktree-isolated workflows. Require clean working tree as a precondition instead.

---

## [2026-03-02] - Context Bloat from Eager File Reads at Session Start

**Tags**: #context-window #performance #architecture

**Issue**: The Quick Start section in CLAUDE.md instructed Claude to read 5 files on first turn (PROJECT_BRIEF.md, PLAN.md, ARCHITECTURE.md, HANDOFF.md, WORKFLOW.md), consuming approximately 6,950 tokens before any user work began. Combined with the system prompt (~15,970 tokens), the total first-turn context was ~22,920 tokens.

**Root Cause**: All reference docs were loaded eagerly regardless of whether the session needed them. Most sessions only need current work state (PLAN.md) and session continuity (HANDOFF.md).

**Resolution**: Trimmed Quick Start to read only PLAN.md and HANDOFF.md on first turn. Other files (PROJECT_BRIEF.md, ARCHITECTURE.md, WORKFLOW.md) marked as "read on demand". The `/refresh` skill loads all files when explicitly needed.

**Prevention**: Classify startup reads as "essential" vs "reference". Only auto-load files that contain current work state. Use on-demand loading for reference documentation.

---

## [2026-03-01] - Hook Double-Firing with Frontmatter Hooks

**Tags**: #hooks #configuration #ralph-worker

**Issue**: When ralph-worker.md included hook definitions in its YAML frontmatter, these hooks stacked with the hooks already defined in `.claude/settings.json`. This caused hooks like `post_write_prod_scan.py` to execute twice per write operation, doubling execution time and producing duplicate output.

**Root Cause**: Claude Code merges hooks from all sources (settings.json + agent frontmatter). There is no deduplication -- if the same hook appears in both places, it runs twice.

**Resolution**: Removed all hook definitions from ralph-worker.md frontmatter. Workers now inherit hooks exclusively from `settings.json`, which is the single source of truth for hook configuration.

**Prevention**: Never define hooks in agent frontmatter if they are already configured in settings.json. Use frontmatter only for agent-specific hooks that should NOT run for other agents.

---

## [2026-03-01] - Conflicting Escalation Thresholds Across Agent Files

**Tags**: #agents #precedence #ralph

**Issue**: builder.md defined escalation at 2 compile errors or 3 test failures. ralph-worker.md said "ignore escalation thresholds." CLAUDE.md had no explicit precedence rule. This created ambiguity -- agents could not determine which rule applied when instructions from multiple files conflicted.

**Root Cause**: Three files defined overlapping behavior (build rules, escalation policy, production standards) without a clear hierarchy. The system grew incrementally and each file was written independently.

**Resolution**: Added explicit Precedence Rules section to CLAUDE.md establishing a clear hierarchy: (1) production safety always wins, (2) ralph-worker ignores builder escalation, (3) blast radius is WARN not FAIL, (4) no self-mocking, (5) workflow state file is canonical. Made ralph-worker.md self-contained with all rules inlined.

**Prevention**: When multiple agent files govern the same behavior, define explicit precedence rules in the top-level configuration file (CLAUDE.md). Each agent file should be self-contained for its mode of operation.

---

## [2026-03-01] - Refactoring Intent Misread as Defect

**Tags**: #workflow #communication #intent

**Issue**: During a cleanup sprint, Claude treated intentionally removed content (trimmed WORKFLOW.md sections, deleted research commands) as defects to restore. It re-added removed sections because the "canonical" version it synced to was the pre-cleanup state.

**Root Cause**: The instructions said to "sync to canonical version" without clarifying that the cleanup itself was the canonical intent. Claude's pattern-matching defaulted to "divergence = defect" rather than "divergence = deliberate change."

**Resolution**: Added explicit guidance in MEMORY.md: "When prompt.md or user instructions identify bloat to REMOVE, do NOT treat the trimmed state as a defect to fix. Read the intent before syncing to a canonical version."

**Prevention**: When issuing cleanup or removal instructions, explicitly state that the removal IS the desired end state. Use phrases like "the trimmed version is correct" rather than relying on Claude to infer intent from context.

---

## [2026-03-23] - Passing Tests Masked a 65% Non-Functional Product

**Tags**: #testing #integration #QA #process

### Unit Tests Pass, Product Doesn't Work

- **Date**: 2026-03-23
- **Category**: process
- **Scope**: Full application (frontend + backend + database)
- **Root Cause**: Test suite validated individual units in isolation (mocked HTTP, mocked auth, mocked DB) but never validated that the pieces connected. 5,400+ tests passed while 120 console errors fired on every page load, 42 values were hardcoded fakes, and 18 buttons had no onClick handler.
- **What Happened**: A Playwright-driven browser walkthrough on 2026-03-22 revealed LoadPilot was only ~35% functional as an integrated product despite having 177+ backend endpoints, 15+ polished UI pages, and a fully green test suite. The audit found: 41 HTTP 500s from missing/conflicting DB tables, 20 HTTP 401s from 16 service functions using raw `fetch()` without auth headers, 42 hardcoded fake values displayed as real data, 18+ dead buttons with no click handlers, and an auth race condition where components mounted before Firebase tokens hydrated. None of these were caught by the existing 5,400 tests because every service call was mocked at the boundary.
- **Resolution**: 30-story remediation sprint (full SaaS integration) followed by an 18-story production readiness sprint. Fixed auth infrastructure (migrated 37 raw fetch calls to api client with 401 interceptor), created 8 missing DB tables, resolved 5 schema conflicts, replaced all hardcoded values with API-backed data or honest zeros, wired all dead buttons, and added auth readiness gate in App.tsx. Total: 59 files changed, 386 files across both sprints.
- **Prevention**: (1) Add a Playwright smoke test that logs in, visits every route, and asserts zero console errors -- run it in CI on every PR. (2) Include at least one "real HTTP round-trip" integration test per service module (no mocked fetch). (3) After any sprint that adds new pages or endpoints, run a browser walkthrough before declaring the sprint complete. (4) Treat `fetch()` usage outside the centralized `api.ts` client as a lint error.

---

## [2026-03-23] - Demo Blockers Invisible to Automated Tests

**Tags**: #testing #demo #QA #production-readiness

### Two Show-Stoppers Found Only by Human Eyes in a Browser

- **Date**: 2026-03-23
- **Category**: process
- **Scope**: SafetyView.tsx, GlobalMapViewEnhanced.tsx, QuoteManager.tsx, AccountingPortal.tsx
- **Root Cause**: "Mock Data" labels, "Simulated Positions" indicators, hardcoded fake phone numbers, and setTimeout-based fake data were all valid from a unit test perspective (they rendered without error) but were immediately disqualifying in a live demo context. No test asserted the absence of demo/mock artifacts in production builds.
- **What Happened**: After the 30-story SaaS integration sprint passed all verification (5,723 tests green, 0 TS errors), a live Playwright walkthrough revealed two categories of demo blockers: (1) visible mock indicators -- SafetyView showed a "Mock Data" banner, GlobalMapViewEnhanced showed "Simulated Positions" labels on the fleet map, and QuoteManager displayed hardcoded phone number "3125550199"; (2) fake operational behavior -- AccountingPortal ran a setTimeout that displayed fake "matched: 12, orphaned: 2" fuel receipt results, and a driver load sheet button called a stub that did nothing. These were fixed in a follow-up production polish sprint (S-R08, S-R14, S-R15, S-R17, S-R18) by gating mock indicators behind a DEV flag, implementing real PDF generation, and wiring call logging to the database.
- **Resolution**: Added DEV-only guards (`import.meta.env.DEV`) around all mock/simulated indicators. Replaced fake PDF stub with real jsPDF generation. Implemented call_logs migration + route. Hidden "Mock Data" labels in production builds.
- **Prevention**: (1) Add a CI test that greps production build output for known mock markers ("Mock Data", "Simulated", "fake", "hardcoded", "TODO", "555-"). (2) Before any demo or stakeholder review, do a 15-minute manual Playwright walkthrough of all pages -- automated tests will never catch "this looks fake to a human." (3) Establish a convention: all mock/placeholder data must be wrapped in a `DEV`-only guard from the moment it is written, not retroactively. (4) Add a pre-commit hook or lint rule that flags `setTimeout` calls in components that produce visible UI state changes (a common pattern for faking async operations).

---

<!-- New lessons are added above this line -->
