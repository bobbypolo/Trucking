---
name: verify
description: Run verification steps for the current phase.
context: fork
---

## Verification Process

1. **Resolve Sprint Paths**
   - Call `_lib.active_sprint_paths()` to get `plan_path`, `prd_path`, `progress_path`, `verification_log_path`
   - Falls back to legacy singleton paths when no `active_sprint_id` is set

2. **Read the Plan**
   - Open the resolved `plan_path`
   - Identify the current phase (first phase not marked Complete)
   - Extract the "Done When" criteria, "Verification Command", and story ID
   - Identify the prd.json story corresponding to the current phase (from resolved `prd_path`)

3. **Run Automated QA Steps via qa_runner.py**

   Run the automated QA runner to execute all 12 steps programmatically:

   ```bash
   python .claude/hooks/qa_runner.py \
     --story [STORY-ID] \
     --prd [resolved prd_path] \
     --changed-files [comma-separated list from git diff] \
     --checkpoint [base-commit-hash] \
     --plan [resolved plan_path]
   ```

   - Parse the JSON output from qa_runner.py
   - qa_runner.py routes command ownership from `workflow.json.project_mode`
   - All 12 steps are fully automated (no manual review steps)
   - If qa_runner.py is not available, fall back to running verification commands manually

4. **Run Plan Verification Command**
   - Execute the verification command from the plan
   - Capture full output including any errors
   - Note exit codes

5. **Check Each Criterion**
   - Go through each "Done When" item
   - Mark as PASS or FAIL with evidence
   - For subjective criteria, provide reasoning

6. **UI Verification (if applicable)**
   - If the phase involves UI changes, use Playwright/Stagehand
   - Navigate to relevant pages
   - Verify visual and functional requirements
   - Capture screenshots as evidence

7. **Generate Human-Readable Report**

   Display the report in the following format (preserves existing human-readable output):

   ## Verification Report - Phase [N]: [Name]

   **Date**: [timestamp]

   ### Automated Checks (qa_runner.py)

   | Step | Name | Result         | Evidence  |
   | ---- | ---- | -------------- | --------- |
   | 1    | Lint | PASS/FAIL/SKIP | [summary] |
   | ...  | ...  | ...            | ...       |

   ### Done Criteria

   | Criterion     | Status    | Evidence        |
   | ------------- | --------- | --------------- |
   | [criterion 1] | PASS/FAIL | [output/reason] |
   | [criterion 2] | PASS/FAIL | [output/reason] |

   ### Overall Result: PASS / FAIL

   ### Issues Found
   - [List any issues that caused failures]

   ### Recommendations
   - [Any suggestions for fixes or improvements]

   ***

8. **Reference the qa_runner.py Receipt**

   qa_runner.py automatically writes a structured receipt to `.claude/runtime/receipts/` after each run. The receipt file path is printed in the qa_runner.py output (look for `receipt_path` in the JSON output).

   Do not duplicate the receipt by writing a separate JSONL log — reference the receipt path from the qa_runner.py output when reporting results. If no receipt path is present in the output, note that the receipt was not written (e.g., qa_runner.py was not available).

## After Verification

If overall result is **PASS**:

1. Clear workflow state flags by running tests (which triggers `post_bash_capture.py` to clear `needs_verify` in `.workflow-state.json`), or note that the verification run itself has already cleared the flags.
2. Report: "Verification passed. Marker cleared."

If overall result is **FAIL**:

1. Do NOT clear the marker
2. Report which checks failed
3. Builder must fix issues before re-running /verify

## Failure Protocol

- If **FAIL**: Do not proceed to next phase
- Report issues clearly so Builder can address them
- Do not attempt fixes (that's Builder's job)
