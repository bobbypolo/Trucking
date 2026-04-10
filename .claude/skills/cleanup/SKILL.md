---
name: cleanup
description: Post-sprint housekeeping -- prune stale branches, worktrees, receipts, fix-logs, rotate logs, report orphan R-markers, and reset workflow state.
argument-hint: "[task names: branches, worktrees, receipts, fix-logs, verify-log, audit-log, error-log, orphans, state | or blank for all]"
---

## Task Selection

By default, all tasks run. Pass comma-separated task names to run specific tasks only.

| Name         | Task    | What it does                                             |
| ------------ | ------- | -------------------------------------------------------- |
| `branches`   | Task 1  | Prune merged ralph/ branches                             |
| `worktrees`  | Task 2  | Remove stale agent worktrees                             |
| `receipts`   | Task 3  | Clean QA receipts not in prd.json                        |
| `fix-logs`   | Task 4  | Remove fix-log directory                                 |
| `verify-log` | Task 5  | Rotate verification log to 500 entries                   |
| `audit-log`  | Task 6  | Rotate hook audit log to 500 entries                     |
| `error-log`  | Task 7  | Rotate error history to 100 entries                      |
| `orphans`    | Task 8  | Strip orphan R-markers + report                          |
| `state`      | Task 9  | Reset workflow state to defaults                         |
| `doc-drift`  | Task 10 | Detect and fix doc count drift in ARCHITECTURE.md/README |

**Examples**: `/cleanup branches,worktrees` | `/cleanup logs` (alias for verify-log,audit-log,error-log) | `/cleanup doc-drift` | `/cleanup` (all)

## /cleanup Skill

Run all post-sprint cleanup tasks interactively. Displays a summary table at the end.

### Active-Sprint Guard

Before running any task, check the workflow state:

```python
import sys
sys.path.insert(0, ".claude/hooks")
from _lib import read_workflow_state
state = read_workflow_state()
current_step = state.get("ralph", {}).get("current_step", "")
if current_step:
    print(f"WARNING: ralph.current_step is '{current_step}' -- a Ralph sprint may be active.")
    print("Running /cleanup during an active sprint may interfere with ongoing work.")
    print("Abort now (Ctrl-C) or continue at your own risk.")
```

If `ralph.current_step` is non-empty, warn the user before proceeding. Do not abort automatically -- let the user decide.

---

### Parse Task Selection

Parse the user's arguments to determine which tasks to run:

```python
import os

TASK_NAMES = {
    "branches": 1, "worktrees": 2, "receipts": 3, "fix-logs": 4,
    "verify-log": 5, "audit-log": 6, "error-log": 7,
    "orphans": 8, "state": 9, "doc-drift": 10,
}
ALIASES = {"logs": ["verify-log", "audit-log", "error-log"]}

# Get arguments from skill invocation (passed as environment or parsed from user input)
raw_args = os.environ.get("CLEANUP_TASKS", "").strip()
if not raw_args:
    selected_tasks = set(range(1, 11))  # all tasks
else:
    selected_tasks = set()
    for token in raw_args.split(","):
        token = token.strip().lower()
        if token in ALIASES:
            for alias_name in ALIASES[token]:
                selected_tasks.add(TASK_NAMES[alias_name])
        elif token in TASK_NAMES:
            selected_tasks.add(TASK_NAMES[token])
        else:
            print(f"Warning: unknown task name '{token}', skipping")

def should_run(task_num: int) -> bool:
    return task_num in selected_tasks
```

---

### Task 1: Prune Merged Branches

**Skip check**: If `should_run(1)` is False, skip this task entirely and print `"Task 1: Skipped (not selected)"`.

Delete local branches that have already been merged into main.

```python
import subprocess
result_t1 = subprocess.run(
    ["git", "branch", "--merged", "main"],
    capture_output=True, text=True
)
merged = [b.strip() for b in result_t1.stdout.splitlines()
          if b.strip().startswith("ralph/")]
deleted = []
errors_t1 = []
for branch in merged:
    r = subprocess.run(["git", "branch", "-d", branch], capture_output=True, text=True)
    if r.returncode == 0:
        deleted.append(branch)
    else:
        errors_t1.append(f"{branch}: {r.stderr.strip()}")
print(f"Task 1: Pruned {len(deleted)} merged branches. Errors: {errors_t1 or 'none'}")
```

**Error handling**: If `git branch --merged` fails (e.g., not a git repo), log the error and skip. Individual branch deletions that fail are logged per-branch and do not abort the task.

---

### Task 2: Prune Worktrees

**Skip check**: If `should_run(2)` is False, skip this task entirely and print `"Task 2: Skipped (not selected)"`.

Remove stale agent worktrees under `.claude/worktrees/agent-*`.

```python
import sys
sys.path.insert(0, ".claude/hooks")
from _lib import prune_worktrees
result_t2 = prune_worktrees()
print(f"Task 2: Pruned {result_t2['pruned_count']} worktrees. Errors: {result_t2['errors'] or 'none'}")
```

**Error handling**: `_lib.prune_worktrees()` never raises. On git command failure, errors are returned in `result_t2['errors']`. Log and continue.

---

### Task 3: Clean Receipts

**Skip check**: If `should_run(3)` is False, skip this task entirely and print `"Task 3: Skipped (not selected)"`.

Remove QA receipt directories for story IDs that no longer appear in prd.json.

```python
import json, sys
sys.path.insert(0, ".claude/hooks")
from pathlib import Path
from _lib import prune_receipts, active_sprint_paths

sprint = active_sprint_paths()
prd_path = sprint["prd_path"]
receipts_dir = Path(".claude/runtime/receipts")
valid_ids = set()
if prd_path.exists():
    try:
        prd = json.loads(prd_path.read_text(encoding="utf-8"))
        valid_ids = {s["id"] for s in prd.get("stories", []) if "id" in s}
    except Exception as e:
        print(f"  Warning: could not read prd.json: {e}")

result_t3 = prune_receipts(receipts_dir, valid_ids)
print(f"Task 3: Removed {len(result_t3['pruned'])} stale receipts {result_t3['pruned']}. Kept: {result_t3['kept']}")
```

**Error handling**: `_lib.prune_receipts()` never raises. If `prd.json` is missing or corrupt, valid_ids defaults to empty (all receipts pruned -- acceptable for cleanup). If receipts_dir does not exist, returns empty lists silently.

---

### Task 4: Clean Fix-Logs

**Skip check**: If `should_run(4)` is False, skip this task entirely and print `"Task 4: Skipped (not selected)"`.

Remove all fix-log files from previous sprint attempts.

```python
import shutil
from pathlib import Path

fix_log_dir = Path(".claude/runtime/fix-log")
removed = 0
if fix_log_dir.is_dir():
    try:
        shutil.rmtree(str(fix_log_dir))
        removed = 1
        print(f"Task 4: Removed fix-log directory ({fix_log_dir})")
    except Exception as e:
        print(f"Task 4: Warning -- could not remove fix-log dir: {e}")
else:
    print("Task 4: No fix-log directory found (nothing to clean)")
```

**Error handling**: If `shutil.rmtree` fails (e.g., locked files on Windows), log the error and continue. The fix-log directory is non-critical -- stale entries are harmless.

---

### Task 5: Rotate Verification Log

**Skip check**: If `should_run(5)` is False, skip this task entirely and print `"Task 5: Skipped (not selected)"`.

Trim the verification log to the 500 most recent entries. Uses sprint-resolved path (falls back to legacy `.claude/docs/verification-log.jsonl`).

```python
import sys
sys.path.insert(0, ".claude/hooks")
from pathlib import Path
from _lib import rotate_log, active_sprint_paths

path = active_sprint_paths()["verification_log_path"]
result_t5 = rotate_log(path, max_entries=500)
print(f"Task 5: Verification log -- original: {result_t5['original_count']}, "
      f"retained: {result_t5['retained_count']}, removed: {result_t5['removed_count']}")
```

**Error handling**: `_lib.rotate_log()` never raises. If the file is missing or empty, returns zeros. If write fails, logs a warning and returns zeros. Log any non-zero removed count as an informational message.

---

### Task 6: Rotate Hook Audit Log

**Skip check**: If `should_run(6)` is False, skip this task entirely and print `"Task 6: Skipped (not selected)"`.

Trim `.claude/errors/hook_audit.jsonl` to the 500 most recent entries.

```python
import sys
sys.path.insert(0, ".claude/hooks")
from pathlib import Path
from _lib import rotate_log

path = Path(".claude/errors/hook_audit.jsonl")
result_t6 = rotate_log(path, max_entries=500)
print(f"Task 6: Hook audit log -- original: {result_t6['original_count']}, "
      f"retained: {result_t6['retained_count']}, removed: {result_t6['removed_count']}")
```

**Error handling**: `_lib.rotate_log()` never raises. Missing or empty files return zeros silently. Log and continue on any failure.

---

### Task 7: Rotate Error History

**Skip check**: If `should_run(7)` is False, skip this task entirely and print `"Task 7: Skipped (not selected)"`.

Trim `.claude/errors/error_history.jsonl` to the 100 most recent entries.

```python
import sys
sys.path.insert(0, ".claude/hooks")
from pathlib import Path
from _lib import rotate_log

path = Path(".claude/errors/error_history.jsonl")
result_t7 = rotate_log(path, max_entries=100)
print(f"Task 7: Error history -- original: {result_t7['original_count']}, "
      f"retained: {result_t7['retained_count']}, removed: {result_t7['removed_count']}")
```

**Error handling**: `_lib.rotate_log()` never raises. If the errors directory or file does not exist, returns zeros. Log and skip on failure.

---

### Task 8: Strip Orphan R-Markers

**Skip check**: If `should_run(8)` is False, skip this task entirely and print `"Task 8: Skipped (not selected)"`.

Scan test files for R-marker IDs that no longer appear in prd.json and remove them. Uses sprint-resolved prd path.

```python
import sys
sys.path.insert(0, ".claude/hooks")
from pathlib import Path
from _lib import strip_orphan_markers, active_sprint_paths

test_dir = Path(".claude/hooks/tests")
prd_path = active_sprint_paths()["prd_path"]
result_t8 = strip_orphan_markers(test_dir, prd_path)
print(f"Task 8: Stripped {result_t8['markers_removed']} orphan R-marker(s) from "
      f"{result_t8['files_modified']} file(s). ")
if result_t8["errors"]:
    print("  Warnings:")
    for err in result_t8["errors"]:
        print(f"    - {err}")
```

**Error handling**: `_lib.strip_orphan_markers()` never raises. If `prd.json` or `test_dir` is missing, returns zeros without modifying any files. Partial-read errors are collected in `errors` and reported, but do not abort the task. Always display the result even if it is zeros.

---

### Task 9: Reset Workflow State

**Skip check**: If `should_run(9)` is False, skip this task entirely and print `"Task 9: Skipped (not selected)"`.

Reset `.workflow-state.json` to the default state (clears ralph sprint tracking fields).

**Stale-sentinel recovery path**: If a sibling linked worktree's crashed Ralph left behind a stale `ralph.current_story_id` and the canonical-root concurrency guard is now blocking startup, run `/cleanup state` from the sibling worktree to clear that worktree's sentinel. The new `ralph.stale_state_ttl_minutes` config in `workflow.json` (default 0 = disabled) can also auto-filter stale story sentinels older than the configured TTL — note the filter only applies to `current_story_id`, never to `needs_verify`.

```python
import sys
sys.path.insert(0, ".claude/hooks")
from _lib import write_workflow_state, DEFAULT_WORKFLOW_STATE
import copy

fresh_state = copy.deepcopy(DEFAULT_WORKFLOW_STATE)
state_ok = write_workflow_state(fresh_state)
if state_ok:
    print("Task 9: Workflow state reset to defaults.")
else:
    print("Task 9: Warning -- workflow state write failed. Check file permissions.")
```

**Error handling**: `_lib.write_workflow_state()` returns `False` on failure (never raises). If the write fails, log a warning and continue -- the old state file is left unchanged.

---

### Task 10: Doc-Drift Detection

**Skip check**: If `should_run(10)` is False, skip this task entirely and print `"Task 10: Skipped (not selected)"`.

Count agents, skills, and patterns on disk; compare to counts stated in `ARCHITECTURE.md` and `README.md`; report mismatches; detect ghost file references; and auto-fix count lines in both docs.

```python
import re
import sys
from pathlib import Path

sys.path.insert(0, ".claude/hooks")

# --- 1. Count items on disk ---
agents_dir = Path(".claude/agents")
skills_dir = Path(".claude/skills")
prod_patterns_path = Path(".claude/hooks/_prod_patterns.py")

disk_agents = len(list(agents_dir.glob("*.md"))) if agents_dir.exists() else 0
disk_skills = len([d for d in skills_dir.iterdir() if d.is_dir()]) if skills_dir.exists() else 0

# Count patterns from _prod_patterns.py by importing it
sys.path.insert(0, ".claude/hooks")
try:
    from _prod_patterns import PROD_VIOLATION_PATTERNS, MULTILINE_VIOLATION_PATTERNS
    disk_patterns = len(PROD_VIOLATION_PATTERNS) + len(MULTILINE_VIOLATION_PATTERNS)
    block_count = (
        sum(1 for p in PROD_VIOLATION_PATTERNS if p[3] == "block")
        + sum(1 for p in MULTILINE_VIOLATION_PATTERNS if p[3] == "block")
    )
    warn_count = (
        sum(1 for p in PROD_VIOLATION_PATTERNS if p[3] == "warn")
        + sum(1 for p in MULTILINE_VIOLATION_PATTERNS if p[3] == "warn")
    )
except ImportError as e:
    disk_patterns = block_count = warn_count = 0
    print(f"  Warning: could not import _prod_patterns: {e}")

print(f"Task 10: Disk counts — agents={disk_agents}, skills={disk_skills}, patterns={disk_patterns} ({block_count} BLOCK, {warn_count} WARN)")

# --- 2. Read ARCHITECTURE.md and README.md ---
arch_path = Path(".claude/docs/ARCHITECTURE.md")
readme_path = Path("README.md")

arch_text = arch_path.read_text(encoding="utf-8") if arch_path.exists() else ""
readme_text = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""

# --- 3. Extract stated counts from docs ---
def extract_int(pattern, text, default=None):
    m = re.search(pattern, text)
    return int(m.group(1)) if m else default

# ARCHITECTURE.md: look for "N slash-command skills" and pattern count line
arch_skills = extract_int(r"(\d+)\s+slash-command\s+skills", arch_text)
arch_patterns = extract_int(r"(\d+)\s+production\s+violation\s+(?:regex\s+)?patterns", arch_text)

# README.md: look for "N agents" and "N skills" in directory tree
readme_agents = extract_int(r"(\d+)\s+agents?", readme_text)
readme_skills = extract_int(r"(\d+)\s+skills?", readme_text)

mismatches = []
if arch_skills is not None and arch_skills != disk_skills:
    mismatches.append(f"  ARCHITECTURE.md skills: stated={arch_skills}, disk={disk_skills}")
if arch_patterns is not None and arch_patterns != disk_patterns:
    mismatches.append(f"  ARCHITECTURE.md patterns: stated={arch_patterns}, disk={disk_patterns} ({block_count} BLOCK, {warn_count} WARN)")
if readme_agents is not None and readme_agents != disk_agents:
    mismatches.append(f"  README.md agents: stated={readme_agents}, disk={disk_agents}")
if readme_skills is not None and readme_skills != disk_skills:
    mismatches.append(f"  README.md skills: stated={readme_skills}, disk={disk_skills}")

if mismatches:
    print("Task 10: Count mismatches found:")
    for m in mismatches:
        print(m)
else:
    print("Task 10: All stated counts match disk — no drift detected.")

# --- 4. Ghost reference detection ---
# Files listed in README.md or ARCHITECTURE.md that do not exist on disk
ghost_refs = []

# Check for agent .md references in docs
for doc_name, doc_text in [("ARCHITECTURE.md", arch_text), ("README.md", readme_text)]:
    for match in re.finditer(r"`([\w-]+\.md)`", doc_text):
        ref = match.group(1)
        # Only check agent files (in .claude/agents/)
        candidate = agents_dir / ref
        if not candidate.exists():
            # Also check root level
            if not Path(ref).exists():
                ghost_refs.append(f"  {doc_name}: references `{ref}` — not found on disk")

    # Check skill directory references (e.g. `build-system`, `handoff` as skill names)
    for match in re.finditer(r"^\s*[-*]\s+`([\w-]+)`\s", doc_text, re.MULTILINE):
        ref_name = match.group(1)
        candidate_skill = skills_dir / ref_name
        if not candidate_skill.exists() and not (agents_dir / f"{ref_name}.md").exists():
            # Filter: only flag if it looks like a skill/agent reference (not generic words)
            if len(ref_name) > 3 and "-" in ref_name or ref_name in [
                "build-system", "handoff", "learn", "decision", "refresh",
                "ralph-story", "local-specialist",
            ]:
                ghost_refs.append(f"  {doc_name}: lists `{ref_name}` — not found as skill dir or agent file")

if ghost_refs:
    # Deduplicate
    seen_refs = set()
    for ref in ghost_refs:
        if ref not in seen_refs:
            seen_refs.add(ref)
            print(ref)
    print(f"Task 10: {len(seen_refs)} ghost reference(s) detected.")
else:
    print("Task 10: No ghost references detected.")

# --- 5. Auto-fix count lines in ARCHITECTURE.md and README.md ---
errors_t10 = []
fixes_applied = []

if arch_path.exists():
    new_arch = arch_text
    # Fix skill count: "N slash-command skills"
    if arch_skills is not None and arch_skills != disk_skills:
        new_arch = re.sub(
            r"(\d+)(\s+slash-command\s+skills)",
            lambda m: f"{disk_skills}{m.group(2)}",
            new_arch,
        )
        fixes_applied.append(f"  ARCHITECTURE.md: skills {arch_skills} → {disk_skills}")
    # Fix pattern count: "N production violation patterns (X BLOCK, Y WARN)"
    if arch_patterns is not None and arch_patterns != disk_patterns:
        new_arch = re.sub(
            r"\d+(\s+production\s+violation\s+(?:regex\s+)?patterns\s*\(\d+\s+BLOCK,\s*\d+\s+WARN\))",
            lambda m: f"{disk_patterns}{m.group(1)}",
            new_arch,
        )
        new_arch = re.sub(
            r"(\s+production\s+violation\s+(?:regex\s+)?patterns\s*\()\d+(\s+BLOCK,\s*)\d+(\s+WARN\))",
            lambda m: f"{m.group(1)}{block_count}{m.group(2)}{warn_count}{m.group(3)}",
            new_arch,
        )
        fixes_applied.append(f"  ARCHITECTURE.md: patterns {arch_patterns} → {disk_patterns} ({block_count} BLOCK, {warn_count} WARN)")
    if new_arch != arch_text:
        try:
            arch_path.write_text(new_arch, encoding="utf-8")
        except OSError as e:
            errors_t10.append(f"Failed to write ARCHITECTURE.md: {e}")

if readme_path.exists():
    new_readme = readme_text
    # Fix agent count: "N agents" on directory tree lines
    if readme_agents is not None and readme_agents != disk_agents:
        new_readme = re.sub(
            r"(\d+)(\s+agents?)",
            lambda m: f"{disk_agents}{m.group(2)}",
            new_readme,
            count=1,
        )
        fixes_applied.append(f"  README.md: agents {readme_agents} → {disk_agents}")
    # Fix skill count: "N skills" on directory tree lines
    if readme_skills is not None and readme_skills != disk_skills:
        new_readme = re.sub(
            r"(\d+)(\s+skills?)",
            lambda m: f"{disk_skills}{m.group(2)}",
            new_readme,
            count=1,
        )
        fixes_applied.append(f"  README.md: skills {readme_skills} → {disk_skills}")
    if new_readme != readme_text:
        try:
            readme_path.write_text(new_readme, encoding="utf-8")
        except OSError as e:
            errors_t10.append(f"Failed to write README.md: {e}")

if fixes_applied:
    print("Task 10: Auto-fixed the following count mismatches:")
    for fix in fixes_applied:
        print(fix)
elif not mismatches:
    print("Task 10: No auto-fixes needed — all counts already accurate.")
if errors_t10:
    print(f"Task 10: Errors during auto-fix: {errors_t10}")

result_t10 = {
    "mismatches": len(mismatches),
    "ghost_refs": len(set(ghost_refs)),
    "fixes_applied": len(fixes_applied),
    "errors": errors_t10,
}
```

**Error handling**: If `ARCHITECTURE.md` or `README.md` does not exist, the detection step reports zero counts and skips that file. If the import of `_prod_patterns` fails, `disk_patterns` is reported as 0 with a warning. Auto-fix write failures are logged in `errors_t10` and do not abort the task.

---

### Task 11: Summary

Display a final summary table of all cleanup results.

```python
print("\n" + "=" * 60)
print("Cleanup Summary")
print("=" * 60)
print(f"  Task 1  -- Merged branches pruned    : {len(deleted)}")
print(f"  Task 2  -- Worktrees pruned          : {result_t2['pruned_count']}")
print(f"  Task 3  -- Stale receipts removed    : {len(result_t3['pruned'])}")
print(f"  Task 4  -- Fix-log dir removed       : {'yes' if removed else 'no'}")
print(f"  Task 5  -- Verification log rows     : -{result_t5['removed_count']}")
print(f"  Task 6  -- Audit log rows removed    : -{result_t6['removed_count']}")
print(f"  Task 7  -- Error history trimmed     : -{result_t7['removed_count']}")
print(f"  Task 8  -- Orphan R-markers stripped : {result_t8['markers_removed']}")
print(f"  Task 9  -- Workflow state reset      : {'ok' if state_ok else 'WARN'}")
print(f"  Task 10 -- Doc-drift mismatches      : {result_t10['mismatches']} ({result_t10['fixes_applied']} fixed)")
print(f"  Task 11 -- Summary displayed         : yes")
print("=" * 60)
skipped = [t for t in range(1, 11) if t not in selected_tasks]
if skipped:
    print(f"  Skipped tasks: {skipped}")
print("Cleanup complete.")
```

**Error handling**: This task is display-only. If any prior task did not populate its result variable (due to an error path), substitute safe defaults (`0` or `'N/A'`) so the summary always renders without raising.
