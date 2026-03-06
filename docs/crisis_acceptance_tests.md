# Crisis Workflow Acceptance Tests

This document defines the acceptance criteria and test scenarios for the integrated Crisis Workflow in KCI TruckLogix Pro.

## 1. Incident Trigger & Categorization (Safety Manager)
**Objective:** Ensure Safety Managers can correctly identify and initiate a crisis workflow.

| Step | Action | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| S1.1 | Navigate to `Safety` tab | `CommandCenterView` loads with active incidents | |
| S1.2 | Categorize incident as `Legal Exposure` | Incident metadata updates with correct category | |
| S1.3 | Click `Initiate Repower` | `REPOWER` request created; Load marked `AT RISK` | |
| S1.4 | Verify Right Rail | `CRISIS` tab shows the new incident | |

## 2. Repower Handoff & Execution (Dispatch)
**Objective:** Validate that Dispatch receives and executes recovery operations.

| Step | Action | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| D2.1 | Open `IntelligenceHub` -> `Crisis` tab | Incident visible in triage queue | |
| D2.2 | Click incident to open Load Workspace | Center panel displays `PENDING REPOWER EXECUTION` alert | |
| D2.3 | Click `Execute` on alert | Sub-process assigns recovery driver; logs `REPOWER_EXECUTED` | |
| D2.4 | Verify Finance Tab | $500 repower fee visible in linked system requests | |

## 3. Equipment Verification (Driver)
**Objective:** Ensure drivers perform required field verifications.

| Step | Action | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| V3.1 | Select Active Load in workspace | Load details load correctly | |
| V3.2 | Click `Work` -> `Verify Drop` | Modal appears for location/condition input | |
| V3.3 | Submit verification | `TRAILER_DROP_VERIFIED` event logged; Dropoff leg marked complete | |

## 4. Exception Management (System)
**Objective:** Validate that skipping steps creates corrective actions.

| Step | Action | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| E4.1 | Skip `Verify Drop` and set status to `Delivered` | System detects missing verification artifact | |
| E4.2 | Check `Crisis` triage queue | `Safety Violation` or `Compliance Breach` exception appears | |
| E4.3 | Resolve Exception | Safety Manager manually clears exception after audit | |

## Test Environments
- **Safety Manager:** `intelligence-hub/safety`
- **Dispatcher:** `intelligence-hub/dashboard` (Unified Operations Grid)
- **Driver:** Driver Mobile Experience

---
*Authorized by: KCI Operations Architecture*
