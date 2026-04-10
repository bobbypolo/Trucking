---
name: librarian
description: Knowledge management — lessons, decisions, and session handoffs
agent: librarian
context: fork
argument-hint: "[learn | decision | handoff]"
---

## Mode Detection

Parse ARGUMENTS to determine mode:

- If contains "learn": run **Learn mode**
- If contains "decision": run **Decision mode**
- If contains "handoff": run **Handoff mode**
- If no argument or unrecognized argument: **auto-detect**
  - If session is ending (user said "done", "wrap up", "end of session", etc.) → run Handoff mode
  - Otherwise → show available modes:

```
/librarian modes:
  learn    — Capture a solved issue as a durable lesson
  decision — Record an architecture decision (ADR)
  handoff  — Create end-of-session summary for continuity

Usage: /librarian [learn | decision | handoff]
```

---

## Learn Mode

Summarize what failed, root cause, fix, and "how to detect early next time".
Append to `.claude/docs/knowledge/lessons.md` with a date header and tags.

### Lesson Template

Use this structured format when writing the lesson:

```markdown
### [Title]

- **Date**: YYYY-MM-DD
- **Category**: bug | architecture | tooling | process | performance
- **Scope**: [file or area affected]
- **Root Cause**: [what actually caused it]
- **What Happened**: [1-2 sentences]
- **Resolution**: [what fixed it]
- **Prevention**: [how to avoid next time]
```

### Process

1. Ask user what happened (if not already clear from context)
2. Identify root cause — dig past symptoms to the underlying issue
3. Write the lesson using the template above
4. Append to `.claude/docs/knowledge/lessons.md`
5. If the lesson reveals a pattern, check if an existing lesson covers it — update rather than duplicate

---

## Decision Mode

Create an Architecture Decision Record:

### Process

1. List existing ADRs in `.claude/docs/decisions/` to determine the next number
2. Gather from user (ask if not provided):
   - Decision title (what are we deciding?)
   - Context (why do we need to decide this?)
   - Options considered (at least 2)
   - The chosen option and reasoning
3. Create the ADR file using `.claude/docs/decisions/000-template.md` as the format
4. Update `.claude/docs/decisions/README.md` index table

### File Naming

- Format: `NNN-kebab-case-title.md`
- Example: `001-use-postgresql-for-persistence.md`

### After Creation

- If this decision affects `.claude/docs/ARCHITECTURE.md`, note that it needs updating
- Inform user of the file created and any follow-up actions needed

---

## Handoff Mode

Generate `.claude/docs/HANDOFF.md` using the protocol below.

### Step 1: Gather Context

1. `git log --oneline -10` for recent commits
2. `git status` for uncommitted work
3. Resolve sprint paths: call `_lib.active_sprint_paths()` to get `plan_path`, `prd_path`. Read the resolved `plan_path` for phase status (note if file exists or not). If no active sprint, fall back to `.claude/docs/PLAN.md`.
4. Any blockers or open questions from the session

### Step 2: Detect Session Type

Check these conditions to determine what type of session just occurred:

**Build-in-progress session**: The resolved `plan_path` exists AND/OR a Ralph sprint is in progress (`.claude/.workflow-state.json` has ralph section with incomplete stories or `active_sprint_id` is set).

**Standard session**: None of the above conditions match (e.g., debugging, one-off tasks, documentation updates).

Detection steps:

1. Check `ralph.active_sprint_id` in workflow state — if set, this is a sprint-namespaced session.
2. Check if the resolved `plan_path` exists and has content.
3. Check if `.claude/.workflow-state.json` has ralph section with incomplete stories.
4. Classify the session type based on the conditions above.

### Step 3: Write Handoff Document

Write to `.claude/docs/HANDOFF.md` using the appropriate template based on session type:

---

#### Template A: Build-In-Progress Session

Use when session type is "build-in-progress".

```markdown
# Session Handoff - [Date]

## Session Type: Build In Progress

## Completed This Session

- {commit summaries or "No commits"}

## In Progress

- {uncommitted work description or "None"}

## Current Phase Status

Phase {N}: {name} - {what's done and what remains}

## Ralph Sprint Status (if applicable)

- Stories passed: {count}
- Stories skipped: {count}
- Current story: {story ID}
- Feature branch: {branch name}

## Blockers / Open Questions

- {any issues needing resolution or "None"}

## Next Session Should

1. {First priority action}
2. {Continue with /ralph, or Act as Builder for next phase, etc.}
```

#### Template B: Standard Session

Use when session type is "standard".

```markdown
# Session Handoff - [Date]

## Session Type: Standard

## Completed This Session

- {commit summaries or "No commits"}

## In Progress

- {uncommitted work description or "None"}

## Current Phase Status

Phase {N}: {name} - {what's done and what remains}
(or "No active plan" if PLAN.md does not exist)

## Blockers / Open Questions

- {any issues needing resolution or "None"}

## Next Session Should

1. {First priority action}
2. {Second priority action}
```
