# Build Conventions — Shared Rules

This file is the canonical source for build conventions shared between `builder.md` (Manual Mode) and `ralph-worker.md` (Ralph autonomous mode). Both agents reference this file rather than inlining the rules.

---

## Implementation Rules

1. **One phase only** -- Complete current phase before moving to next
2. **Small diffs** -- Prefer minimal changes that satisfy requirements
3. **4-checkpoint TDD protocol** -- For each acceptance criterion, follow all 4 checkpoints:
   - **(1) Red**: Write the failing test with `# Tests R-PN-NN` marker; run it and confirm it FAILS before writing any implementation code
   - **(2) Green**: Implement the minimum production code to make the test PASS; run the test and confirm it PASSES
   - **(3) Refactor**: Clean up and refactor; run the full test suite and confirm all tests still PASS
   - **(4) Gate**: Run `qa_runner.py` on changed files before committing; all 12 QA steps must PASS

   TDD order violations are WARN for foundation phases and FAIL for module/integration/e2e phases (enforced by Check 6 in Step 9)

4. **Requirement traceability** -- Include `# Tests R-PN-NN` in the test docstring to link back to plan requirements
5. **No scope creep** -- If it is not in the plan, do not build it
6. **Prefer modifying existing files** -- Before creating a new file, confirm no existing file can be extended. New files are justified only when the function is genuinely orthogonal to all existing modules. Gratuitous file creation is a code smell.
7. **No unnecessary abstraction** -- Do not introduce helper functions, base classes, or wrapper layers unless they are called from 2+ places in this phase/story. Single-use abstractions add indirection without value.
8. **Inline single-use functions** -- If a function is defined and called exactly once, inline it at the call site unless it exceeds 10 lines or has independent test coverage.
9. **Keep related logic together** -- Place new logic adjacent to the code it modifies. Do not split a single conceptual change across multiple files when one file suffices.

---

## Test Quality Contract

Anti-gaming rules. Every test you write must satisfy all 5 of these:

1. **Specific value assertions required** -- Tests must assert on concrete expected values (e.g., `assert result == 42`, `assert status == "PASS"`), not just structural facts (e.g., `assert result is not None`, `assert len(result) > 0`).
2. **Tests must call the production functions they claim to test** -- A test for `parse_config()` must call `parse_config()`. Mocking the function under test is forbidden.
3. **Error-path tests must provoke actual errors** -- A test for an error case must call the code path that raises or returns the error, not simulate the error at the mock boundary.
4. **Tests must verify behavior not mechanics** -- Tests assert on what the code returns or does, not on how many times an internal method was called. Use `assert_called_once_with` only for side-effect verification (I/O, DB writes, HTTP calls).
5. **R-markers are contracts not decoration** -- A `# Tests R-P1-01` comment means this test is the evidence that R-P1-01 passes. If the test does not actually verify the criterion, fix the test or remove the marker.

---

## Selective Staging Rules

- Use explicit file paths in `git add`. NEVER use `git add -A` or `git add .`
- Only stage source code, test files, and documentation that this phase/story produced
- Do NOT stage: `.claude/` state files (`.workflow-state.json`), error logs
- **Internal file guard**: Before each `git commit`, run `git diff --cached --name-only` and verify NO files under `.claude/` are staged (except `.claude/docs/` documentation files). If any `.claude/` state files are staged, unstage them with `git reset HEAD <file>` before committing.

---

## Fixture Validation

After writing or modifying a test file, before running it for the first time, run:

```bash
python -m pytest --collect-only --tb=short <test_file>
```

If this exits non-zero (collection error — e.g., ImportError, fixture-not-found, NameError), fix the collection error before proceeding. Do not suppress the error.

---

## Format Before Commit

Before staging files, run `ruff format <changed-files>` and `ruff check --fix <changed-files>` on all Python files changed in this phase/story. This compensates for `post_format.py` being skipped in subagent contexts.

---

## Environment Variable Consistency

1. **Read `.env` before using env vars** -- You MUST read the project's `.env` file before writing any `os.getenv()`, `os.environ.get()`, or `os.environ[]` call. **Always use the Read tool** (never Bash grep/cat) to read `.env` files — the Read tool is auto-approved while Bash commands on `.env` may be denied by permissions. Reading `.env` is explicitly authorized and expected — it contains the key names you need to reference. Use the exact key names already defined there. Do not invent synonyms (e.g. if `.env` has `DATABASE_URL`, do not create `DB_CONNECTION_STRING`). You may also read `.env.example` for key discovery.
2. **Never remove `.env` keys** -- The `pre_env_guard.py` hook blocks any Edit/Write that would delete existing keys from `.env` files. Add new keys, update values, but never remove entries.
3. **Reuse existing variables** -- Before creating any new variable, constant, or config value, search the codebase for existing definitions. Prefer reusing an established pattern over introducing a parallel one.
4. **New env vars require `.env.example`** -- If a genuinely new env var is needed, add it to `.env.example` (or document it in `PROJECT_BRIEF.md`) with a descriptive comment explaining its purpose.

---

## Production-Grade Code Standards

Follow Production-Grade Code Standards from `.claude/rules/production-standards.md`. No exceptions -- every violation must be fixed before the phase can pass.
