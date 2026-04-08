Pre-Demo Remediation Plan — Fix the 4 Broken Systems Blocking the Bulletproof Sales Demo (Rev 3)

 ▎ Status: Rev 3 (2026-04-07). Corrected after a second verification pass run by four parallel Explore
 agents against the live `ralph/bulletproof-sales-demo` working tree. Rev 3 fixes five drifts that
 would have caused Rev 2 to fail at Ralph STEP 2:
 (a) `LoadBoardEnhanced.tsx` is prop-driven and has NO self-loading useEffect to wrap — the actual
 loads fetch is orchestrated by `App.tsx:292-357 refreshData()` called from the auth-listener useEffect
 at `App.tsx:257-290`. Phase 2 now adds the polling interval inside App.tsx, not LoadBoardEnhanced;
 (b) `NetworkPortal.tsx:222-224` useEffect deps are `[companyId]`, not `[]` — the R-P2-05 grep assert
 is updated to match the real pattern and the polling swap preserves `companyId` as the primary dep;
 (c) `partialUpdateLoadSchema` at `server/schemas/loads.ts:87-111` whitelists only 7 partial-update
 fields, so Phase 5's driver-intake approval flow (`PATCH /api/loads/:id { equipment_id }`) would be
 silently rejected without an additive update to BOTH `partialUpdateLoadSchema` AND the handler's
 `if (X !== undefined)` block — Phase 4 now covers the update path too;
 (d) `services/api.ts` does NOT propagate server `details` today — the Phase 1 edit is mandatory not
 optional;
 (e) minor file:line drifts (Scanner Props 76-83, POST /api/loads destructure 168-192, INSERT SQL
 line 209, App.tsx Scanner render line 666, ExceptionConsole disabled lines 563-567) — all aligned.

 ▎ Rev 2 carry-over fixes (still valid):
 (a) loads.equipment_id is not persisted anywhere in the backend, so a frontend equipment selector alone
 cannot make UI-created loads dispatchable; (b) `components/Scanner.tsx` has no public API to auto-trigger
 file capture on mount, so the "no edits to Scanner" rule conflicted with the "auto-open file picker"
 outcome; (c) the driver-intake create contract was under-specified (who generates load_number, what are
 the minimum fields, is approval status-only or status+equipment); (d) the migration rule wording was
 internally contradictory ("no DROP COLUMN" vs "DOWN sections must drop what UP added"). All four
 remain fixed.

 ▎ This file is a SEPARATE file from `.claude/docs/PLAN.md`. It does NOT replace the Bulletproof Sales
 Demo plan. When the user is ready to execute this sprint, `PLAN.md` will be temporarily swapped with
 `PLAN-remediation.md` (or renamed), Ralph will run on it, the fixes will merge to `main`, and the
 original `PLAN.md` (Bulletproof Sales Demo) will be restored for the next sprint.

 ▎ Branch (created by Ralph at dispatch time): `ralph/pre-demo-remediation`
 ▎ Targeted defects: 4 issues discovered during user's 2026-04-07 walkthrough that block the demo
 regardless of how well the sales-demo seed pipeline is built.

 ---
 Context

 The user walked two concurrent sessions (same Firebase user, two devices) through the live app on
 2026-04-07 and found four failures. Root causes were pinned to exact file:line locations by parallel
 Explore agents plus direct verification on 2026-04-07:

 1. **Onboarding "Failed to save entity" + multi-user sync gap**
    - Schema drift: `server/routes/clients.ts:797` INSERTs columns `entity_class` and `vendor_profile`
      into the `parties` table. Neither column exists in any of the 51 `.sql` files in
      `server/migrations/` (verified via grep). Table lineage: `032_parties_subsystem.sql` (base),
      `037_fix_parties_fk.sql` (FK only), `038_parties_tags.sql` (NO-OP placeholder),
      `040_parties_tags.sql` (tags only). MySQL raises `ER_BAD_FIELD_ERROR`, transaction rolls back.
    - Error-swallowing: `clients.ts:971` calls `isMissingTableError(error, "parties")`. That helper at
      lines 25-33 only matches `ER_BAD_FIELD_ERROR` when the error message contains the literal string
      `"parties"` — MySQL's "Unknown column" message does NOT include the table name. The 503
      schema-drift path is never taken; the code falls through to `next(error)` → generic 500.
    - UX: `components/NetworkPortal.tsx:344-346` shows a hardcoded `"Failed to save entity"` toast that
      hides the real server message.
    - Multi-user sync gap: `NetworkPortal.tsx:222-224` uses
      `useEffect(() => { loadData(); }, [companyId])` — refetches only when `companyId` flips,
      which never happens during a live session. No polling, no listeners, no websockets.
      Project-wide grep confirms zero realtime data plane anywhere in the app (verified 2026-04-07).

 2. **Load Board Scan Doc + Phone Order produce undispatchable loads**
    - Scan Doc button at `LoadSetupModal.tsx:678` calls `handleContinue(false)` which closes the modal
      and opens `Scanner.tsx` overlay. Scanner.tsx (props at `Scanner.tsx:76-83`) exposes only
      `onDataExtracted`, `onCancel`, `onDismiss`, and `mode` — no mechanism for auto-triggering the
      file picker or camera on mount. The user clicks through the modal and lands in the Scanner with
      no upload kicked off.
    - Phone Order at `LoadSetupModal.tsx:682` generates a load number via `generateNextLoadNumber` and
      captures call notes — nothing else.
    - `EditLoadForm.tsx` (1223 lines) has NO equipment selector at all (verified via grep — only
      "elfEquipment" label strings and a "Driver & Equipment Assignment" section heading).
    - `server/services/load.service.ts:88-117` explicitly flags the current dispatch check as a
      temporary fallback: the current "equipment check" at line 91 derives an equipment identifier
      from `chassis_number || container_number` because the code comment literally says "This will be
      expanded when equipment_id is added to the loads table". **`loads.equipment_id` does not exist
      in the schema.** Verified: migration 020 has `equipment_id` on the `service_tickets` table, not
      `loads`. No migration anywhere adds it to `loads`.
    - `server/routes/loads.ts:168-192` POST /api/loads destructures 23 fields but NOT `equipment_id`.
      `server/schemas/loads.ts:7-72` `createLoadSchema` does not include an `equipment_id` field at all.
    - `server/schemas/loads.ts:87-111` `partialUpdateLoadSchema` (used by `PATCH /api/loads/:id` at
      `loads.ts:349`) only whitelists 7 partial-update fields (weight, commodity, bol_number,
      reference_number, reference_numbers, pickup_date, notes) — so even after migration 049 persists
      `equipment_id`, the PATCH route silently drops it unless the update schema is ALSO extended.
      Rev 2 missed this; corrected in Phase 4 below.
    - `validateDispatchGuards` lives in `server/services/load-state-machine.ts:157`, NOT in
      `load.service.ts`. The dispatch transition at `load.service.ts:88-117` calls the state-machine
      guard — R-P4-07/08 regress that function in place.
    - **Consequence**: even with a frontend equipment selector, the selected equipment would be dropped
      at the API boundary (on create OR update) and not persisted. Rev 1 missed the create path; Rev 2
      missed the update path. Both are corrected in Phase 4 below (Rev 3).

 3. **Issue Board "Create Issue" stuck in spinner**
    - `components/ExceptionConsole.tsx:349-384` `handleCreateIssue` has no `try/catch/finally`.
      `setIsCreating(false)` is unreached on error; the button stays disabled via line 564-567; modal
      never closes.
    - Backend at `server/routes/exceptions.ts:224-267` is fine. 100% frontend bug.

 4. **Operations Board stale snapshot**
    - `components/IntelligenceHub.tsx:254-260`: empty deps useEffect calling
      `loadOpsDashboardData(controller.signal)` — no interval. All 8 KPI cards in
      `components/operations/OpsDashboardPanel.tsx:52-107` are derived via
      `useMemo(..., [loads, opsExceptions])` and freeze at whatever `loads/opsExceptions` were set on
      mount. The queues sub-panel at `IntelligenceHub.tsx:1009` DOES call
      `setInterval(..., 10000)` — the ops dashboard just forgot.

 Architecture discovery (Rev 3, 2026-04-07, verified via parallel Explore agents):
 - `components/LoadBoardEnhanced.tsx` is PROP-DRIVEN — it owns no loads state, no data-loading
   useEffect, and no fetch call. The authoritative loads fetch lives in `App.tsx:292-357`
   (`refreshData(currentUser)` calls `getLoads + getBrokers + getCompanyUsers + getCompany +
   getDispatchEvents + getTimeLogs + getIncidents`). `App.tsx:257-290` is an `onUserChange` auth
   listener that runs `refreshData` exactly once per sign-in. There is no periodic refresh of any
   of these 7 stores. Phase 2 therefore adds a `setInterval` inside the existing App.tsx
   auth-listener useEffect (not inside LoadBoardEnhanced) that re-runs `refreshData(user)` every
   10 seconds whenever `user` is non-null. This is the smallest fix that unblocks the user-observed
   stale-load-board symptom while ALSO fixing the adjacent stale-brokers / stale-users /
   stale-dispatch-events panels with zero extra code.
 - `components/ExceptionConsole.tsx` has its own `loadData` useCallback at line 213 and a
   `useEffect(..., [loadData])` at lines 221-223 — Phase 2 wraps this useEffect in `usePollingEffect`.
 - `services/api.ts:94-100` does NOT propagate the server error body's `details` field (only
   `errorData.error`). Phase 1 therefore MANDATORILY extends `apiFetch` to surface `details`.

 User direction (2026-04-07):
 - **Polling for realtime** (5–10s `setInterval`), not websockets/SSE/Firestore listeners.
 - **Fix all 4 in one remediation sprint**, separate from Bulletproof Sales Demo PLAN.md.
 - **Both load-intake flows** (dispatcher AND driver) rebuilt to match industry standard.

 ---
 Prime Directive — SMALLEST VIABLE FIX PER DEFECT

 Every defect gets the smallest fix that fully resolves the user-observed problem AND has a test that
 fails before the fix and passes after. No opportunistic refactoring, no cleanups adjacent to the fix
 site, no helper extraction unless 2+ call sites are changed in the same phase. See
 `.claude/rules/build-conventions.md` rules 6-9.

 Hard rules:
 1. Zero edits to files not explicitly listed in a phase's File Inventory.
 2. Every fix must have a test added to `server/__tests__/` or `src/__tests__/` or `e2e/` that fails
    without the fix. TDD order is mandatory (Red → Green → Refactor → Gate).
 3. Polling intervals default to 10 seconds except where the user sees visible staleness in <5s demo
    flow (NetworkPortal in multi-user scenario = 5s).
 4. **Migration rule**: Schema changes must be additive in the UP section — existing columns (created
    by migrations 001-047) may NOT be dropped or renamed. Every new migration MUST include a DOWN
    section that cleanly reverses its UP (i.e., the DOWN drops the columns the UP added). DROP COLUMN
    is forbidden in UP and permitted in DOWN only against columns the same migration added. No
    migration may drop or rename a column that a prior migration created.
 5. Load board driver-intake flow reuses the existing `Scanner.tsx` OCR path. Scanner.tsx gets a
    single additive prop (`autoTrigger?: 'upload' | 'camera'`) — no other edits. This was relaxed from
    Rev 1's "zero edits to Scanner.tsx" rule because that rule conflicted with the user's
    "auto-open file picker" requirement (Scanner exposes no imperative API for capture).
 6. The migration numbers in this sprint are `048_parties_entity_class.sql`,
    `049_loads_equipment_id.sql`, `050_loads_intake_source.sql`. Current HEAD is 047 per MEMORY.md.

 ---
 Constraints / Non-Goals
 - No full Pending Intake approval queue with SLA tracking. Driver-submitted loads land in
   `status='Draft'` with `intake_source='driver'`. Approval is a single PATCH with `status='Planned'`
   and a required `equipment_id`.
 - No real-time data plane beyond polling. SSE, websockets, and Firestore listeners are deferred.
 - No new loads state-machine states. Driver-intake loads use existing `status='Draft'` and transition
   to `'Planned'` on approval via the existing `PATCH /api/loads/:id/status` path.
 - `loads.equipment_id` is added as a nullable VARCHAR(36) column in Phase 4. It is not backfilled on
   existing loads — legacy loads continue to use the current `chassis_number || container_number`
   fallback (verified present at `load.service.ts:91`).
 - Existing Bulletproof Sales Demo PLAN.md is NOT touched. This plan lives in its own file.
 - The `/api/parties` 503 fallback path in `clients.ts` is kept as a safety net but hardened — not
   replaced.

 ---
 Phase Breakdown

## Phase 1 — Parties Schema Fix + Error Surfacing (foundation)

 **Phase Type**: `foundation`

 Goal: After this phase, an end-to-end test can create a `parties` row with `entity_class='Customer'`
 and a non-null `vendor_profile` payload without any MySQL error, and future schema drift on the
 `parties` table will surface a descriptive error to the frontend user instead of a generic "Failed
 to save entity" toast.

 Files (new):

 Path: `server/migrations/048_parties_entity_class.sql`
 Purpose: Additive migration. UP adds `entity_class VARCHAR(50) DEFAULT NULL` and `vendor_profile
   JSON DEFAULT NULL` to the `parties` table, plus an index
   `idx_parties_entity_class (company_id, entity_class)` matching the GET /api/parties query pattern
   at `clients.ts:478`. DOWN drops both columns and the index. No pre-existing columns are touched
   (additive UP; reversible DOWN per Hard Rule 4).
 ────────────────────────────────────────
 Path: `server/__tests__/routes/parties-entity-class.test.ts`
 Purpose: Integration test that POSTs a `Contractor` party with a populated `vendorProfile` and
   asserts 201 response, `entityClass === 'Contractor'` in the response body, and that the mock DB
   captured an INSERT including both `entity_class` and `vendor_profile` values. Uses the existing
   `parties-crud.test.ts` mock scaffolding pattern.
 ────────────────────────────────────────
 Path: `server/__tests__/migrations/048_parties_entity_class.test.ts`
 Purpose: Doc-as-spec regression — asserts the migration file exists, contains `ADD COLUMN
   entity_class` and `ADD COLUMN vendor_profile` in UP, `DROP COLUMN entity_class` and `DROP COLUMN
   vendor_profile` in DOWN, and NO `DROP COLUMN` statements targeting any column name other than
   `entity_class` / `vendor_profile`.

 Files (existing) extended:

 Path: `server/routes/clients.ts`
 What changes: Widen `isMissingTableError` at lines 25-33 so that when `tableName` is provided AND the
   error code is `ER_BAD_FIELD_ERROR`, the helper ALSO matches when the error message contains
   `"Unknown column"` (column-drift marker), in addition to the existing table-name substring check.
   This preserves the old behavior for `ER_NO_SUCH_TABLE` but lets `ER_BAD_FIELD_ERROR` surface via
   the 503 path. Max 6 added lines, zero removed. The helper is called from 3 sites (lines 52, 692,
   971) — none of the existing call sites regress because the new branch only widens `true` cases.
   Additionally, in the POST /api/parties catch block at lines 968-985, when `isMissingTableError`
   matches, the 503 response body gains a new `code` field with value `'SCHEMA_DRIFT'` so the frontend
   can discriminate schema issues from true missing tables.

 Path: `components/NetworkPortal.tsx`
 What changes: Replace the hardcoded `"Failed to save entity"` toast at line 346 with
   `setToast({ message: e instanceof Error ? e.message : "Failed to save entity", type: "error" })`.
   Same treatment at line 395 (`handleSaveContact`). Two single-line edits.

 Path: `services/api.ts`
 What changes: MANDATORY edit. Verified at lines 94-100 on the current branch: `apiFetch` only reads
   `errorData.error` from the parsed JSON body and ignores `errorData.details`. Extend the two
   catch-block paths (ForbiddenError at line 94-95 and generic error at line 98-100) to include
   `errorData.details` in the thrown `Error.message` when the server populated it. Pattern:
   `const msg = errorData.details ? \`${errorData.error || "Request failed"}: ${errorData.details}\` :
   (errorData.error || \`API Request failed: ${response.status}\`);`
   Max 6 added lines, zero removed.

 Acceptance criteria (R-markers):
 - R-P1-01 [unit]: Migration `048_parties_entity_class.sql` exists and contains literal strings
   `ADD COLUMN entity_class` and `ADD COLUMN vendor_profile` in its UP section — grep assert.
 - R-P1-02 [unit]: Migration 048 DOWN section contains `DROP COLUMN entity_class` and
   `DROP COLUMN vendor_profile` and contains NO `DROP COLUMN` targeting any other column name — grep
   assert (per Hard Rule 4: DOWN may drop only what UP added).
 - R-P1-03 [integration]: `POST /api/parties` with body
   `{ name, type: "Contractor", entityClass: "Contractor", company_id, vendorProfile:
   { capabilities: ["fuel"], cdlNumber: "X123" } }` returns HTTP 201 and body
   `{ id, entityClass: "Contractor" }` against a mock mysql that accepts both new columns.
 - R-P1-04 [integration]: `POST /api/parties` against a mock mysql that throws
   `{ code: "ER_BAD_FIELD_ERROR", message: "Unknown column 'entity_class' in 'field list'" }` returns
   HTTP 503 with body `{ error: "Party registry unavailable", details: <string containing
   "migrations">, code: "SCHEMA_DRIFT" }`.
 - R-P1-05 [unit]: `isMissingTableError(error, "parties")` in isolation returns `true` when given
   `{ code: "ER_BAD_FIELD_ERROR", message: "Unknown column 'entity_class' in 'field list'" }`
   (message does NOT contain "parties" substring — proves the widened matcher).
 - R-P1-06 [unit]: `components/NetworkPortal.tsx` line 346 toast expression matches
   `e instanceof Error ? e.message : "Failed to save entity"` — grep assert on source.
 - R-P1-07 [integration]: End-to-end POST /api/parties with all 8 contractor vendorProfile fields
   populated (`capabilities`, `serviceArea`, `equipmentOwnership`, `insuranceProvider`,
   `insurancePolicyNumber`, `cdlNumber`, `cdlState`, `cdlExpiry`) succeeds and stores the full JSON.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/routes/parties-entity-class.test.ts __tests__/migrations/048_parties_entity_class.test.ts __tests__/routes/clients.test.ts"
 ```

 ---
## Phase 2 — Polling Layer for Stale Panels (module)

 **Phase Type**: `module`

 Goal: Four frontend panels that currently fetch-once-on-mount gain a `setInterval`-based polling
 loop that re-runs their existing data-loading function. No backend changes. Polling is tied to
 mount/unmount lifecycle with `AbortController` cleanup.

 Files (new):

 Path: `services/usePollingEffect.ts`
 Purpose: Tiny hook (≤15 lines). Signature:
   `usePollingEffect(fn: (signal: AbortSignal) => void | Promise<void>, intervalMs: number, deps: React.DependencyList)`.
   Justification for extraction per build-conventions rule 7: 4 panels adopt this pattern in this
   phase (>2 call sites).
 ────────────────────────────────────────
 Path: `src/__tests__/services/usePollingEffect.test.tsx`
 Purpose: Unit tests with `renderHook` + `vi.useFakeTimers`: asserts immediate-on-mount call, interval
   call after N×ms, no call after unmount, AbortSignal fires on unmount.

 Files (existing) extended:

 Path: `components/NetworkPortal.tsx`
 What changes: Replace `useEffect(() => { loadData(); }, [companyId])` at lines 222-224 with
   `usePollingEffect((signal) => loadData(signal), 5000, [companyId])`. `loadData` at line 226 is
   currently `const loadData = async () => { ... }` with no params — it gains an optional
   `signal?: AbortSignal` parameter forwarded to `getParties(companyId, signal)`. Max ≤15 added lines.
 ────────────────────────────────────────
 Path: `components/IntelligenceHub.tsx`
 What changes: Replace the useEffect at lines 254-260 with
   `usePollingEffect((signal) => loadOpsDashboardData(signal), 10000, [])`. `loadOpsDashboardData`
   already accepts an `AbortSignal` parameter per its signature at line 232. Zero net added lines.
 ────────────────────────────────────────
 Path: `App.tsx`
 What changes: `LoadBoardEnhanced.tsx` is prop-driven — it does NOT own loads state or fetch loads
   (confirmed by Rev 3 verification). The authoritative loads fetch lives in `App.tsx:292-357`
   `refreshData(currentUser)` which runs `getLoads + getBrokers + getCompanyUsers + getCompany +
   getDispatchEvents + getTimeLogs + getIncidents` in parallel. The only caller is the auth-listener
   useEffect at `App.tsx:257-290` which fires once on `onUserChange`. Extend this useEffect to ALSO
   create a `setInterval(() => { if (user) refreshData(user); }, 10000)` inside the inner
   `onUserChange` async callback once `updatedUser` is non-null, storing the handle in a ref, and
   clear it in both the cleanup return AND when `updatedUser` transitions back to null. This
   single polling interval refreshes loads, brokers, users, company, dispatch events, time logs,
   AND incidents — fixing the stale load board AND the adjacent stale panels with zero extra code.
   Does NOT touch `LoadBoardEnhanced.tsx` (preserving the "smallest viable fix" directive). Max 15
   added lines inside the existing useEffect.
 ────────────────────────────────────────
 Path: `components/ExceptionConsole.tsx`
 What changes: `loadData` is a `useCallback` at line 213; the useEffect at lines 221-223 calls it
   with deps `[loadData]`. Replace with
   `usePollingEffect((signal) => loadData(signal), 10000, [loadData])`. `loadData` gains an optional
   `signal?: AbortSignal` parameter forwarded to the fetch inside it. Max 8 added lines.
 ────────────────────────────────────────
 Path: `services/networkService.ts`
 What changes: `getParties` at lines 4-6 currently has signature
   `export const getParties = async (companyId: string): Promise<NetworkParty[]>`. Gains an optional
   `signal?: AbortSignal` parameter forwarded to `api.get`. ~3 added lines.

 Acceptance criteria (R-markers):
 - R-P2-01 [unit]: `services/usePollingEffect.ts` exists and exports a function `usePollingEffect`
   — assert via import.
 - R-P2-02 [unit]: `usePollingEffect(fn, 1000, [])` calls `fn` exactly once immediately on mount.
 - R-P2-03 [unit]: After advancing fake timers by 4500ms, `fn` has been called 5 times (1 immediate
   + 4 intervals).
 - R-P2-04 [unit]: Unmount clears the interval AND fires the `AbortController.abort()` on the last
   signal.
 - R-P2-05 [unit]: `NetworkPortal.tsx` source does NOT contain the literal substring
   `useEffect(() => { loadData(); }, [companyId])` — grep assert (proves the pre-fix pattern was
   replaced). The source MUST contain `usePollingEffect` applied with deps including `companyId`.
 - R-P2-06 [unit]: `NetworkPortal.tsx` imports `usePollingEffect` and passes `5000` as the interval
   argument — grep assert.
 - R-P2-07 [unit]: `IntelligenceHub.tsx` calls `usePollingEffect` with interval `10000` near line
   254 — grep assert.
 - R-P2-08 [unit]: `App.tsx` source contains `setInterval` with `10000` AND references
   `refreshData` within 200 characters of the setInterval call — grep assert proves the polling
   interval was added to the auth-listener useEffect.
 - R-P2-09 [unit]: `App.tsx` cleanup return function (at the end of the useEffect around line 285)
   contains a `clearInterval` call — grep assert proves cleanup.
 - R-P2-10 [unit]: `ExceptionConsole.tsx` imports `usePollingEffect` and passes `10000` — grep
   assert.
 - R-P2-11 [unit]: `services/networkService.ts` `getParties` signature accepts an optional
   `signal?: AbortSignal` — assert via a TS test file that calls
   `getParties('c', new AbortController().signal)` and type-checks.
 - R-P2-12 [integration]: Render `<App />` with a mock `onUserChange` that fires with a non-null
   user, advance fake timers by 10500ms, assert `getLoads` was called at least 2 times (once on
   initial refresh, once from the 10s poll).

 Verification command:

 ```bash
 bash -c "npx vitest run src/__tests__/services/usePollingEffect.test.tsx"
 ```

 ---
## Phase 3 — Issue Board Create Handler Fix (module)

 **Phase Type**: `module`

 Goal: The "Create Issue" flow no longer hangs in a spinner state on error. Error messages from the
 backend are surfaced via the existing toast pattern. The submit button re-enables after an error.

 Files (new):

 Path: `src/__tests__/components/ExceptionConsole.handleCreateIssue.test.tsx`
 Purpose: Unit tests for `handleCreateIssue` covering happy path + 3 error paths (validation, network,
   unexpected shape). Asserts spinner resets in `finally`, modal behavior, toast message.

 Files (existing) extended:

 Path: `components/ExceptionConsole.tsx`
 What changes: Wrap the body of `handleCreateIssue` at lines 349-384 in `try/catch/finally`. Move
   `setIsCreating(false)` into `finally`. Catch sets the toast to the real error message:
   `setToast({ message: err instanceof Error ? err.message : "Failed to create issue", type: "error" })`.
   The empty-form guard at line 350 stays outside the try. Max ≤10 added lines.
 ────────────────────────────────────────
 Path: `services/exceptionService.ts`
 What changes: `createException` at lines 16-21 wraps the `api.post` call in try/catch that rethrows
   `new Error(\`Failed to create exception: ${e.message}\`)` preserving the original via
   `{ cause: e }`. Max 6 added lines.

 Acceptance criteria (R-markers):
 - R-P3-01 [unit]: `handleCreateIssue` happy path — mock `createException` to resolve with
   `"ex-123"`; assert calls to `setIsCreating(true)`, `setIsCreating(false)`,
   `setShowCreateModal(false)`, `loadData()` in order.
 - R-P3-02 [unit]: Validation error path — mock rejection with
   `new Error("Validation failed: description too short")`; assert `setIsCreating(false)` IS called,
   `setToast` message contains `"Validation failed: description too short"`, and
   `setShowCreateModal(false)` is NEVER called (modal stays open).
 - R-P3-03 [unit]: Network error path — mock rejection with `new Error("Network request failed")`;
   assert `setIsCreating(false)` is called and toast contains `"Network request failed"`.
 - R-P3-04 [unit]: `ExceptionConsole.tsx` source contains `finally` followed (within 100 chars) by
   `setIsCreating(false)` — grep assert.
 - R-P3-05 [unit]: `services/exceptionService.ts` `createException` body contains
   `throw new Error` and `cause:` — grep assert.
 - R-P3-06 [integration]: Full-component render test with `@testing-library/react`: render
   `<ExceptionConsole />`, click "New Issue", fill required fields, click Submit, mock the API to
   return 500. After the rejection settles, assert the "Creating..." spinner text is gone and the
   modal remains visible.

 Verification command:

 ```bash
 bash -c "npx vitest run src/__tests__/components/ExceptionConsole.handleCreateIssue.test.tsx"
 ```

 ---
## Phase 4 — Load Equipment Persistence + Dispatcher Intake Flow (module)

 **Phase Type**: `module`

 Goal: Close the backend gap that prevents any UI-created load from passing dispatch guards. After
 this phase:
 1. `loads.equipment_id` is a persisted column (migration 049) with FK to `equipment.id`.
 2. `POST /api/loads` accepts and stores `equipment_id`.
 3. `server/services/load.service.ts` prefers the persisted `load.equipment_id` over the legacy
    `chassis_number || container_number` fallback in the dispatch guard.
 4. `EditLoadForm` has an equipment selector that actually persists.
 5. `LoadSetupModal`'s Scan Doc button opens a file picker immediately on click (via a new
    `autoTrigger` prop on `Scanner.tsx`).
 6. `LoadSetupModal`'s Phone Order mode collects minimum dispatchable fields.
 7. `partialUpdateLoadSchema` and `PATCH /api/loads/:id` accept and persist `equipment_id` so that
    Phase 5's driver-intake approval flow can attach equipment via a single PATCH request.

 Files (new):

 Path: `server/migrations/049_loads_equipment_id.sql`
 Purpose: Additive migration. UP:
   `ALTER TABLE loads ADD COLUMN equipment_id VARCHAR(36) DEFAULT NULL`,
   `ALTER TABLE loads ADD CONSTRAINT fk_loads_equipment_id FOREIGN KEY (equipment_id) REFERENCES
    equipment(id) ON DELETE SET NULL`,
   `CREATE INDEX idx_loads_equipment_id ON loads (equipment_id)`.
   DOWN drops the index, the FK, then the column — in reverse order. No pre-existing columns touched.
 ────────────────────────────────────────
 Path: `server/__tests__/migrations/049_loads_equipment_id.test.ts`
 Purpose: Doc-as-spec regression — asserts `ADD COLUMN equipment_id` in UP, `DROP COLUMN equipment_id`
   in DOWN, and NO `DROP COLUMN` against any other column name.
 ────────────────────────────────────────
 Path: `server/__tests__/routes/loads-equipment-partial-update.test.ts`
 Purpose: Integration test for PATCH /api/loads/:id — (a) updates `equipment_id` against an existing
   draft load, asserts the UPDATE SQL contains `equipment_id = ?` with the correct parameter;
   (b) PATCH with ONLY `{ equipment_id }` in the body succeeds (no other fields), proving the
   `.refine()` predicate was extended; (c) PATCH with empty body still returns 400 with the
   "No supported persisted fields" error (regression guard).
 ────────────────────────────────────────
 Path: `server/__tests__/routes/loads-equipment-persistence.test.ts`
 Purpose: Integration test — POST /api/loads with `{ ...minimumLoad, equipment_id: "EQ-001" }`, asserts
   the captured INSERT contains `equipment_id = "EQ-001"`. Also: POST without `equipment_id` — assert
   null is persisted (not undefined, not "").
 ────────────────────────────────────────
 Path: `server/__tests__/services/load-service-dispatch-guard.test.ts`
 Purpose: Unit test covering both layers of the dispatch guard:
   (a) `load.service.ts` `transitionLoad` call path — creates a load with `equipment_id='EQ-001'`
   and NO `chassis_number`/`container_number`, triggers transition to `DISPATCHED`, asserts the
   equipment lookup query at `load.service.ts:95-98` is executed with `EQ-001` as the parameter
   (proving the new preference order picked the persisted column).
   (b) `validateDispatchGuards` at `load-state-machine.ts:157` — regression asserting the pure
   function still accepts `{ equipmentId: 'EQ-001', ... }` and rejects `{ equipmentId: null, ... }`
   with an error message containing `"equipment"`. This is a REGRESSION assertion; the function
   itself is not modified in this phase.
 ────────────────────────────────────────
 Path: `src/__tests__/components/EditLoadForm.equipment-selector.test.tsx`
 Purpose: Render the form with a mock equipment list, assert the selector is present
   (`getByLabelText(/equipment/i)`), assert `onSave` is called with `equipment_id` set when user
   picks one, assert a warning is shown on save attempt with `status='Planned'` and
   `equipment_id=null`.
 ────────────────────────────────────────
 Path: `src/__tests__/components/LoadSetupModal.scan-doc.test.tsx`
 Purpose: Assert that clicking "Scan Doc" renders `<Scanner autoTrigger="upload" ... />` and that
   Scanner (under the new prop) programmatically clicks its hidden file input on mount. Also assert
   that when a file is selected and OCR returns, the extracted data flows into `editingLoad`.
 ────────────────────────────────────────
 Path: `src/__tests__/components/LoadSetupModal.phone-order-fields.test.tsx`
 Purpose: Assert the phone-order sub-form renders 8 required inputs (broker, pickupCity, pickupState,
   pickupDate, dropoffCity, dropoffState, dropoffDate, rate, equipmentId) plus the existing call
   notes textarea. Assert Submit is disabled until the 8 are populated. Assert save payload includes
   a `legs` array with one `type: "Pickup"` and one `type: "Dropoff"` stop.

 Files (existing) extended:

 Path: `server/schemas/loads.ts`
 What changes: TWO additions.
   1. Add `equipment_id: z.string().optional()` to `createLoadSchema` (after the
      container_number/chassis_number fields). 1 added line.
   2. Add `equipment_id: z.string().trim().min(1).optional()` to `partialUpdateLoadSchema` at lines
      87-96, AND extend the `.refine(...)` predicate at lines 97-111 so `data.equipment_id !==
      undefined` is one of the accepted "at least one field" conditions. Max 3 added lines.
 ────────────────────────────────────────
 Path: `server/routes/loads.ts`
 What changes: TWO handlers modified.
   1. POST /api/loads handler (destructure block at lines 168-192, INSERT SQL at line 209):
      (a) Destructure `equipment_id` from `req.body` (1 added token in the destructure block).
      (b) Extend the INSERT SQL column list + VALUES placeholder to include `equipment_id`.
      (c) Add `equipment_id || null` to the parameter array.
      Max 4 added lines.
   2. PATCH /api/loads/:id handler (destructure block around line 357, updates builder around lines
      382-411):
      (a) Destructure `equipment_id` from `req.body` alongside weight/commodity/etc.
      (b) Add a new `if (equipment_id !== undefined) { updates.push("equipment_id = ?");
          params.push(equipment_id); }` block adjacent to the existing weight/commodity blocks.
      Max 5 added lines. This is required so Phase 5's driver-intake approval flow can attach an
      equipment to a Draft load via `PATCH /api/loads/:id { equipment_id }`.
 ────────────────────────────────────────
 Path: `server/services/load.service.ts`
 What changes: In the dispatch transition logic at lines 88-117, prefer the persisted
   `load.equipment_id` column over the legacy derived identifier. Logic:
   ```
   const equipmentId = load.equipment_id || load.chassis_number || load.container_number || null;
   ```
   This keeps backwards compatibility with loads that pre-date migration 049 (they still dispatch via
   chassis_number/container_number lookup). The existing equipment lookup query at lines 95-98 stays
   as-is (it already searches by both `unit_number` and `id`). Max 2 added lines (new variable binding
   replacing the old one), 2 removed (old derivation).
 ────────────────────────────────────────
 Path: `components/Scanner.tsx`
 What changes: Add a single optional prop to the Props interface at lines 76-83:
   `autoTrigger?: 'upload' | 'camera'`. Inside the component, add a `useEffect(() => { ... }, [])`
   that runs on mount: if `autoTrigger === 'upload'`, programmatically click the hidden file input
   via a ref; if `autoTrigger === 'camera'`, call the existing camera-activation handler (Scanner
   already has two useEffect hooks at lines 181 and 210 — the new one is independent and adjacent
   to them). Zero changes to the existing prop behaviors — default is `undefined`, preserving
   identical behavior for all current callers. Max 15 added lines, zero removed. This is the
   SINGLE exception to the Rev 1 "no Scanner edits" rule, justified in Hard Rule 5 above.
 ────────────────────────────────────────
 Path: `components/EditLoadForm.tsx`
 What changes: Add an equipment selector directly below the driver selector. Fetches the current
   company's equipment list via `GET /api/equipment` (route exists at `server/routes/equipment.ts`).
   Wires `equipment_id` into form state and the save payload. Shows a non-blocking validation
   warning if `equipment_id` is null on a Planned-or-later status. Max 50 added lines.
 ────────────────────────────────────────
 Path: `components/LoadSetupModal.tsx`
 What changes: Three edits:
   1. At the Scan Doc button click handler (line 678): instead of just closing the modal, set
      `setScannerAutoTrigger('upload')` state before closing. Pass `autoTrigger={scannerAutoTrigger}`
      down when the Scanner component is rendered (via the existing `onContinue` → `App.tsx` path).
      The existing Scanner render site is at `App.tsx:666-667` (three props currently:
      `onDataExtracted`, `onCancel`, `onDismiss`) — `autoTrigger` flows through the existing
      `onContinue(nextLoad, autoTrigger)` signature. `App.tsx` IS a listed file below (already
      needed for Phase 2 polling); the autoTrigger prop drilling adds 3-5 additional lines. Max 5
      added lines in LoadSetupModal.
   2. At the Phone Order button (lines 682-695): expand the sub-form to collect the 8 minimum
      dispatchable fields (broker already collected, driver optional, pickupCity, pickupState,
      pickupDate, dropoffCity, dropoffState, dropoffDate, rate, equipmentId). Preserve the existing
      call notes textarea. Max 80 added lines.
   3. The save payload from phone-order mode builds a `legs` array with one `type: "Pickup"` stop and
      one `type: "Dropoff"` stop from the collected fields, sets `equipment_id`, and calls
      `onContinue` with a populated initial load. Max 15 added lines (included in the 80 above).
 ────────────────────────────────────────
 Path: `App.tsx` (already listed in Phase 2)
 What changes: Extend the Phase 2 edits with 2-3 more lines to pass `autoTrigger` from
   LoadSetupModal through `onContinue` to the Scanner render site at lines 666-667 (add
   `autoTrigger={pendingScannerAutoTrigger}` to the Scanner JSX, store the value in a state variable
   set by the LoadSetupModal callback). Max 5 additional lines on top of the Phase 2 App.tsx edits.
 ────────────────────────────────────────
 Path: `components/LoadBoardEnhanced.tsx`
 What changes: Verify the props flow from LoadSetupModal through `EditLoadForm` preserves the new
   `equipment_id` field. Likely zero edits — if the form save payload flows through a spread, the
   new field passes through automatically.

 Acceptance criteria (R-markers):
 - R-P4-01 [unit]: Migration `049_loads_equipment_id.sql` UP contains
   `ADD COLUMN equipment_id VARCHAR(36)` and the FK constraint line — grep assert.
 - R-P4-02 [unit]: Migration `049_loads_equipment_id.sql` DOWN contains `DROP COLUMN equipment_id`
   and NO `DROP COLUMN` against any other column name — grep assert (per Hard Rule 4).
 - R-P4-03 [unit]: `server/schemas/loads.ts` `createLoadSchema` includes `equipment_id` as an
   optional string field — assert via `createLoadSchema.safeParse({ load_number: "L1", status: "Draft",
   equipment_id: "EQ-1" }).success === true`.
 - R-P4-04 [integration]: `POST /api/loads` with body containing `equipment_id: "EQ-001"` captures
   an INSERT that includes `equipment_id = "EQ-001"` against the mock DB.
 - R-P4-05 [integration]: `POST /api/loads` with no `equipment_id` in the body persists `null` (not
   undefined, not empty string).
 - R-P4-06 [unit]: `load.service.ts` dispatch transition uses `load.equipment_id` as the first
   preference for the equipment identifier, falling back to `chassis_number || container_number` —
   assert via mock load that has `equipment_id='EQ-001'` and no chassis/container, and verify the
   equipment lookup query is executed with `EQ-001` as the parameter.
 - R-P4-07 [unit]: `validateDispatchGuards` passes for
   `{ driverId: 'D1', equipmentId: 'EQ-001', stops: [pickup, dropoff], driverCompanyId: 'X',
   equipmentCompanyId: 'X', companyId: 'X' }` — regression.
 - R-P4-08 [unit]: `validateDispatchGuards` FAILS with error message containing `"equipment"` when
   `equipmentId: null` — regression.
 - R-P4-09 [unit]: `EditLoadForm` renders an equipment selector when given a non-empty equipment
   list — assert via `getByLabelText(/equipment/i)`.
 - R-P4-10 [unit]: `EditLoadForm` onSave payload includes `equipment_id` when user picks from the
   selector — assert via spy.
 - R-P4-11 [unit]: `EditLoadForm` displays a warning (`getByText(/equipment required/i)`) when user
   saves with `status='Planned'` and `equipment_id=null`.
 - R-P4-12 [unit]: `Scanner.tsx` Props interface includes
   `autoTrigger?: 'upload' | 'camera'` — grep assert on `Scanner.tsx` source.
 - R-P4-13 [unit]: `<Scanner autoTrigger="upload" ... />` fires a programmatic click on its hidden
   file input on mount — assert via spy on `HTMLInputElement.prototype.click`.
 - R-P4-14 [unit]: `<Scanner autoTrigger="camera" ... />` invokes the camera-activation path on
   mount — assert via spy on the camera handler.
 - R-P4-15 [unit]: `<Scanner />` with no `autoTrigger` prop does NOT fire any click on mount —
   regression proving additive-only behavior.
 - R-P4-16 [unit]: `LoadSetupModal` Phone Order mode renders all 8 required input controls — assert
   via `getAllByRole` queries.
 - R-P4-17 [unit]: `LoadSetupModal` Phone Order Submit is disabled when any of the 8 required fields
   is empty.
 - R-P4-18 [unit]: `LoadSetupModal` Phone Order save payload `legs` array has exactly one
   `type: "Pickup"` and one `type: "Dropoff"` entry populated from the form fields, plus
   `equipment_id` set.
 - R-P4-19 [unit]: `LoadSetupModal` Scan Doc button click path results in `Scanner` being rendered
   with `autoTrigger="upload"` — integration test across modal → App.tsx → Scanner.
 - R-P4-20 [unit]: `server/schemas/loads.ts` `partialUpdateLoadSchema` includes `equipment_id` as an
   optional string field — assert via
   `partialUpdateLoadSchema.safeParse({ equipment_id: "EQ-1" }).success === true`.
 - R-P4-21 [integration]: `PATCH /api/loads/:id` with body `{ equipment_id: "EQ-001" }` against an
   existing draft load updates the `equipment_id` column in the UPDATE SQL (assert via SQL capture
   against a mock DB) and returns the updated load row with `equipment_id === "EQ-001"` in the
   response body.
 - R-P4-22 [integration]: `PATCH /api/loads/:id` with body `{ equipment_id: "EQ-001" }` and NO
   other fields succeeds (proves the `.refine()` predicate was extended to accept
   `equipment_id`-only partial updates). Previous behavior rejected single-field updates with
   "No supported persisted fields" — this is the regression guard.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/migrations/049_loads_equipment_id.test.ts __tests__/routes/loads-equipment-persistence.test.ts __tests__/routes/loads-equipment-partial-update.test.ts __tests__/services/load-service-dispatch-guard.test.ts && cd .. && npx vitest run src/__tests__/components/EditLoadForm.equipment-selector.test.tsx src/__tests__/components/LoadSetupModal.scan-doc.test.tsx src/__tests__/components/LoadSetupModal.phone-order-fields.test.tsx"
 ```

 ---
## Phase 5 — Load Board Driver Intake Flow (module)

 **Phase Type**: `module`

 Goal: A driver using `DriverMobileHome.tsx` can photograph a Rate Confirmation or BOL at the pickup
 facility, upload it through the Scanner.tsx OCR path (with the new `autoTrigger` prop from Phase 4),
 and have the extracted fields saved as a `status='Draft'`, `intake_source='driver'` load owned by
 the current driver. The dispatcher sees these draft loads in a filtered tab on the load board and
 approves them via a single PATCH that sets `status='Planned'` AND `equipment_id` in one operation.

 Create contract (strict, fully specified to address Rev 1 ambiguity):

 **1. Driver-intake create endpoint**: `POST /api/loads/driver-intake` (new route, separate from
 `POST /api/loads`).
    - Required body fields: NONE. All fields optional.
    - Server-derived fields (never read from body):
      - `company_id` — from `req.user.tenantId`
      - `driver_id` — from `req.user.userId` (the submitting driver)
      - `status` — hardcoded `'Draft'`
      - `intake_source` — hardcoded `'driver'`
      - `load_number` — generated server-side via new `generateNextLoadNumber(company_id)` helper
        (see new file below). If the helper fails to produce a unique value after 3 attempts, the
        endpoint returns 503 with a descriptive error.
    - Optional body fields (whatever OCR returned):
      - `commodity`, `weight`, `bol_number`, `reference_number`, `pickup_date`
      - `pickup_city`, `pickup_state`, `pickup_facility_name`
      - `dropoff_city`, `dropoff_state`, `dropoff_facility_name`
    - Validation via new `createDriverIntakeLoadSchema` in `server/schemas/loads.ts` — a separate
      schema from `createLoadSchema`, with all fields optional and no `load_number` requirement.
    - Response on success: HTTP 201, body `{ id, load_number, status: "Draft",
      intake_source: "driver" }`.
    - Dispatch guards are NOT run (the load is a draft — it cannot transition to Dispatched until the
      dispatcher approves and attaches equipment).

 **2. Dispatcher approval**: Uses the existing `PATCH /api/loads/:id` (partial update) endpoint plus
 the existing `PATCH /api/loads/:id/status` path. The approval UI sends a single combined request
 sequence:
    - First: `PATCH /api/loads/:id` with body `{ equipment_id: <selected>, driver_id: <optionally
      changed> }` — persists the equipment assignment via the path added in Phase 4.
    - Then: `PATCH /api/loads/:id/status` with body `{ status: "Planned" }` — transitions state.
      The existing state machine allows Draft → Planned without additional guards.
    - If either request fails, the UI surfaces the error and leaves the load in Draft state.
    - The approval modal REQUIRES `equipment_id` to be selected before the Approve button enables,
      so loads approved via this flow always satisfy the dispatch guards when they later transition
      to Dispatched.

 Files (new):

 Path: `server/migrations/050_loads_intake_source.sql`
 Purpose: Additive migration. UP: `ALTER TABLE loads ADD COLUMN intake_source VARCHAR(20) DEFAULT
   'dispatcher'`. Values: `'dispatcher'` | `'driver'` | `'api'`. DOWN drops the column.
 ────────────────────────────────────────
 Path: `server/__tests__/migrations/050_loads_intake_source.test.ts`
 Purpose: Doc-as-spec — asserts ADD COLUMN in UP, DROP COLUMN in DOWN, no other DROP COLUMN.
 ────────────────────────────────────────
 Path: `server/lib/loadNumberGenerator.ts`
 Purpose: NEW server-side helper. Exports
   `async generateNextLoadNumber(companyId: string, pool: Pool): Promise<string>`. Queries
   `SELECT load_number FROM loads WHERE company_id = ? ORDER BY created_at DESC LIMIT 1`, parses the
   highest numeric suffix, increments. Falls back to `DRAFT-${uuid().slice(0,8)}` if no existing
   loads or parse failure. Max 30 lines.
   **Name-collision note**: A frontend helper with the same name `generateNextLoadNumber` already
   exists in `services/storageService.ts` (imported by `components/LoadSetupModal.tsx:15`). The new
   server helper lives in a different module (`server/lib/`) under a different runtime, so there is
   no runtime collision. Phase 5 tests import the server version explicitly from
   `server/lib/loadNumberGenerator` to avoid any ambiguity.
 ────────────────────────────────────────
 Path: `server/__tests__/lib/loadNumberGenerator.test.ts`
 Purpose: Unit tests — empty table → `DRAFT-<uuid>`; existing `LP-0001` → `LP-0002`; existing
   `LP-DEMO-001` with non-numeric suffix → `DRAFT-<uuid>`; concurrent call safety documented (the
   helper is not atomic — Phase 5 accepts the rare race as out-of-scope because drafts have no user-
   visible numbering contract).
 ────────────────────────────────────────
 Path: `server/routes/loads-driver-intake.ts`
 Purpose: New route file (justified per build-conventions rule 6 because this is a functionally
   distinct endpoint with its own validation, auth, and ownership model). Exports a router with a
   single handler:
   `router.post("/api/loads/driver-intake", requireAuth, requireTenant, validateBody(createDriverIntakeLoadSchema), handler)`.
   Handler: derives company_id/driver_id/status/intake_source server-side, calls
   `generateNextLoadNumber`, constructs the load record, INSERTs via the same transaction pattern as
   `POST /api/loads`, returns 201. Max 80 lines.
 ────────────────────────────────────────
 Path: `server/__tests__/routes/loads-driver-intake.test.ts`
 Purpose: Integration tests — (a) empty body succeeds with server-generated load_number; (b) body
   fields for pickup/dropoff are persisted; (c) attempt to set `status: "Planned"` in body is
   ignored (server overrides to "Draft"); (d) attempt to set `driver_id` in body is ignored (server
   uses req.user); (e) unauthenticated request returns 401; (f) response body includes the
   generated `load_number`.
 ────────────────────────────────────────
 Path: `components/driver/DriverLoadIntakePanel.tsx`
 Purpose: New component shown inside `DriverMobileHome.tsx` when the driver taps a new "Submit Load
   Intake" tile. Renders `<Scanner autoTrigger="camera" mode="intake" onDataExtracted={...} />` on
   mount. When the OCR callback fires, shows the extracted fields in an editable review screen. On
   confirm, POSTs to `/api/loads/driver-intake`. On success shows "Submitted for dispatcher review"
   and returns the driver to DriverMobileHome. Max 180 lines.
 ────────────────────────────────────────
 Path: `components/PendingDriverIntakeQueue.tsx`
 Purpose: New dispatcher-side component — lists all loads where `status='Draft'` AND
   `intake_source='driver'` via a filtered GET /api/loads query. Each row has an "Approve" button
   that opens an approval modal. The modal REQUIRES the dispatcher to pick an equipment (from a
   fetched equipment list) and optionally reassign the driver; Approve button is disabled until
   `equipment_id` is selected. On submit, runs the two-request sequence documented above, then
   removes the row on success. Max 160 lines.
 ────────────────────────────────────────
 Path: `src/__tests__/components/DriverLoadIntakePanel.test.tsx`
 Purpose: Tests that the panel renders, mocks the Scanner's OCR callback to return a payload, calls
   `POST /api/loads/driver-intake` with the expected body shape, asserts the success screen appears.
 ────────────────────────────────────────
 Path: `src/__tests__/components/PendingDriverIntakeQueue.test.tsx`
 Purpose: Tests that the queue renders only loads matching the filter, that the Approve button is
   disabled until equipment is selected, that clicking Approve fires a PATCH to
   `/api/loads/:id` with equipment_id followed by PATCH to `/api/loads/:id/status` with
   `status: "Planned"` in order.

 Files (existing) extended:

 Path: `server/schemas/loads.ts`
 What changes: Add new export `createDriverIntakeLoadSchema = z.object({ ...11 optional fields... })`
   — separate from `createLoadSchema`, does NOT include `load_number` or `status` (server-derived).
   The 11 optional fields: `commodity`, `weight`, `bol_number`, `reference_number`, `pickup_date`,
   `pickup_city`, `pickup_state`, `pickup_facility_name`, `dropoff_city`, `dropoff_state`,
   `dropoff_facility_name`. Max 15 added lines.
 ────────────────────────────────────────
 Path: `server/index.ts`
 What changes: Add 2 lines — `import driverIntakeRouter from "./routes/loads-driver-intake"` and
   `app.use(driverIntakeRouter)`. Placed adjacent to the existing loads router registration.
 ────────────────────────────────────────
 Path: `server/routes/loads.ts`
 What changes: In the same POST /api/loads handler touched in Phase 4, ALSO destructure
   `intake_source` from the body and include it in the INSERT (default `'dispatcher'` if absent).
   Max 3 added lines (1 destructure, 1 SQL column, 1 parameter).
 ────────────────────────────────────────
 Path: `components/DriverMobileHome.tsx`
 What changes: Add a new "Submit Load Intake" tile that opens `DriverLoadIntakePanel`. Does NOT
   modify any existing driver flow (BOL upload, POD upload, status transitions stay as-is). Max 20
   added lines.
 ────────────────────────────────────────
 Path: `components/LoadBoardEnhanced.tsx`
 What changes: Add a new tab/filter "Pending Driver Intake" that mounts `PendingDriverIntakeQueue`
   when selected. Max 15 added lines.

 Acceptance criteria (R-markers):
 - R-P5-01 [unit]: Migration `050_loads_intake_source.sql` UP contains
   `ADD COLUMN intake_source VARCHAR` — grep assert.
 - R-P5-02 [unit]: Migration 050 DOWN contains `DROP COLUMN intake_source` and NO other DROP COLUMN
   — grep assert (per Hard Rule 4).
 - R-P5-03 [unit]: `generateNextLoadNumber('C1', mockPool)` against an empty mock returns a string
   matching the pattern `^DRAFT-[a-f0-9]{8}$`.
 - R-P5-04 [unit]: `generateNextLoadNumber` against a mock with `LP-0001` existing returns `LP-0002`.
 - R-P5-05 [unit]: `createDriverIntakeLoadSchema.safeParse({})` succeeds (empty body valid — all
   fields optional).
 - R-P5-06 [unit]: `createDriverIntakeLoadSchema` does NOT have a `load_number` field — assert via
   `'load_number' in createDriverIntakeLoadSchema.shape === false`.
 - R-P5-07 [integration]: `POST /api/loads/driver-intake` with empty body returns 201 with body
   containing `{ status: "Draft", intake_source: "driver", load_number: <non-empty string> }` and
   `driver_id` set to the authenticated user's userId.
 - R-P5-08 [integration]: `POST /api/loads/driver-intake` with
   `{ status: "Planned", driver_id: "other-user" }` in body IGNORES both fields — the persisted
   record has `status: "Draft"` and `driver_id: <auth user>`. Proves server-derived fields override
   body.
 - R-P5-09 [integration]: `POST /api/loads/driver-intake` without authentication returns 401.
 - R-P5-10 [unit]: `DriverLoadIntakePanel` renders `<Scanner autoTrigger="camera" mode="intake" />`
   on mount — assert via rendered props.
 - R-P5-11 [unit]: `DriverLoadIntakePanel` calls fetch with `/api/loads/driver-intake` after the
   Scanner's `onDataExtracted` callback fires and the user confirms — assert via fetch spy.
 - R-P5-12 [unit]: `PendingDriverIntakeQueue` filters the fetched loads list to only `status ===
   "Draft"` AND `intake_source === "driver"` — assert via mock load list containing mixed records.
 - R-P5-13 [unit]: `PendingDriverIntakeQueue` Approve button is disabled until `equipment_id` is
   selected in the approval modal.
 - R-P5-14 [unit]: `PendingDriverIntakeQueue` Approve button click fires TWO fetches in order: first
   `PATCH /api/loads/:id` with `{ equipment_id: <selected> }`, then
   `PATCH /api/loads/:id/status` with `{ status: "Planned" }` — assert via ordered fetch spy.
 - R-P5-15 [unit]: `server/index.ts` source contains an import of `loads-driver-intake` and an
   `app.use` registration — grep assert.
 - R-P5-16 [unit]: `DriverMobileHome.tsx` imports `DriverLoadIntakePanel` — grep assert.
 - R-P5-17 [unit]: `LoadBoardEnhanced.tsx` imports `PendingDriverIntakeQueue` — grep assert.

 Verification command:

 ```bash
 bash -c "cd server && npx vitest run __tests__/migrations/050_loads_intake_source.test.ts __tests__/lib/loadNumberGenerator.test.ts __tests__/routes/loads-driver-intake.test.ts && cd .. && npx vitest run src/__tests__/components/DriverLoadIntakePanel.test.tsx src/__tests__/components/PendingDriverIntakeQueue.test.tsx"
 ```

 ---
## Phase 6 — End-to-End Regression Suite (integration)

 **Phase Type**: `integration`

 Goal: Four Playwright specs exercise the user-observed failure scenarios end-to-end against a
 running backend. These are the canonical demo-readiness bar.

 Files (new):

 Path: `e2e/pre-demo-remediation/01-onboarding-multi-user.spec.ts`
 Purpose: Two-context test simulating User A and User B logged in as the same Firebase user. User A
   creates a Contractor party via the onboarding wizard; User B's NetworkPortal asserts the new
   party appears within 7 seconds (5s polling + 2s safety margin). Auth pattern reused from
   `e2e/team05-onboarding-entities.spec.ts`.
 ────────────────────────────────────────
 Path: `e2e/pre-demo-remediation/02-load-board-dispatcher-flow.spec.ts`
 Purpose: Dispatcher logs in, clicks Create Load → Scan Doc → asserts file picker opens immediately
   (proves `autoTrigger="upload"` works end-to-end). Uploads a fixture RateCon image, reviews
   extracted fields, fills missing fields INCLUDING equipment, saves. Asserts the load appears on
   the board with `status='Planned'`, `equipment_id` non-null, and passes dispatch guards by
   transitioning to Dispatched.
 ────────────────────────────────────────
 Path: `e2e/pre-demo-remediation/03-load-board-driver-intake-flow.spec.ts`
 Purpose: Driver context taps Submit Load Intake, uploads a fixture BOL, confirms fields, submits.
   Asserts the load appears with `status='Draft'` and `intake_source='driver'`. Dispatcher context
   navigates to Pending Driver Intake tab, sees the load, clicks Approve, picks equipment, confirms.
   Asserts the load transitions to Planned AND has `equipment_id` persisted.
 ────────────────────────────────────────
 Path: `e2e/pre-demo-remediation/04-issue-board-create.spec.ts`
 Purpose: Open the issue board, click New Issue, submit with invalid data (empty description), assert
   the button re-enables within 2 seconds with an error toast visible. Then submit valid data,
   assert the issue appears in the list within 12 seconds (10s polling + 2s margin).
 ────────────────────────────────────────
 Path: `e2e/fixtures/ratecon-sample.png`
 Purpose: Small (<100 KB) sample rate-confirmation image for the scan-doc spec. Generated during
   Phase 6 and committed as a binary fixture.
 ────────────────────────────────────────
 Path: `e2e/fixtures/bol-sample.png`
 Purpose: Small (<100 KB) sample BOL image for the driver intake spec.

 Files (existing) extended:

 Path: `playwright.config.ts`
 What changes: If the new spec directory `e2e/pre-demo-remediation/` is not auto-discovered, add it
   to `testDir`/`testMatch`. Max 3 added lines; likely zero.

 Acceptance criteria (R-markers):
 - R-P6-01 [e2e]: Onboarding multi-user spec — User A creates party; User B sees it within 7 seconds.
 - R-P6-02 [e2e]: Dispatcher flow spec — Scan Doc click → file picker visible on screen within 1
   second (proves autoTrigger). End state: load has `status='Planned'`, `equipment_id` non-null.
 - R-P6-03 [e2e]: Driver intake spec — driver-submitted load appears in dispatcher's Pending Driver
   Intake queue, gets approved with equipment attached, transitions to Planned.
 - R-P6-04 [e2e]: Issue board create spec — invalid submission surfaces error toast and re-enables
   button within 2s; valid submission appears in list within 12s.
 - R-P6-05 [e2e]: All 4 specs under `e2e/pre-demo-remediation/` are auto-discovered by
   `npx playwright test --list`.

 Verification command:

 ```bash
 bash -c "npx playwright test e2e/pre-demo-remediation/ --reporter=list"
 ```

 ---
 File Inventory (extend vs create) — final (Rev 3)

 ## Extended (existing files modified)

 | File | Phase(s) | Diff scope |
 |---|---|---|
 | server/routes/clients.ts | 1 | ~6 added lines (widen `isMissingTableError` for ER_BAD_FIELD_ERROR) |
 | components/NetworkPortal.tsx | 1, 2 | ~5 added lines (error surfacing + polling swap, deps stay `[companyId]`) |
 | services/api.ts | 1 | ~6 added lines (MANDATORY — surface server `details` field at lines 94-100) |
 | services/networkService.ts | 2 | ~3 added lines (AbortSignal forwarding) |
 | components/IntelligenceHub.tsx | 2 | 0 net added (useEffect → usePollingEffect replacement) |
 | App.tsx | 2, 4 | ~20 added lines (Phase 2: setInterval around refreshData in auth useEffect + clearInterval cleanup; Phase 4: autoTrigger prop drilling to Scanner at lines 666-667) |
 | components/LoadBoardEnhanced.tsx | 5 | ~15 added lines (Pending Driver Intake tab ONLY — no polling here; loads fetch lives in App.tsx) |
 | components/ExceptionConsole.tsx | 2, 3 | ~15 added lines (polling + try/catch/finally) |
 | services/exceptionService.ts | 3 | ~6 added lines (error wrap) |
 | server/schemas/loads.ts | 4, 5 | ~19 added lines (equipment_id in createLoadSchema + partialUpdateLoadSchema + .refine() predicate + createDriverIntakeLoadSchema) |
 | server/routes/loads.ts | 4, 5 | ~12 added lines (POST equipment_id + PATCH equipment_id handler block + intake_source in POST) |
 | server/services/load.service.ts | 4 | ~2 added, ~2 removed (prefer load.equipment_id in dispatch guard at lines 88-117) |
 | components/Scanner.tsx | 4 | ~15 added lines (autoTrigger prop at Props interface lines 76-83) |
 | components/EditLoadForm.tsx | 4 | ~50 added lines (equipment selector) |
 | components/LoadSetupModal.tsx | 4 | ~100 added lines (file picker wiring + phone order fields) |
 | server/index.ts | 5 | 2 added lines (register loads-driver-intake router) |
 | components/DriverMobileHome.tsx | 5 | ~20 added lines (Submit Load Intake tile) |
 | playwright.config.ts | 6 | ≤3 added lines (test dir — likely zero; testDir `./e2e` already auto-discovers subdirs) |

 ## New (files created)

 Category: Migrations (3)
 - server/migrations/048_parties_entity_class.sql
 - server/migrations/049_loads_equipment_id.sql
 - server/migrations/050_loads_intake_source.sql

 Category: Server runtime (2)
 - server/lib/loadNumberGenerator.ts
 - server/routes/loads-driver-intake.ts

 Category: Frontend runtime (3)
 - services/usePollingEffect.ts
 - components/driver/DriverLoadIntakePanel.tsx
 - components/PendingDriverIntakeQueue.tsx

 Category: Server tests (9)
 - server/__tests__/routes/parties-entity-class.test.ts
 - server/__tests__/migrations/048_parties_entity_class.test.ts
 - server/__tests__/migrations/049_loads_equipment_id.test.ts
 - server/__tests__/migrations/050_loads_intake_source.test.ts
 - server/__tests__/routes/loads-equipment-persistence.test.ts
 - server/__tests__/routes/loads-equipment-partial-update.test.ts
 - server/__tests__/services/load-service-dispatch-guard.test.ts
 - server/__tests__/lib/loadNumberGenerator.test.ts
 - server/__tests__/routes/loads-driver-intake.test.ts

 Category: Frontend tests (7)
 - src/__tests__/services/usePollingEffect.test.tsx
 - src/__tests__/components/ExceptionConsole.handleCreateIssue.test.tsx
 - src/__tests__/components/EditLoadForm.equipment-selector.test.tsx
 - src/__tests__/components/LoadSetupModal.scan-doc.test.tsx
 - src/__tests__/components/LoadSetupModal.phone-order-fields.test.tsx
 - src/__tests__/components/DriverLoadIntakePanel.test.tsx
 - src/__tests__/components/PendingDriverIntakeQueue.test.tsx

 Category: E2E (6)
 - e2e/pre-demo-remediation/01-onboarding-multi-user.spec.ts
 - e2e/pre-demo-remediation/02-load-board-dispatcher-flow.spec.ts
 - e2e/pre-demo-remediation/03-load-board-driver-intake-flow.spec.ts
 - e2e/pre-demo-remediation/04-issue-board-create.spec.ts
 - e2e/fixtures/ratecon-sample.png
 - e2e/fixtures/bol-sample.png

 ## Files explicitly NOT touched (proof of minimum scope)

 `.claude/docs/PLAN.md`, `server/routes/ai.ts`, `server/services/gemini.service.ts`,
 `server/services/document.service.ts`, `components/GlobalMapViewEnhanced.tsx`,
 `components/SafetyView.tsx`, `components/AccountingPortal.tsx`, `components/IFTAManager.tsx`, any
 existing migration 001-047, `server/scripts/seed-demo.ts`, `server/middleware/requireAuth.ts`,
 `server/middleware/requireTier.ts`, `server/middleware/requireTenant.ts`, `server/lib/sql-auth.ts`,
 `server/services/load-state-machine.ts` (the dispatch guard is only EXERCISED by this plan, not
 modified).

 NOTE: `components/Scanner.tsx` IS modified in this plan (Phase 4) — one additive prop
 (`autoTrigger`). See Hard Rule 5 for the justification (Rev 1 had this file as NOT touched; that
 constraint conflicted with the user requirement for auto-opening the file picker).

 ---
 Sprint summary (Rev 3)

 - **6 phases**, **69 R-markers** total (verified via `prd_generator.py --dry-run`:
   P1=7, P2=12, P3=6, P4=22, P5=17, P6=5). Up from Rev 2's 64 due to: +2 App.tsx polling
   assertions R-P2-08/09, +1 App.tsx→getLoads integration R-P2-12, +3 partial-update-schema
   assertions R-P4-20/21/22, -1 absorbed by the LoadBoardEnhanced polling drop (now in App.tsx).
 - **18 extended files**, **30 new files** (3 migrations + 2 server runtime + 3 frontend runtime +
   9 server tests + 7 frontend tests + 4 e2e specs + 2 binary fixtures).
 - **3 new migrations**: 048 (parties.entity_class + vendor_profile), 049 (loads.equipment_id),
   050 (loads.intake_source). Current HEAD verified as 047 on `ralph/bulletproof-sales-demo`.
 - **Branch**: `ralph/pre-demo-remediation`.
 - **Execution path**: back up `.claude/docs/PLAN.md` (to `PLAN-bulletproof-sales-demo.md`) →
   rename `PLAN-remediation.md` to `PLAN.md` → run `python .claude/hooks/prd_generator.py --plan
   .claude/docs/PLAN.md` to regenerate `prd.json` → `/ralph` → merge PR → restore the original
   PLAN.md from `PLAN-bulletproof-sales-demo.md`. The Bulletproof Sales Demo plan stays
   byte-for-byte identical throughout.
 - **Known non-blocker**: `.claude/hooks/prd_generator.py` `_infer_test_type` only reads the
   Testing Strategy table section (which this plan doesn't have, matching current PLAN.md format).
   All 61 criteria will initially be generated with `testType: "manual"`, which is fine for Ralph
   execution — `qa_runner.py` reads the `# Tests R-PN-NN` markers directly from test files (via
   `_qa_lib.py:1314-1315`) and does not rely on the prd.json testType field for coverage
   enforcement. If Ralph ever wants correct testType fields in prd.json, patch
   `_R_ID_RE` at `prd_generator.py:44` to capture the bracket group + plumb into
   `_infer_test_type`. Not required for this sprint.

 ---
 Rev 3 changelog (second verification pass, 2026-04-07)

 1. **Phase 2 polling target corrected**: `LoadBoardEnhanced.tsx` is prop-driven — it has NO
    self-loading useEffect and no fetch call. The loads state and fetch orchestration live in
    `App.tsx:292-357` `refreshData()`, called once-per-sign-in from the auth useEffect at
    `App.tsx:257-290`. Phase 2 now adds the setInterval inside that App.tsx useEffect instead of
    LoadBoardEnhanced. R-P2-08 changed from "LoadBoardEnhanced imports usePollingEffect" to
    "App.tsx contains setInterval+refreshData"; R-P2-09 added for clearInterval cleanup; R-P2-12
    added as an integration test asserting `getLoads` is called ≥2 times after 10s.
 2. **NetworkPortal useEffect deps drift**: Actual deps are `[companyId]`, not `[]`. R-P2-05 grep
    pattern updated to match the real pre-fix pattern. Phase 2 polling swap preserves `companyId`
    as the dep.
 3. **Phase 4 update-path gap**: `partialUpdateLoadSchema` at `server/schemas/loads.ts:87-111`
    whitelists only 7 partial-update fields, so Phase 5's driver-intake approval flow (which does
    `PATCH /api/loads/:id { equipment_id }`) would be silently rejected without an additive update
    to BOTH the schema and the handler's update builder at `server/routes/loads.ts:382-411`.
    Phase 4 now extends both. New R-markers: R-P4-20 (schema accepts equipment_id),
    R-P4-21 (PATCH captures it), R-P4-22 (.refine() accepts equipment_id-only body).
 4. **`services/api.ts` edit promoted from optional to mandatory**: Verified at lines 94-100 on
    the current branch — `apiFetch` reads only `errorData.error` and silently drops
    `errorData.details`. The Phase 1 "if needed" wording is replaced with a concrete edit.
 5. **validateDispatchGuards file location corrected**: Lives in
    `server/services/load-state-machine.ts:157`, not in `load.service.ts`. Phase 4's
    `load-service-dispatch-guard.test.ts` is now explicit about covering both the call-path in
    `load.service.ts:88-117` AND the pure function regression at `load-state-machine.ts:157`.
 6. **File:line drifts aligned**: Scanner Props 76-83 (was 77-84), POST /api/loads destructure
    168-192 (was 162-193), INSERT SQL line 209 (was 208), App.tsx Scanner render 666-667 (was
    667), ExceptionConsole disabled-state lines 563-567 (was 564-567), NetworkPortal useEffect
    222-224 (was 222-225). None of these change the technical content — only the grep-assert
    precision.
 7. **`generateNextLoadNumber` name-collision clarified**: A frontend helper with the same name
    already exists in `services/storageService.ts` (imported by LoadSetupModal). The Phase 5
    server helper in `server/lib/loadNumberGenerator.ts` is a different module. Tests import by
    explicit path.
 8. **Known non-blocker documented**: `prd_generator.py` does not extract test-type brackets from
    R-markers. Sprint summary now notes this is fine because `qa_runner.py` reads markers from
    test files directly via `_qa_lib.py:1314-1315`.

 Rev 2 changelog (peer review corrections)

 1. **Equipment persistence backend scope added to Phase 4**: migration 049_loads_equipment_id.sql,
    `equipment_id` in `createLoadSchema`, destructure + INSERT in `POST /api/loads`, preference in
    `load.service.ts` dispatch guard. Rev 1 treated equipment as frontend-only which would have
    silently dropped the field at the API boundary. New R-markers: R-P4-01 through R-P4-08, R-P4-19.
 2. **Scanner.tsx autoTrigger prop permitted**: Rev 1's "no Scanner edits" rule conflicted with the
    "auto-open file picker" outcome. Hard Rule 5 now permits a single additive prop
    `autoTrigger?: 'upload' | 'camera'`. New R-markers: R-P4-12 through R-P4-15.
 3. **Driver-intake create contract fully specified**: separate `POST /api/loads/driver-intake`
    route, separate `createDriverIntakeLoadSchema` with all fields optional, server-derived
    `load_number` via new `generateNextLoadNumber` helper, explicit two-step approval flow
    (PATCH equipment then PATCH status) with equipment required at approval. Rev 1 said "reuse POST
    /api/loads as-is" which was ambiguous. New R-markers: R-P5-03 through R-P5-09, R-P5-13, R-P5-14.
 4. **Migration rule wording fixed**: Hard Rule 4 now states additive UP + reversible DOWN (DOWN may
    drop only columns the same UP added). Rev 1 had contradictory "no DROP COLUMN" + "DOWN sections
    that drop new columns" language. Acceptance criteria R-P1-02, R-P4-02, R-P5-02 now assert the
    exact DOWN-only DROP COLUMN rule.
