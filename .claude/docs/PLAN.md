# Plan: Frontend Hardening Sprint — Robustness & Resilience

> **Parallel Execution Constraints** (added 2026-03-21):
> - Max 10 concurrent agents
> - Each agent MUST use worktree isolation (`isolation: "worktree"`)
> - Worktrees must be based on the feature branch (`ralph/loadpilot-orchestrator-qa-master-plan`), not main

## Goal

Harden the LoadPilot frontend from "operational but fragile" to production-ready by systematically fixing all crash risks, memory leaks, auth expiry failures, write-flow safety gaps, and accessibility fundamentals. This plan addresses every finding from the 10-question frontend stability audit AND completes 3 carry-forward items from the prior remediation plan (PLAN.md.bak / prd.json.bak). No new features — only making existing features robust.

## Prior Plan Completion Status

The prior remediation plan (docs/backup-2026-03-18/PLAN.md.bak) ran 29 stories across 5 phases — ALL PASSED per prd.json. Three stories were only partially addressed and carry forward into this plan:

| Old Story | What Was Done | What Remains | New Story |
|-----------|---------------|--------------|-----------|
| STORY-022 (Loading/Error/Empty) | 4 components got states (AccountingPortal, SafetyView, BrokerManager, Settlements) | 11 components still missing states | H-402/H-403 (Wave 3) |
| STORY-023 (Form Validation) | 3 forms validated (Auth, CompanyProfile, EditLoadForm) | 7+ forms still need validation | H-401 (Wave 3) |
| STORY-026 (File Upload UI) | Server route wired (STORY-301), multer + documents endpoint works | Upload progress, failure states, permission-denied UX not verified | H-602 (Wave 5) |

All other old-plan stories (012-021, 024-025, 027-036) are fully complete and verified.

## System Context

| Dimension | Current State |
|-----------|---------------|
| Tests | 5,415 total (3,290 FE + 1,869 BE + 256 Python), all passing |
| TypeScript | 0 errors frontend + server |
| Build | Succeeds in 14.9s, no chunk > 250KB (excl vendor) |
| Components | 54 feature components + 5 shared UI components |
| Styling | Tailwind CSS v4, dark theme (slate-950), Inter font |
| Pages | 15 major page components, all render without crashes |
| Branch | `ralph/loadpilot-orchestrator-qa-master-plan` off main (`2a9c836`) |

### Audit Severity Matrix

| Audit Item | Grade | Risk Level | Wave |
|------------|-------|------------|------|
| Q1: API Data Resilience | D | CRITICAL — 65 HIGH crash risks | 1 |
| Q8: Long-lived Stability | D | CRITICAL — 27+ setTimeout leaks + stale closure | 1 |
| Q2: Auth Expiry Handling | D | HIGH — silent data loss | 2 |
| Q3: Write Flow Safety | D+ | HIGH — 4/6 forms unprotected | 2 |
| Q4: Form Validation | C- | MEDIUM — 7/8 forms weak | 3 |
| Q7: Loading/Error/Empty | C- | MEDIUM — 33% coverage | 3 |
| Q6: Role-Based UX | B+ | LOW — security correct, UX missing | 4 |
| Q10: Accessibility | C+ | LOW — forms/buttons need labels, heading hierarchy D-grade | 4 |
| Q5: Mobile | B- | LOW — tap targets borderline | 5 |
| Q9: File Upload UX | Untested | LOW — verify existing flows | 5 |

### Discovery Evidence

```
# Unsafe data access patterns (full sweep)
Total unsafe patterns: ~250+ instances
  HIGH-risk (will crash):     65 instances
    - Unsafe nested access:   35 instances (pickup.city, dropoff.state)
    - Non-null assertions:     8 instances (BookingPortal, NetworkPortal)
    - Unsafe array methods:   22 instances
  MEDIUM-risk (might crash): 185+ instances
    - Array methods on undefined: 45 instances
    - Filter/map/forEach/reduce without guards: 120+
    - Partial optional chaining: 8 instances
    - Type assertions without validation: 12+

# Most vulnerable components (by unsafe pattern count)
IntelligenceHub.tsx:     50+ unsafe patterns + 14 setTimeout leaks
CommandCenterView.tsx:   15+ unsafe patterns + 4 setTimeout leaks
Dashboard.tsx:           25+ unsafe patterns
AccountingPortal.tsx:    18+ unsafe patterns + 2 setTimeout leaks
GlobalMapViewEnhanced:   18+ unsafe patterns
Intelligence.tsx:        14+ unsafe patterns
QuoteManager.tsx:        12+ unsafe patterns
NetworkPortal.tsx:       10+ unsafe patterns + 6 non-null assertions
BookingPortal.tsx:       5 non-null assertions + 1 setTimeout leak

# Auth/401 handling
Global 401 interceptor:      NONE
Session expired UI:          NONE
Token refresh retry:         NONE
api.ts error handling:       throw new Error (no 401-specific path)
storageService.ts on 401:    returns empty array (silent failure)

# Loading/Error/Empty state coverage
HAS_ALL_3:   4/15 (AccountingPortal, SafetyView, Dashboard, QuoteManager)
HAS_SOME:   10/15 (IntelligenceHub, LoadList, CommandCenterView, Settlements,
                    BrokerManager, NetworkPortal, DriverMobileHome, IFTAManager,
                    FileVault, BookingPortal)
HAS_NONE:    1/15 (CommsOverlay)

# setTimeout leaks (no cleanup on unmount)
IntelligenceHub.tsx:    14 instances
CommandCenterView.tsx:   4 instances
CompanyProfile.tsx:      4 instances
AccountingPortal.tsx:    2 instances (via showFeedback helper)
BookingPortal.tsx:       2 instances
SafetyView.tsx:          1 instance
Settlements.tsx:         1 instance
Total:                  27+ instances across 7 components

# Stale closure
App.tsx: refreshData useCallback has empty deps — references stale companyId

# AbortController usage
With AbortController:    2 services (apiHealth.ts, ocrService.ts)
Without AbortController: ALL other fetch calls (api.ts, storageService.ts, etc.)

# Forms inventory
Total forms:            15 form-heavy components
Double-submit protected: Auth login + EditLoadForm (locked) = 2/15
Proper validation:      Auth/Signup only = 1/15
Proper <label> elements: ~40% of forms
```

### Per-Component Validation Protocol

**Every story that modifies a component MUST run these checks before marking complete:**

1. **Unit tests pass**: `npx vitest run src/__tests__/components/<ComponentName>` (if test file exists)
2. **TypeScript clean**: `npx tsc --noEmit 2>&1 | grep '<ComponentName>' | wc -l` returns 0
3. **No regressions**: Full `npx vitest run` passes at story end
4. **Playwright spot-check** (for any component rendered as a page): Navigate to the route, take screenshot, verify no console errors via `playwright_console_logs`
5. **Grep verification**: Run the story-specific grep checks listed in "Done When"

This protocol is referenced as **VPC** (Validate Per Component) throughout the plan.

---

## Operational Safeguards — Drift Prevention & Quality Gates

These safeguards are **mandatory** for Ralph orchestration. Each one addresses a specific drift risk identified during plan review.

### 1. Component Manifest (Collision Detection)

**When**: Before Wave 1 starts (Ralph must run this as the FIRST action of the sprint).
**What**: Generate a snapshot of every component's line count and last-modified git timestamp.
**How**:
```bash
# Generate manifest — run from project root
for f in src/components/*.tsx; do
  lines=$(wc -l < "$f")
  modified=$(git log -1 --format='%ai' -- "$f" 2>/dev/null || echo 'untracked')
  echo "$f|$lines|$modified"
done > .claude/docs/component-manifest.txt
```
**After each wave**: Re-run the manifest and diff against the previous version. If any file changed that was NOT in the current wave's `scope` array in prd.json, **stop and investigate** before proceeding. Log the discrepancy in the wave's verification story.

**Ralph instruction**: At the start of each verification story (H-206, H-304, H-404, H-505, H-604, H-703, H-804, H-904), the agent MUST:
1. Regenerate the manifest
2. Diff against `.claude/docs/component-manifest.txt`
3. Flag any out-of-scope file changes
4. Update the manifest for the next wave

### 2. Mid-Sprint Re-Audit Gate (Before Wave 4)

**When**: After Wave 3 verification (H-404) passes, BEFORE starting any Wave 4 story.
**What**: Re-scan all 54 components for the accessibility patterns Wave 4 targets (`<input>` without labels, icon-only `<button>` without `aria-label`, heading hierarchy). Waves 1-3 will have modified most components — the counts from the original audit may be stale.
**How**:
```bash
# Quick a11y re-scan — run after H-404 passes
echo "=== Inputs without labels ==="
grep -rn '<input' src/components/ --include='*.tsx' | grep -v 'aria-label' | grep -v 'htmlFor' | wc -l

echo "=== Icon-only buttons without aria-label ==="
grep -rn '<button' src/components/ --include='*.tsx' | grep -v 'aria-label' | grep -v '>[A-Za-z]' | wc -l

echo "=== Heading jumps (h2 followed by h4+) ==="
grep -rn '<h[1-6]' src/components/ --include='*.tsx' | sort | head -30
```
**Output**: Write results to `.claude/docs/wave4-rescan.md`. Update H-501/H-502/H-506/H-507 scope arrays in prd.json if component structure changed (new files added, files renamed, files merged).

**Ralph instruction**: Ralph MUST insert a synthetic "re-audit" step between H-404 completion and H-501 dispatch. This is NOT a new story — it's a 5-minute gate check built into the orchestrator flow. If the re-scan reveals significant drift (>20% change in pattern counts), Ralph should flag the user before proceeding with Wave 4.

### 3. Turn Budget Tracking

**When**: After every story completes.
**What**: Record actual turns used vs budgeted `maxTurns`. Track the ratio to detect stories running hot.
**How**: Ralph records `{storyId, maxTurns, actualTurns, ratio}` in `.claude/docs/turn-budget.json` after each story.

**Escalation thresholds**:
- **ratio > 0.8** (used 80%+ of budget): Log a warning. Future stories of the same `complexity` rating should be monitored.
- **ratio > 0.95** (nearly exhausted): Flag to user. Consider splitting remaining stories of equal or higher complexity.
- **3 consecutive stories hitting ratio > 0.8**: Circuit breaker — Ralph pauses and asks user whether to continue, split stories, or increase `maxTurns` for remaining stories.

**Ralph instruction**: After each `RALPH_STORY_RESULT`, compute and append the turn ratio to the tracking file. Check the 3-story rolling average before dispatching the next story.

### 4. Staging Gates for Waves 7-8

**When**: During Wave 7 (Notifications) and Wave 8 (FMCSA/Scanner) verification stories.
**What**: Distinguish between "CI-passed" (unit tests pass, TypeScript clean) and "staging-verified" (actually tested against external service or realistic mock).
**How**: Each Wave 7-8 story's verification adds two fields to prd.json:
```json
{
  "ciPassed": true,
  "stagingVerified": false,
  "stagingNotes": "SMTP not configured — email delivery tested via mocked transport only. Requires Ethereal Email staging test before production deploy."
}
```

**Stories requiring staging verification**:
| Story | External Dependency | Staging Requirement |
|-------|-------------------|-------------------|
| H-801 | SMTP server | Test with Ethereal Email (smtp.ethereal.email) — verify actual email captured |
| H-802 | Database + SMTP | Seed test certs with known expiry dates, verify notification jobs created |
| H-901 | FMCSA SAFER API | Test with real USDOT number (e.g., `2233541` = known carrier) — verify response parsing |
| H-902 | Browser camera API | Manual test on mobile device — cannot be automated via Playwright |

**Ralph instruction**: Wave 7-8 verification stories (H-804, H-904) MUST set `stagingVerified: false` and populate `stagingNotes` with what remains. These stories should NOT be marked as fully production-ready — they are CI-ready only. The user decides when to run staging verification.

---

## Wave 1: Crash-Proofing (API Data Resilience + Stability) — DONE

> All 6 stories (H-201 through H-206) PASSED with QA receipts verified.

**Objective**: Eliminate all HIGH-risk crash patterns and memory leaks. After this wave, no component crashes on partial/malformed API data, and no component leaks memory over time.

### Done When
- R-W1-01: Zero unsafe nested property reads (`pickup.city` without `?.`) across all components
- R-W1-02: Zero non-null assertions (`!`) on API data in components
- R-W1-03: All `.map()`, `.filter()`, `.reduce()`, `.forEach()` calls guarded against undefined
- R-W1-04: All `Object.entries/keys/values` calls guarded against null/undefined
- R-W1-05: Zero unmanaged `setTimeout` calls (all wrapped with cleanup)
- R-W1-06: App.tsx stale closure in refreshData fixed
- R-W1-07: `npx vitest run` passes with >= 3,290 FE tests
- R-W1-08: `cd server && npx vitest run` passes with >= 1,869 BE tests

### H-201: Fix Unsafe Nested Property Access — Top 10 Components
**Requirement IDs**: R-W1-01
**Agent**: Frontend
**Parallel Group**: 1A

Add optional chaining (`?.`) to all unsafe nested property reads across the 10 most-affected components. Add fallback defaults where values are rendered in JSX (e.g., `?? ''` for strings, `?? 0` for numbers).

**Files**: AnalyticsDashboard.tsx, CalendarView.tsx, CustomerPortalView.tsx, DriverMobileHome.tsx, GlobalMapView.tsx, GlobalMapViewEnhanced.tsx, Intelligence.tsx, LoadBoardEnhanced.tsx, LoadList.tsx, SafetyView.tsx

**Pattern**: `load.pickup.city` → `load.pickup?.city ?? ''`
**Pattern**: `load.dropoff.state` → `load.dropoff?.state ?? ''`
**Anti-pattern to avoid**: Don't add `?.` to property definitions, setters, or imports — only to data reads from API objects.

**Done When**:
- R-W1-01a: For each file, verify: all `pickup.` and `dropoff.` reads on API data use `?.` — manually review each file's diff, not just grep (grep produces false positives on setter names like `setPickup`)
- R-W1-01b: Spot-verify by reading 3 files and confirming no unguarded nested reads remain
- VPC for each modified component

### H-202: Fix Unsafe Nested Property Access — Remaining 7 Components
**Requirement IDs**: R-W1-01
**Agent**: Frontend
**Parallel Group**: 1A

Same pattern as H-201 for remaining components with unsafe nested access.

**Files**: ExportModal.tsx, OperationalMessaging.tsx, QuoteManager.tsx, Settlements.tsx, CommandCenterView.tsx, BookingPortal.tsx, IntelligenceHub.tsx

**Done When**:
- R-W1-01c: Same verification as H-201 for all listed files
- VPC for each modified component

### H-203: Remove Non-null Assertions on API Data
**Requirement IDs**: R-W1-02
**Agent**: Frontend
**Parallel Group**: 1A

Replace all `!` (non-null assertion operator) on potentially-null API data with safe alternatives. Use optional chaining, nullish coalescing, or early-return guard clauses.

**Files + Exact Instances**:
- BookingPortal.tsx (5): `company!`, `selectedBroker!.name`, `quote.pickup!`, `quote.dropoff!`, `quote.validUntil!`
- IntelligenceHub.tsx (1): `req.loadId!`
- NetworkPortal.tsx (6): `formData.vendorProfile!`, `formData.id!` (multiple occurrences)
- OperationalMessaging.tsx (1): `callSession!.id`
- CompanyProfile.tsx (2): `company.governance!`

**Replacement strategies**:
- Spread assertions (`...quote.pickup!`) → guard clause: `if (!quote.pickup) return;` then `...quote.pickup`
- Property read (`company!.name`) → `company?.name ?? ''`
- Assignment (`formData.id!`) → `formData.id ?? ''`

**Done When**:
- R-W1-02a: `grep -Pn '\w+!\.' <file>` returns 0 matches for each file (Perl regex catches word followed by `!.`)
- R-W1-02b: No `as any` casts added to replace assertions — fix the actual type
- VPC for each modified component

### H-204: Guard All Array/Object Method Calls
**Requirement IDs**: R-W1-03, R-W1-04
**Agent**: Frontend
**Parallel Group**: 1B

Add null guards to all unguarded `.map()`, `.filter()`, `.reduce()`, `.forEach()`, `Object.entries()`, `Object.keys()`, `Object.values()` calls on potentially-undefined data.

**Strategy**:
- Array methods: `(array ?? []).map()` or `array?.map() ?? []`
- Object methods: `Object.entries(obj ?? {})`
- Push calls: guard with `if (array)` or initialize array first
- Where arrays come from API response destructuring, add `= []` default at the destructure point

**Key Files** (by instance count):
- IntelligenceHub.tsx (35+ instances)
- ExceptionConsole.tsx (15+ instances)
- Dashboard.tsx (8+ instances)
- AccountingPortal.tsx (standardize remaining)
- IFTAEvidenceReview.tsx (3 instances on `analysis.jurisdictionMiles`)
- CommandCenterView.tsx (`active360Data.vaultDocs.map()`, `timeline.push()`)
- Intelligence.tsx (12+ instances)
- NetworkPortal.tsx (10+ instances)
- LoadBoardEnhanced.tsx (10+ instances)

**Done When**:
- R-W1-03a: Read each modified file — confirm no `.map()`, `.filter()`, `.reduce()`, `.forEach()` is called on a variable that could be undefined without a guard
- R-W1-04a: Read each modified file — confirm no `Object.entries/keys/values()` is called on a variable that could be null without `?? {}`
- VPC for each modified component

### H-205: Fix All setTimeout Memory Leaks + Stale Closure
**Requirement IDs**: R-W1-05, R-W1-06
**Agent**: Frontend
**Parallel Group**: 1B

**Part A — setTimeout leaks**: Create `hooks/useAutoFeedback.ts` — a reusable hook that manages a feedback message + auto-clear timer with proper cleanup on unmount. Replace all raw `setTimeout(() => setFeedback(null), N)` patterns.

Hook signature:
```tsx
function useAutoFeedback(duration = 3000): {
  feedback: string | null;
  showFeedback: (msg: string) => void;
  clearFeedback: () => void;
}
```

**Files + Instance Counts**:
- IntelligenceHub.tsx: 14 instances
- CommandCenterView.tsx: 4 instances
- CompanyProfile.tsx: 4 instances
- AccountingPortal.tsx: 2 instances
- BookingPortal.tsx: 2 instances
- SafetyView.tsx: 1 instance
- Settlements.tsx: 1 instance

**Part B — Stale closure**: Fix `App.tsx` `refreshData` useCallback — add `companyId` (and any other referenced state) to the dependency array so the callback doesn't close over a stale value.

**Done When**:
- R-W1-05a: `hooks/useAutoFeedback.ts` exists with unit tests covering: show message, auto-clear after duration, cleanup on unmount
- R-W1-05b: No raw `setTimeout(() => set...null` patterns remain in any component listed above — verify by reading each file
- R-W1-06a: `App.tsx` refreshData useCallback deps include companyId
- VPC for each modified component

### H-206: Wave 1 Verification
**Requirement IDs**: R-W1-01 through R-W1-08
**Agent**: QA
**Parallel Group**: 1C (depends on 1A + 1B)

Full regression + Playwright spot-check of the 5 most-affected components.

**Done When**:
- `npx vitest run` — all FE tests pass (>= 3,290)
- `cd server && npx vitest run` — all BE tests pass (>= 1,869)
- `npx tsc --noEmit` — 0 errors
- Playwright: Navigate to Dashboard, Load Board, Accounting, Intelligence Hub, Operations Center — all render, `playwright_console_logs(type: "error")` returns 0 uncaught exceptions
- Manually verify 3 components (IntelligenceHub, BookingPortal, CommandCenterView) by reading the diff and confirming all unsafe patterns fixed

---

## Wave 2: Session & Mutation Safety — DONE

> All 4 stories (H-301 through H-304) PASSED with QA receipts verified.

**Objective**: Prevent silent data loss from auth expiry and duplicate submissions. After this wave, users get clear feedback when their session expires and cannot accidentally create duplicate records.

### Done When
- R-W2-01: Global 401/403 interceptor catches auth failures in api.ts
- R-W2-02: SessionExpiredModal component exists and renders on 401
- R-W2-03: All write-flow forms have `disabled={isSubmitting}` on submit buttons
- R-W2-04: All write-flow forms show success/error feedback
- R-W2-05: `npx vitest run` passes with >= previous count
- R-W2-06: `cd server && npx vitest run` passes

### H-301: Global 401/403 Interceptor + Session Expired Modal
**Requirement IDs**: R-W2-01, R-W2-02
**Agent**: Frontend
**Parallel Group**: 2A

**Changes**:
1. **api.ts** — Add status-specific handling in `apiFetch()`:
   - On 401: Emit custom event `auth:session-expired`. Do NOT retry — Firebase token auto-refresh should have prevented this, so 401 means session is truly dead.
   - On 403: Throw a typed `ForbiddenError` so components can show "permission denied" instead of generic error.
   - Remove silent catch-and-return-empty patterns in storageService.ts that mask 401s.
2. **components/ui/SessionExpiredModal.tsx** — New component:
   - Modal with lock icon, "Your session has expired" heading, "Please sign in again" body
   - "Sign In" button calls `logout()` and redirects to login
   - `role="alertdialog"`, `aria-modal="true"`, focus trapped
   - Renders above everything (z-50)
3. **App.tsx** — Listen for `auth:session-expired` event on window, set state to show SessionExpiredModal.

**Changes Table**:

| Action | File | Description | Test File |
|--------|------|-------------|----------|
| MODIFY | services/api.ts | Add 401 session-expired event + ForbiddenError class | src/__tests__/services/api.interceptor.test.ts |
| CREATE | components/ui/SessionExpiredModal.tsx | New alertdialog modal with aria-modal | src/__tests__/components/ui/SessionExpiredModal.test.tsx |
| MODIFY | App.tsx | Listen for session-expired event, render modal | src/__tests__/components/ui/SessionExpiredModal.test.tsx |
| MODIFY | services/storageService.ts | Re-throw auth errors instead of silent empty array | .claude/hooks/tests/test_r_w2_01.py |
| CREATE | src/__tests__/services/api.interceptor.test.ts | Vitest tests for 401/403 interceptor | .claude/hooks/tests/test_r_w2_01.py |
| CREATE | src/__tests__/components/ui/SessionExpiredModal.test.tsx | Vitest tests for SessionExpiredModal | .claude/hooks/tests/test_r_w2_01.py |

**Edge cases to handle**:
- Multiple 401s fire simultaneously (only show modal once — use a flag)
- User has unsaved form data → modal warns "unsaved changes will be lost" (best-effort, not blocking)

**Done When**:
- R-W2-01a: `apiFetch()` detects 401 and emits `auth:session-expired` event
- R-W2-01b: `apiFetch()` detects 403 and throws `ForbiddenError`
- R-W2-01c: storageService.ts no longer returns empty arrays on auth errors — it lets the error propagate
- R-W2-02a: SessionExpiredModal renders with `role="alertdialog"` and `aria-modal="true"`
- R-W2-02b: Clicking "Sign In" calls logout and navigates to login
- R-W2-02c: Multiple rapid 401s only show one modal
- Unit tests: 401 triggers event, 403 throws ForbiddenError, modal renders, button calls logout
- VPC for api.ts, storageService.ts, App.tsx, SessionExpiredModal

### H-302: Double-Submit Protection on All Write Forms
**Requirement IDs**: R-W2-03
**Agent**: Frontend
**Parallel Group**: 2A

Add `isSubmitting` state + `disabled={isSubmitting}` to submit buttons on all unprotected forms. Button text must change during submission (e.g., "Save" → "Saving...").

**Forms to fix** (currently unprotected — 13 total):
1. AccountingBillForm.tsx — Save button
2. BrokerManager.tsx — Add Chassis, Save Broker buttons
3. CompanyProfile.tsx — Permission toggles (add debounce), Save Changes button
4. OperationalMessaging.tsx — Send Message button (no rapid-click protection)
5. DataImportWizard.tsx — Dry Run button, Confirm Import button
6. NetworkPortal.tsx — Wizard submit, Quick Vendor/Equipment modals
7. IFTAManager.tsx — Save Mileage (has field check but no button disable)
8. BolGenerator.tsx — Save BOL (has sig check but no submit disable)
9. QuoteManager.tsx — Save Quote, Convert Quote buttons
10. LoadSetupModal.tsx — Continue button (verify existing protection is complete)
11. BookingPortal.tsx — Convert to Booking (chains 3 async calls without disable)
12. SafetyView.tsx — Asset registration, maintenance record, quiz result save
13. EditUserModal.tsx — Save button (verify existing protection)

**Pattern**:
```tsx
const [isSubmitting, setIsSubmitting] = useState(false);
const handleSubmit = async () => {
  setIsSubmitting(true);
  try { await saveData(); showSuccess(); }
  catch (e) { showError(e); }
  finally { setIsSubmitting(false); }
};
<button disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</button>
```


**Changes Table**:

| Action | File | Description | Test File |
|--------|------|-------------|----------|
| MODIFY | components/AccountingBillForm.tsx | Add isSubmitting state + try/finally to Save button | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/BrokerManager.tsx | Add isSubmitting state + try/finally to Add Chassis/Save Broker buttons | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/CompanyProfile.tsx | Add isSubmitting state + try/finally to Save Changes button | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/OperationalMessaging.tsx | Add isSubmitting + try/finally to Send Message button | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/DataImportWizard.tsx | Add isSubmitting + try/finally to Dry Run and Confirm Import buttons | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/NetworkPortal.tsx | Add isSubmitting + try/finally to wizard submit and quick modals | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/IFTAManager.tsx | Add isSubmitting + try/finally to Save Mileage button | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/BolGenerator.tsx | Add isSubmitting + try/finally to Save BOL button | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/QuoteManager.tsx | Add isSubmitting + try/finally to Save Quote and Convert Quote buttons | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/LoadSetupModal.tsx | Verify and complete isSubmitting protection on Continue button | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/BookingPortal.tsx | Add try/finally + setLoading(false) to Convert to Booking | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/SafetyView.tsx | Add isSubmitting + try/finally to asset registration and maintenance forms | .claude/hooks/tests/test_r_w2_03.py |
| MODIFY | components/EditUserModal.tsx | Verify and complete isSubmitting protection on Save button | .claude/hooks/tests/test_r_w2_03.py |
| CREATE | .claude/hooks/tests/test_r_w2_03.py | Python QA tests for R-W2-03a/b/c and VPC-302 | .claude/hooks/tests/test_r_w2_03.py |

**Done When**:
- R-W2-03a: Every submit/save button in every listed form has `disabled={isSubmitting}` or equivalent
- R-W2-03b: Every submit button shows loading text ("Saving...", "Sending...", "Creating...") during submission
- R-W2-03c: Read each modified file to confirm the try/finally pattern (setIsSubmitting(false) in finally, not just in then)
- VPC for each modified component

### H-303: Consistent Success/Error Feedback on Write Flows
**Requirement IDs**: R-W2-04
**Agent**: Frontend
**Parallel Group**: 2B

Ensure all write operations show clear feedback using existing Toast component for success, and inline error messages or Toast for failures. No silent failures.

**Forms with missing/silent feedback** (cross-referenced with H-302 list):
- AccountingBillForm.tsx — No success/error feedback (completely silent)
- BrokerManager.tsx — No visual feedback on chassis add/remove, no error on save fail
- CompanyProfile.tsx — Permission toggle silently ignores API errors
- OperationalMessaging.tsx — Send message has toast but notes/tasks are silent
- DataImportWizard.tsx — Silent on parse errors, no success on complete
- NetworkPortal.tsx — Toast for errors but no success confirmation
- SafetyView.tsx — Uses showFeedback helper but verify complete coverage

**Changes Table**:

| Action | File | Description | Test File |
|--------|------|-------------|-----------|
| MODIFY | components/AccountingBillForm.tsx | Add Toast on submit success and error | .claude/hooks/tests/test_r_w2_04.py |
| MODIFY | components/BrokerManager.tsx | Add Toast on save success and error | .claude/hooks/tests/test_r_w2_04.py |
| MODIFY | components/CompanyProfile.tsx | Add error catch to handleSaveCompany, handleClockIn, handleClockOut | .claude/hooks/tests/test_r_w2_04.py |
| MODIFY | components/OperationalMessaging.tsx | Add success toast to send message; wrap handleCreateTask in try/catch | .claude/hooks/tests/test_r_w2_04.py |
| MODIFY | components/DataImportWizard.tsx | Add Toast on import success and error | .claude/hooks/tests/test_r_w2_04.py |
| MODIFY | components/NetworkPortal.tsx | Add success toast to handleSave | .claude/hooks/tests/test_r_w2_04.py |
| MODIFY | components/SafetyView.tsx | Add console.error to inner catch blocks | .claude/hooks/tests/test_r_w2_04.py |

**Done When**:
- R-W2-04a: Every form submit in H-302's list shows either success toast or error message
- R-W2-04b: Read each modified file — confirm no catch block silently ignores errors (no empty catch, no catch-and-return-empty)
- VPC for each modified component

### H-304: Wave 2 Verification
**Requirement IDs**: R-W2-01 through R-W2-06
**Agent**: QA
**Parallel Group**: 2C (depends on 2A + 2B)

**Done When**:
- `npx vitest run` — all FE tests pass
- `cd server && npx vitest run` — all BE tests pass
- `npx tsc --noEmit` — 0 errors
- Playwright: Navigate to Accounting, Broker Manager, Company Profile — take screenshots, verify no console errors
- Playwright: Verify SessionExpiredModal renders (if testable via mock)
- Read H-301 diff and confirm 401/403 handling in api.ts

**Changes Table**:

| Action | File | Description | Test File |
|--------|------|-------------|-----------|
| ADD | .claude/hooks/tests/test_r_w2_304.py | Wave 2 verification test: FE/BE counts, SessionExpiredModal, VPC checks | test_r_w2_304.py |
| MODIFY | .claude/docs/PLAN.md | Add Changes Table to H-304 section for plan conformance check | test_r_w2_304.py |

---

## Wave 3: UX Consistency (Validation + Loading/Error/Empty States) — IN PROGRESS
> **Status**: H-401 not started. H-402 code committed (QA pending). H-403 not started. H-404 blocked on deps.

**Objective**: Standardize form validation and ensure every data-fetching component has proper loading, error, and empty states. After this wave, users always know what's happening.

### Done When
- R-W3-01: All forms with required fields have inline validation messages
- R-W3-02: All 15 major components have LoadingSkeleton while fetching
- R-W3-03: All 15 major components have ErrorState with retry on fetch failure
- R-W3-04: All 15 major components have meaningful empty states
- R-W3-05: All password inputs have `autocomplete` attribute
- R-W3-06: Tests pass

### H-401: Form Validation Standardization
**Requirement IDs**: R-W3-01, R-W3-05 | **Carry-forward from**: old STORY-023 (partial — Auth/CompanyProfile/EditLoadForm done, rest remaining)
**Agent**: Frontend
**Parallel Group**: 3A

Add inline validation to all forms that accept user input. Required fields show red asterisk + error message on blur or submit. Also add `autocomplete` attributes to all password/email inputs.

**Already done** (from old STORY-202): Auth.tsx, CompanyProfile.tsx, EditLoadForm.tsx have basic validation.

**Forms needing validation** (prioritized by data integrity risk):

| # | Component | Key Validations Needed |
|---|-----------|----------------------|
| 1 | AccountingBillForm.tsx | Amount > 0, vendor required, due date >= bill date |
| 2 | IFTAManager.tsx | State code in US states list, miles > 0, date not future |
| 3 | EditUserModal.tsx | Email format, pay rate >= 0, name required |
| 4 | BrokerManager.tsx | Prefix format (alphanumeric), provider required for chassis |
| 5 | OperationalMessaging.tsx | Message non-empty (has trim check, add visual error) |
| 6 | DataImportWizard.tsx | All required target columns mapped before dry run |
| 7 | BookingPortal.tsx | Pickup/dropoff city+state required, rate > 0 |
| 8 | BolGenerator.tsx | Time format HH:MM, driver signature required (already checked but add visual) |
| 9 | LoadSetupModal.tsx | Broker required (already enforced), call notes max 500 chars |
| 10 | QuoteManager.tsx | Rate required, pickup/dropoff city required |
| 11 | NetworkPortal.tsx | Onboarding wizard: company name, contact email format |
| 12 | SafetyView.tsx | Asset: VIN format, maintenance: date + description required |

**Validation pattern** (consistent across all forms):
```tsx
// Field-level: red border + error text
<div>
  <label htmlFor="amount">Amount *</label>
  <input id="amount" className={errors.amount ? 'border-red-500' : 'border-slate-700'} />
  {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
</div>
```

**Done When**:
- R-W3-01a: Each listed form validates required fields before submit — submit handler checks and sets errors state
- R-W3-01b: Each listed form shows inline error messages below invalid fields
- R-W3-01c: All `<input type="password">` have `autocomplete="current-password"` or `autocomplete="new-password"`
- R-W3-01d: All `<input type="email">` validate format on blur and show error
- VPC for each modified component

### H-402: Loading/Error/Empty States — Batch 1 (6 Components)
**Requirement IDs**: R-W3-02, R-W3-03, R-W3-04 | **Carry-forward from**: old STORY-022
**Agent**: Frontend
**Parallel Group**: 3A

Add all 3 states to the first batch of components. Use existing `LoadingSkeleton` and `ErrorState` from `components/ui/`. Check if `EmptyState.tsx` exists — if not, create it with icon, heading, description, and optional CTA button.

**Components**:
| Component | Needs Loading | Needs Error | Needs Empty |
|-----------|:---:|:---:|:---:|
| CommsOverlay | YES | YES | YES |
| LoadList | YES | YES | has partial |
| CommandCenterView | YES | YES | has partial |
| Settlements | YES | YES | has partial |
| BrokerManager | YES | YES | YES |
| NetworkPortal | YES | YES | has partial |

**Pattern for each component**:
```tsx
if (isLoading) return <LoadingSkeleton variant="table" />;
if (loadError) return <ErrorState message={loadError} onRetry={loadData} />;
if (items.length === 0) return <EmptyState icon={<Package />} title="No loads found" action={...} />;
```

**Done When**:
- R-W3-02a: Each component shows LoadingSkeleton during initial data fetch
- R-W3-03a: Each component shows ErrorState with "Retry" button on fetch failure
- R-W3-04a: Each component shows meaningful empty state (icon + text + optional CTA)
- VPC for each modified component (including Playwright spot-check for page-level components)

### H-403: Loading/Error/Empty States — Batch 2 (5 Components)
**Requirement IDs**: R-W3-02, R-W3-03, R-W3-04
**Agent**: Frontend
**Parallel Group**: 3B

Same pattern as H-402 for remaining components.

**Components**:
| Component | Needs Loading | Needs Error | Needs Empty |
|-----------|:---:|:---:|:---:|
| DriverMobileHome | YES | YES | has partial |
| IFTAManager | has partial | YES | YES |
| FileVault | has partial | YES | has partial |
| BookingPortal | has partial | YES | has partial |
| IntelligenceHub | has partial | has partial | YES |

**Done When**: Same criteria as H-402. VPC for each.

### H-404: Wave 3 Verification
**Requirement IDs**: R-W3-01 through R-W3-06
**Agent**: QA
**Parallel Group**: 3C (depends on 3A + 3B)

**Done When**:
- `npx vitest run` — all FE tests pass
- `cd server && npx vitest run` — all BE tests pass
- `npx tsc --noEmit` — 0 errors
- Playwright: Navigate to all 15 major pages — verify no blank screens (every page shows either data, loading, or empty state)
- Playwright: `playwright_console_logs(type: "error")` returns 0 uncaught exceptions
- Spot-check: Read 3 form components and verify validation pattern is consistent

---

## Wave 4: Accessibility & Permission UX — IN PROGRESS
> **Status**: H-501 code committed (QA pending). H-503 not started. H-504 code committed (QA pending). H-506 code committed (QA pending). H-502/H-507/H-505 blocked on deps.

**Objective**: Fix accessibility fundamentals (labels, aria, focus, heading hierarchy) and add permission explanation UX. After this wave, screen readers work and users understand why features are restricted.

### Done When
- R-W4-01: All form inputs have associated `<label>` elements or `aria-label`
- R-W4-02: All icon-only buttons have `aria-label`
- R-W4-03: Modal dialogs trap focus (tab cannot escape to background)
- R-W4-04: Disabled role-gated buttons show tooltip/title explaining "why"
- R-W4-05: Heading hierarchy is consistent (no skipped levels, e.g., H2→H4)
- R-W4-06: Tests pass

### H-501: Form Labels & Input Accessibility — Batch 1 (Form-Heavy Components)
**Requirement IDs**: R-W4-01
**Agent**: Frontend
**Parallel Group**: 4A

Add `<label htmlFor="...">` or `aria-label` to every form input that currently uses placeholder-only. Audit Q10 gave form labels an **F grade** — this is the single biggest accessibility fix.

**Approach**:
- For inputs with visible text above them: wrap or link via `<label htmlFor="inputId">`
- For inputs where visible labels break layout (e.g., search bars, inline filters): use `aria-label`
- Add `id` attributes to inputs that lack them (needed for `htmlFor` binding)

**Scope — Batch 1** (15 form-heavy components with the most `<input>`/`<select>`/`<textarea>` elements):
Auth.tsx, CompanyProfile.tsx, EditLoadForm.tsx, AccountingBillForm.tsx, EditUserModal.tsx, BrokerManager.tsx, IFTAManager.tsx, DataImportWizard.tsx, LoadSetupModal.tsx, BolGenerator.tsx, QuoteManager.tsx, BookingPortal.tsx, NetworkPortal.tsx, SafetyView.tsx, OperationalMessaging.tsx

**Done When**:
- R-W4-01a: Every `<input>` in Batch 1 components has either a matching `<label htmlFor>` or an `aria-label` attribute
- R-W4-01b: Every `<select>` in Batch 1 has a label
- R-W4-01c: Every `<textarea>` in Batch 1 has a label
- VPC for modified components

### H-502: Icon Button Accessibility + Heading Hierarchy — Batch 1 (Top 15 Components)
**Requirement IDs**: R-W4-02, R-W4-05
**Agent**: Frontend
**Parallel Group**: 4A-seq (runs AFTER H-501 completes — both touch overlapping components)

**Part A — Icon buttons**: Add `aria-label` to icon-only buttons in the top 15 components by icon button count. These are `<button>` elements containing only a lucide-react icon with no visible text.

**Scope — Batch 1**: IntelligenceHub.tsx, CommandCenterView.tsx, Dashboard.tsx, AccountingPortal.tsx, LoadBoardEnhanced.tsx, QuoteManager.tsx, BookingPortal.tsx, NetworkPortal.tsx, SafetyView.tsx, BrokerManager.tsx, Settlements.tsx, IFTAManager.tsx, CompanyProfile.tsx, ExportModal.tsx, FileVault.tsx

**Pattern**: `<button onClick={...}><X size={16} /></button>` → `<button onClick={...} aria-label="Close"><X size={16} /></button>`

Common icon buttons to find: close (X), delete (Trash2), edit (Pencil), expand (ChevronDown), refresh (RefreshCw), filter (Filter), sort (ArrowUpDown), menu (Menu).

**Part B — Heading hierarchy**: Fix inconsistent heading nesting in Batch 1 components. Ensure no H2→H4 jumps (must go H2→H3→H4). Audit Q10 gave heading hierarchy a **D grade**.

**Done When**:
- R-W4-02a: All icon-only buttons in Batch 1 components have descriptive `aria-label`
- R-W4-05a: Heading elements in Batch 1 follow sequential order (H1→H2→H3) — no skipped levels
- VPC for modified components

### H-503: Focus Trap for Modal Dialogs
**Requirement IDs**: R-W4-03
**Agent**: Frontend
**Parallel Group**: 4B

Add focus trap to modal dialogs so tab key cycles within the modal instead of escaping to background content.

**Approach**: Create `hooks/useFocusTrap.ts` that:
- On mount: finds all focusable elements in the container
- On Tab: cycles focus within the modal
- On Shift+Tab: cycles backwards
- On Escape: closes the modal

**Modals to apply focus trap**:
- ConfirmDialog.tsx (shared)
- InputDialog.tsx (shared)
- EditUserModal.tsx
- LoadSetupModal.tsx
- ExportModal.tsx
- SessionExpiredModal.tsx (created in H-301)

Other modals (inline in large components like QuoteManager, CommandCenterView) should use the hook when the modal state is active.

**Done When**:
- R-W4-03a: Tab key cycles within open ConfirmDialog/InputDialog (test with unit test simulating keyboard events)
- R-W4-03b: Escape key closes modal (already works for some, verify all)
- R-W4-03c: `useFocusTrap` hook has unit tests
- VPC for each modified modal component

### H-504: Permission Explanation UX
**Requirement IDs**: R-W4-04
**Agent**: Frontend
**Parallel Group**: 4B

Add tooltip or title text to disabled buttons/sections that explain why the action is restricted. Add info banner when a role-gated section is view-only.

**Key locations** (from audit — 18 components implement role checks):
- IssueSidebar.tsx — empty array for unmapped roles → add "No actions available for your role"
- CompanyProfile.tsx — Save disabled for non-admin → add `title="Only administrators can save changes"`
- EditLoadForm.tsx — locked state → add lock icon + "This load is locked for editing"
- Dashboard.tsx — admin-only features → tooltip on disabled buttons
- AccountingPortal.tsx — role-gated tabs → tooltip if user lacks permission
- LoadList.tsx — delete/archive buttons → tooltip for non-admin

**Pattern**: `<button disabled={!isAdmin} title={!isAdmin ? "Admin access required" : undefined}>Delete</button>`

**Done When**:
- R-W4-04a: Every disabled button that is disabled due to role restrictions has explanatory `title` or `aria-label`
- R-W4-04b: At least one section-level info banner exists (e.g., CompanyProfile operations tab for non-admin)
- VPC for modified components

### H-506: Form Labels & Input Accessibility — Batch 2 (Remaining Components)
**Requirement IDs**: R-W4-01
**Agent**: Frontend
**Parallel Group**: 4A (parallel with H-501)

Same approach as H-501 for the remaining ~15 components with inputs. These are lighter on forms but still need label coverage.

**Scope — Batch 2**: Dashboard.tsx, LoadList.tsx, LoadBoardEnhanced.tsx, CommandCenterView.tsx, IntelligenceHub.tsx, GlobalMapView.tsx, GlobalMapViewEnhanced.tsx, ExceptionConsole.tsx, FileVault.tsx, DriverMobileHome.tsx, Settlements.tsx, CalendarView.tsx, CustomerPortalView.tsx, Intelligence.tsx, AnalyticsDashboard.tsx, CommsOverlay.tsx, IssueSidebar.tsx, EditLoadForm.tsx (verify)

**Done When**:
- R-W4-01d: Every `<input>`, `<select>`, `<textarea>` in Batch 2 components has either `<label htmlFor>` or `aria-label`
- VPC for modified components

### H-507: Icon Button Accessibility + Heading Hierarchy — Batch 2 (Remaining Components)
**Requirement IDs**: R-W4-02, R-W4-05
**Agent**: Frontend
**Parallel Group**: 4A-seq (runs AFTER H-506 completes)

Same approach as H-502 for remaining components.

**Scope — Batch 2**: OperationalMessaging.tsx, DataImportWizard.tsx, BolGenerator.tsx, LoadSetupModal.tsx, EditUserModal.tsx, DriverMobileHome.tsx, CalendarView.tsx, CustomerPortalView.tsx, GlobalMapView.tsx, GlobalMapViewEnhanced.tsx, AnalyticsDashboard.tsx, Intelligence.tsx, ExceptionConsole.tsx, CommsOverlay.tsx, IssueSidebar.tsx, LoadList.tsx, EditLoadForm.tsx

**Done When**:
- R-W4-02b: All icon-only buttons in Batch 2 components have descriptive `aria-label`
- R-W4-05b: Heading elements in Batch 2 follow sequential order — no skipped levels
- VPC for modified components

### H-505: Wave 4 Verification
**Requirement IDs**: R-W4-01 through R-W4-06
**Agent**: QA
**Parallel Group**: 4C (depends on 4A + 4A-seq + 4B)

**Done When**:
- `npx vitest run` — all FE tests pass
- `npx tsc --noEmit` — 0 errors
- Playwright: Navigate to 5 form-heavy pages, verify inputs have labels (inspect HTML)
- Playwright: Tab through a modal, verify focus stays trapped
- Playwright: `playwright_console_logs(type: "error")` returns 0 uncaught exceptions
- All 4 batch stories (H-501, H-502, H-506, H-507) verified — full 54-component coverage confirmed

---

## Wave 5: Mobile Polish & Upload Verification — IN PROGRESS
> **Status**: H-601 not started. H-602 code committed (QA pending). H-603 not started. H-604 blocked on deps.

**Objective**: Fix mobile tap targets, verify file upload flows in browser, and add AbortController for cancellable requests. After this wave, mobile users can tap all buttons and upload flows are proven.

### Done When
- R-W5-01: All interactive elements meet 44px minimum tap target on mobile viewports
- R-W5-02: File upload shows progress indicator
- R-W5-03: File upload shows error state on failure (413, 400, 500)
- R-W5-04: AbortController added to `apiFetch()` for cancellable requests
- R-W5-05: Tests pass

### H-601: Mobile Tap Target Fix
**Requirement IDs**: R-W5-01
**Agent**: Frontend
**Parallel Group**: 5A

Fix submit buttons and interactive elements below 44px tap target minimum (audit found 42px on login button).

**Approach**:
- Add `min-h-[44px] min-w-[44px]` to all `<button>` elements that could appear on mobile
- Apply via a shared Tailwind class or directly on affected elements
- Check: login submit, form submits, modal action buttons, sidebar toggle, tab buttons

**Verification method**: Playwright resize to mobile viewport (390px width), screenshot key pages, measure button heights.

**Done When**:
- R-W5-01a: Login submit button >= 44px height (Playwright: resize to iPhone, screenshot, verify)
- R-W5-01b: Spot-check 5 key forms on mobile viewport — all buttons tappable
- VPC for modified components

### H-602: File Upload UX Verification & Polish
**Requirement IDs**: R-W5-02, R-W5-03 | **Carry-forward from**: old STORY-026 (server route done in STORY-301, UI flows never verified)
**Agent**: Frontend
**Parallel Group**: 5A

The server-side upload route (`POST /api/documents` via Multer) was implemented in the prior plan's STORY-301. The audit (Q9) confirmed endpoints exist but UI proof is missing.

**Tasks**:
1. Read FileVault.tsx — inventory existing upload UI
2. Verify upload flow works end-to-end via Playwright (navigate to FileVault, trigger upload)
3. Add progress indicator (bar or percentage) during upload if missing
4. Add error state for failed uploads (413 size limit, 400 invalid MIME, 500 server error)
5. Add permission-denied upload feedback for non-authorized roles
6. Test duplicate filename behavior
7. Test archive/unarchive UX (if archive button exists)

**Done When**:
- R-W5-02a: Upload shows progress indicator (bar, spinner, or percentage)
- R-W5-03a: Failed upload shows error message with explanation (not silent)
- R-W5-03b: Oversized file (>10MB) shows clear rejection message (carry-forward from old R-S26-02)
- R-W5-03c: Invalid MIME type shows clear rejection message (carry-forward from old R-S26-03)
- Playwright: Navigate to FileVault, verify page renders, verify no console errors
- VPC for FileVault.tsx

### H-603: AbortController for API Requests
**Requirement IDs**: R-W5-04
**Agent**: Frontend
**Parallel Group**: 5B

Add AbortController support to `api.ts` `apiFetch()` function so components can cancel in-flight requests on unmount.

**Changes**:
1. `apiFetch()` accepts optional `signal?: AbortSignal` parameter, passes to `fetch()`
2. The 3 most data-heavy page components create AbortController in useEffect and pass signal to their data fetch calls, with `controller.abort()` in the cleanup return

**Components to wire**:
- Dashboard.tsx (loads + exceptions + multiple aggregations)
- IntelligenceHub.tsx (loads + requests + calls + incidents)
- CommandCenterView.tsx (incidents + work items + timeline)

**Done When**:
- R-W5-04a: `apiFetch()` accepts and forwards `signal` parameter
- R-W5-04b: Dashboard, IntelligenceHub, CommandCenterView pass AbortSignal from useEffect cleanup
- R-W5-04c: Aborting a request does not show an error toast (AbortError is silently caught)
- VPC for api.ts and modified components

### H-604: Wave 5 Verification + Final Audit
**Requirement IDs**: R-W5-01 through R-W5-05
**Agent**: QA
**Parallel Group**: 5C (depends on 5A + 5B)

Final verification. Re-run the 10-question audit checklist to confirm all grades improved.

**Done When**:
- `npx vitest run` — all FE tests pass
- `cd server && npx vitest run` — all BE tests pass
- `npx tsc --noEmit` — 0 errors
- `npm run build` — succeeds, no warnings
- R-W5-BUNDLE: No route chunk exceeds 250KB (excl vendor/xlsx) — verify with `npx vite build 2>&1 | grep -E 'kB|chunk'` (performance regression gate for null-guard + skeleton additions)
- Playwright: Full 15-page navigation sweep — all render, 0 console errors
- Playwright: Mobile viewport (iPhone) — login page, accounting, load list render correctly
- Updated audit scores — no D or F grades remaining

**Expected final grades**:
| Dimension | Before | After |
|-----------|--------|-------|
| API Data Resilience | D | A (all patterns guarded) |
| Long-lived Stability | D | A (all leaks fixed) |
| Auth Expiry | D | B+ (401 interceptor + modal) |
| Write Flow Safety | D+ | B+ (all forms protected) |
| Form Validation | C- | B (all forms have basic validation) |
| Loading/Error/Empty | C- | A (all 15 components covered) |
| Role-Based UX | B+ | A- (tooltips + banners) |
| Accessibility | C+ | B (labels, focus trap, headings) |
| Mobile | B- | B+ (tap targets fixed) |
| File Upload UX | Untested | B (verified + error states) |

---

## Wave 6: File Persistence — Make Uploads Real

> **Parallel execution note**: Wave 6 touches only backend storage + FileVault.tsx and has zero file overlap with Waves 4 (accessibility) or 5 (mobile/upload UX). It depends on Wave 3 completion (H-404), NOT Wave 5 (H-604). Ralph can run Wave 6 in parallel with Waves 4-5 when agents are available.

**Objective**: Replace the no-op `memoryStorageAdapter` with real file persistence. After this wave, uploaded documents survive server restarts and can be downloaded via signed URLs.

### Current State
- `StorageAdapter` interface exists in `server/services/document.service.ts` with `uploadBlob()`, `deleteBlob()`, `getSignedUrl()`
- Both `server/routes/documents.ts` and `server/routes/vault-docs.ts` use a `memoryStorageAdapter` that does **nothing** — `uploadBlob()` is a no-op, `getSignedUrl()` returns `""`
- Multer captures file bytes in memory but they're discarded after the request
- `firebase-admin` v13.6.0 is installed and initialized for Auth + Firestore, but `admin.storage()` is never called
- `@google-cloud/storage` is NOT installed
- Frontend `uploadVaultDoc()` in `services/storage/vault.ts` correctly sends multipart form data to `/api/vault-docs`
- FileVault.tsx renders upload UI and calls the service

### Done When
- R-W6-01: Uploaded files persist to disk or cloud storage and survive server restart
- R-W6-02: `getSignedUrl()` returns a working download URL (not empty string)
- R-W6-03: FileVault upload → download round-trip works end-to-end
- R-W6-04: Tests pass

### H-701: Implement Disk Storage Adapter
**Requirement IDs**: R-W6-01, R-W6-02
**Agent**: Backend
**Parallel Group**: 6A (depends on H-404, NOT H-604 — can run parallel with Waves 4-5)

Create `server/services/disk-storage-adapter.ts` implementing the existing `StorageAdapter` interface. This is the simplest path to real persistence — no external service dependencies.

**Implementation**:
```typescript
// server/services/disk-storage-adapter.ts
export const diskStorageAdapter: StorageAdapter = {
  async uploadBlob(path: string, buffer: Buffer, metadata: Record<string, string>): Promise<void> {
    const fullPath = join(UPLOAD_DIR, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
  },
  async deleteBlob(path: string): Promise<void> {
    await unlink(join(UPLOAD_DIR, path)).catch(() => {});
  },
  async getSignedUrl(path: string, _expiresInMs: number): Promise<string> {
    return `/api/documents/${encodeURIComponent(path)}/download`;
  },
};
```

**Changes**:
1. Create `server/services/disk-storage-adapter.ts` — implements StorageAdapter using `fs.writeFile` to `server/uploads/` directory
2. Create `server/uploads/` directory, add to `.gitignore`
3. Replace `memoryStorageAdapter` with `diskStorageAdapter` in both `vault-docs.ts` and `documents.ts`
4. Add download endpoint that serves files from disk with proper `Content-Disposition: attachment` headers
5. Add `server/uploads/` to `.gitignore`

**Done When**:
- R-W6-01a: `uploadBlob()` writes file to `server/uploads/<tenant>/<filename>`
- R-W6-01b: File exists on disk after upload API call
- R-W6-02a: `getSignedUrl()` returns a URL path that resolves to the download endpoint
- R-W6-02b: Download endpoint returns file with correct MIME type and Content-Disposition header
- Unit tests: upload file → verify file on disk → download → verify content matches
- VPC for documents.ts and vault-docs.ts

### H-702: Wire FileVault Upload-Download Round Trip
**Requirement IDs**: R-W6-03
**Agent**: Frontend
**Parallel Group**: 6A

Verify FileVault.tsx upload and download work end-to-end with the new disk adapter. Fix any missing UI elements (progress indicator, download button).

**Tasks**:
1. Read FileVault.tsx — verify upload calls `uploadVaultDoc()` correctly
2. Verify download links render using the URL from `getSignedUrl()` (no longer empty string)
3. Add download button/link if missing — should call the download endpoint
4. Verify file type icons render correctly for pdf/jpeg/png

**Done When**:
- R-W6-03a: Upload a file via FileVault → file persists on server → appears in document list
- R-W6-03b: Click download on uploaded file → browser downloads the file with correct name
- R-W6-03c: Delete a file → file removed from disk and database
- VPC for FileVault.tsx

### H-703: Wave 6 Verification
**Requirement IDs**: R-W6-01 through R-W6-04
**Agent**: QA
**Parallel Group**: 6B (depends on 6A)

**Done When**:
- `npx vitest run` — all FE tests pass
- `cd server && npx vitest run` — all BE tests pass
- `npx tsc --noEmit` — 0 errors
- Playwright: Navigate to FileVault, verify page renders, verify no console errors
- Manual: upload → list → download round-trip confirmed via API (curl or test)

---

## Wave 7: Notification Delivery — Make Alerts Real — IN PROGRESS
> **Status**: H-801 code committed (QA pending). H-802 code committed (QA pending). H-803/H-804 blocked on deps.

**Objective**: Add actual email delivery to the notification jobs system. After this wave, notification jobs transition from PENDING to SENT, and driver certificate expiry alerts actually fire.

### Current State
- `POST /api/notification-jobs` creates a DB record with `status=PENDING` but never delivers
- No email library installed (no nodemailer, SendGrid, SES)
- No job queue installed (no Bull, Agenda, node-cron)
- No notification preferences UI
- Driver cert expiry alerts depend on this pipeline
- DB table has: `id, company_id, load_id, incident_id, message, channel, status, recipients (JSON)`

### Done When
- R-W7-01: Notification jobs with `channel=email` actually send emails via nodemailer
- R-W7-02: Job status transitions from PENDING → SENT or FAILED with timestamp
- R-W7-03: Driver certificate expiry check runs and creates notification jobs for expiring certs
- R-W7-04: Tests pass

### H-801: Email Delivery Service
**Requirement IDs**: R-W7-01, R-W7-02
**Agent**: Backend
**Parallel Group**: 7A

Install nodemailer. Create `server/services/notification-delivery.service.ts` that processes notification jobs.

**Staging/Testing Note**: Use [Ethereal Email](https://ethereal.email/) for test/staging environments — it captures outbound emails without delivering them. Set `SMTP_HOST=smtp.ethereal.email` with Ethereal credentials in `.env` for non-production. Tests should mock the nodemailer transport, never hit a real SMTP server.

**Implementation**:
1. `npm install nodemailer` + `npm install -D @types/nodemailer` in server/
2. Create `server/services/notification-delivery.service.ts`:
   - `deliverNotification(job: NotificationJob)` — dispatches based on `channel`
   - Email channel: uses nodemailer with SMTP config from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
   - If SMTP not configured: log warning and mark job as FAILED with `sync_error: "SMTP not configured"`
   - SMS channel: mark as FAILED with `sync_error: "SMS not yet implemented"` (honest stub)
3. Modify `POST /api/notification-jobs` to call `deliverNotification()` after DB insert (synchronous for now — no queue needed at this scale)
4. Add `PATCH /api/notification-jobs/:id` to update status (SENT/FAILED)
5. Update DB record: set `status`, `sent_at`, `sync_error` after delivery attempt

**Done When**:
- R-W7-01a: With SMTP configured: `POST /api/notification-jobs` with `channel=email` sends real email
- R-W7-01b: Without SMTP configured: job created with `status=FAILED`, `sync_error="SMTP not configured"`
- R-W7-02a: Job status is SENT (with `sent_at` timestamp) on success
- R-W7-02b: Job status is FAILED (with `sync_error` message) on delivery failure
- Unit tests: mock nodemailer transport → verify `sendMail` called with correct to/subject/body
- Unit tests: no SMTP config → verify job marked FAILED gracefully

### H-802: Driver Certificate Expiry Alerts
**Requirement IDs**: R-W7-03
**Agent**: Backend
**Parallel Group**: 7A

Add a server endpoint or utility that checks for driver certificates expiring within N days and creates notification jobs for each.

**Implementation**:
1. Create `server/services/cert-expiry-checker.ts`:
   - Queries `safety_maintenance` or relevant table for records with expiry dates within 30/14/7 days
   - For each expiring cert: creates a notification job with `channel=email`, `message="Driver certificate [type] expires on [date]"`, `recipients=[company admin email]`
2. Add `GET /api/safety/cert-expiry-check` endpoint that triggers the check manually
3. Optionally: add `node-cron` for daily scheduled checks (if the server runs persistently)

**Done When**:
- R-W7-03a: Endpoint returns list of expiring certificates with days-until-expiry
- R-W7-03b: Each expiring cert creates a notification job in the DB
- R-W7-03c: If SMTP configured, email is actually sent for each expiring cert
- Unit tests: mock DB with 3 certs (expired, 7-day, 60-day) → verify 2 notification jobs created (expired + 7-day)

**Changes Table**:

| Action | File | Description | Test File |
|--------|------|-------------|-----------|
| CREATE | server/services/cert-expiry-checker.ts | Cert expiry checker service with checkExpiring() | server/__tests__/services/cert-expiry-checker.test.ts |
| MODIFY | server/routes/safety.ts | Add GET /api/safety/expiring-certs endpoint | server/__tests__/routes/safety-expiring-certs.test.ts |
| CREATE | server/__tests__/services/cert-expiry-checker.test.ts | Unit tests for checkExpiring() service | server/__tests__/services/cert-expiry-checker.test.ts |
| CREATE | server/__tests__/routes/safety-expiring-certs.test.ts | Route tests for GET /api/safety/expiring-certs | server/__tests__/routes/safety-expiring-certs.test.ts |
| MODIFY | server/__tests__/routes/safety.test.ts | Add cert-expiry-checker mock for existing tests | server/__tests__/routes/safety.test.ts |
| CREATE | .claude/hooks/tests/test_r_w7_03.py | Python QA tests for R-W7-03a/b/c and VPC-802 | .claude/hooks/tests/test_r_w7_03.py |

### H-803: Notification Status in Frontend
**Requirement IDs**: R-W7-02
**Agent**: Frontend
**Parallel Group**: 7B

Update any notification-related UI to show actual delivery status (PENDING/SENT/FAILED) instead of always showing PENDING.

**Tasks**:
1. Check if there's a notification list view — if so, add status badge (green=SENT, red=FAILED, yellow=PENDING)
2. If SafetyView shows cert alerts, wire it to show real expiry data from `GET /api/safety/cert-expiry-check`
3. Add `sync_error` display on FAILED jobs so admin can see why delivery failed

**Done When**:
- R-W7-02-FE: Notification status badges render correctly for each status
- R-W7-03-FE: SafetyView displays real cert expiry warnings (not placeholder text)
- VPC for modified components

### H-804: Wave 7 Verification
**Requirement IDs**: R-W7-01 through R-W7-04
**Agent**: QA
**Parallel Group**: 7C (depends on 7A + 7B)

**Done When**:
- `npx vitest run` — all FE tests pass
- `cd server && npx vitest run` — all BE tests pass
- `npx tsc --noEmit` — 0 errors
- Integration: create notification job via API → verify status transitions to SENT or FAILED
- Playwright: verify notification/safety views render correctly

---

## Wave 8: Feature Completion — FMCSA, Scanner, Configuration — IN PROGRESS
> **Status**: H-901 code committed (QA pending). H-902 code committed (QA pending). H-903 DONE. H-904 blocked on deps.

**Objective**: Complete remaining partial features and document configuration requirements for features that only need API keys.

### Done When
- R-W8-01: FMCSA safety score lookup returns real data from FMCSA API (or graceful fallback)
- R-W8-02: Scanner component supports live camera capture (not just file picker)
- R-W8-03: `.env.example` documents all API keys needed for full functionality
- R-W8-04: Tests pass

### H-901: FMCSA Safety Score API Integration
**Requirement IDs**: R-W8-01
**Agent**: Backend
**Parallel Group**: 8A

Integrate the FMCSA SAFER Web Services API to fetch real safety ratings by USDOT number.

**Implementation**:
1. Create `server/services/fmcsa.service.ts`:
   - `getSafetyScore(dotNumber: string)` → calls FMCSA SAFER API (free, no key required for basic lookup)
   - Returns: safety rating, out-of-service rates, inspection counts
   - Cache results for 24 hours (in-memory or DB) — FMCSA data doesn't change frequently
   - Graceful fallback: if API unreachable, return `{ available: false, reason: "fmcsa_unavailable" }`
2. Add `GET /api/safety/fmcsa/:dotNumber` endpoint
3. Wire SafetyView to call this endpoint and display real scores

**Done When**:
- R-W8-01a: `GET /api/safety/fmcsa/123456` returns FMCSA data or graceful fallback
- R-W8-01b: SafetyView displays real safety rating when DOT number is configured
- R-W8-01c: Results cached — second call within 24h returns cached data
- Unit tests: mock FMCSA API response → verify parsing and caching

**Changes Table**:

| Action | File | Description | Test File |
|--------|------|-------------|----------|
| CREATE | server/services/fmcsa.service.ts | FMCSA SAFER API service with caching and mock fallback | server/__tests__/services/fmcsa.service.test.ts |
| MODIFY | server/routes/safety.ts | Add GET /api/safety/fmcsa/:dotNumber endpoint | server/__tests__/services/fmcsa.service.test.ts |
| MODIFY | components/SafetyView.tsx | Display real FMCSA safety scores with mock badge | .claude/hooks/tests/test_r_w8_01.py |

### H-902: Scanner Live Camera Capture
**Requirement IDs**: R-W8-02
**Agent**: Frontend
**Parallel Group**: 8A

Add `navigator.mediaDevices.getUserMedia()` to Scanner.tsx for live camera capture on mobile devices. Fall back to file picker on desktop or when camera access is denied.

**Implementation**:
1. Add camera mode to Scanner component: button "Use Camera" alongside existing file picker
2. On mobile: request camera permission → show live video feed → capture frame on button press
3. On desktop or permission denied: fall back to existing file picker behavior
4. Captured frame → convert to Blob → send to AI extraction endpoint (same as current file upload flow)

**Done When**:
- R-W8-02a: Scanner shows "Use Camera" button on devices with camera access
- R-W8-02b: Camera preview renders in component when permission granted
- R-W8-02c: "Capture" button takes snapshot and sends to AI extraction
- R-W8-02d: Permission denied → falls back to file picker with no error
- Unit tests: mock navigator.mediaDevices → verify camera flow
- VPC for Scanner.tsx

### H-903: Configuration Documentation + .env.example
**Requirement IDs**: R-W8-03
**Agent**: Documentation
**Parallel Group**: 8A

Update `.env.example` with all API keys and configuration needed for full functionality. Document which features are gated behind which keys.

**Content**:
```env
# === Required for core functionality ===
DATABASE_URL=mysql://...
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json

# === Required for AI/OCR BOL Parsing ===
GEMINI_API_KEY=your-gemini-key

# === Required for Weather Integration ===
WEATHER_API_KEY=your-azure-maps-key
# OR
OPENWEATHER_API_KEY=your-openweather-key

# === Required for Email Notifications ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@loadpilot.com

# === Required for Google Maps ===
VITE_GOOGLE_MAPS_API_KEY=your-maps-key

# === Optional: Firebase Storage (for cloud file persistence) ===
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
```

**Done When**:
- R-W8-03a: `.env.example` lists every env var the app uses
- R-W8-03b: Each var has a comment explaining what feature it enables
- R-W8-03c: PROJECT_BRIEF.md references `.env.example` for setup

### H-904: Wave 8 Verification
**Requirement IDs**: R-W8-01 through R-W8-04
**Agent**: QA
**Parallel Group**: 8B (depends on 8A)

**Done When**:
- `npx vitest run` — all FE tests pass
- `cd server && npx vitest run` — all BE tests pass
- `npx tsc --noEmit` — 0 errors
- `.env.example` is complete and accurate
- Playwright: Scanner page renders, FMCSA data displays (or graceful fallback)

---

## Future Integrations (Not In Scope — Requires Separate Plan)

These features require significant third-party integration work, OAuth flows, and/or paid service accounts. They are documented here for planning purposes but are NOT included in this sprint.

| Feature | What's Needed | Complexity | Dependencies |
|---------|---------------|------------|-------------|
| **QuickBooks Sync** | Intuit OAuth 2.0, QB Online API, GL account mapping, journal entry sync | HIGH — 2-3 week project | Intuit developer account, OAuth callback URL |
| **Stripe Payments** | Stripe SDK, subscription management, webhook handlers, billing portal | HIGH — 2-3 week project | Stripe account, webhook endpoint |
| **GPS/ELD Real-time** | ELD provider API (Samsara/Verizon/KeepTruckin), WebSocket server, telemetry storage | HIGH — 3-4 week project | ELD provider account, WebSocket infrastructure |
| **Load Templates** | Template CRUD endpoints, save-as-template UI, load-from-template UI | MEDIUM — 1 week | New DB table, new component |
| **SMS Notifications** | Twilio SDK, phone number validation, opt-in/opt-out management | MEDIUM — 1 week | Twilio account |
| **IFTA State Filing** | State-specific filing APIs (vary by jurisdiction), form generation per IFTA spec | HIGH — jurisdiction-dependent | State tax agency credentials |

---

## Sprint Summary

| Wave | Stories | Focus | What Changes |
|------|---------|-------|-------------|
| 1 | H-201 to H-206 | Crash-proofing | 65 crash risks eliminated, 27 memory leaks fixed |
| 2 | H-301 to H-304 | Session & mutation safety | 401 interceptor, double-submit protection, error feedback |
| 3 | H-401 to H-404 | UX consistency | 12 forms validated, 11 components get loading/error/empty |
| 4 | H-501 to H-507 | Accessibility + permissions | Labels (2 batches), icon buttons (2 batches), focus trap, headings, role explanation UX |
| 5 | H-601 to H-604 | Mobile + upload polish | Tap targets, FileVault UX, AbortController |
| 6 | H-701 to H-703 | File persistence | Uploads survive restarts, downloads work, round-trip proven |
| 7 | H-801 to H-804 | Notification delivery | Email actually sends, cert expiry alerts fire, status tracking |
| 8 | H-901 to H-904 | Feature completion | FMCSA scores real, camera scanning, full env documentation |

**Total**: 36 stories across 8 waves (28 implementation + 8 verification)
**Waves 1-5**: Frontend hardening (no new features, only robustness)
**Waves 6-8**: Feature completion (make partial/stubbed features actually work)
**Execution**: Waves are mostly sequential; Wave 6 can run parallel with Waves 4-5 (no file overlap). Stories within each wave can run in parallel groups as marked
**Testing**: Every wave ends with a verification story that includes Playwright spot-checks
**Validation**: Every story follows the VPC (Validate Per Component) protocol

### Prior Plan Lineage
- **Prior plan**: `docs/backup-2026-03-18/PLAN.md.bak` (STORY-012 through STORY-036)
- **Prior PRD**: `docs/backup-2026-03-18/prd.json.bak` (25 stories, all `passed: false` at backup time)
- **Current PRD**: `.claude/prd.json` (29 stories STORY-101 through STORY-503, all `passed: true`)
- **Status**: Prior plan 100% executed. 3 stories only partially addressed (coverage gaps). This plan completes them.
