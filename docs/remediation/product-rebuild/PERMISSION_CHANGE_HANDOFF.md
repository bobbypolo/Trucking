# Permission Change Handoff — Team 04 to Team 01

Date: 2026-03-24
Context: Team 04 (QA & Release) identified 6 discrepancies (DISC-01 through DISC-06) between the approved NAV_VISIBILITY_AND_ROLE_MATRIX and the actual implementation during UAT preparation. All changes were applied in the `team04-qa-release` worktree on the `fix/pr26-production-remediation` branch.

## Ownership Statement

These changes modify production authorization behavior in `App.tsx` and `services/authService.ts`, which are owned by Team 01 (Platform/Architecture). Team 04 applied these fixes during QA to unblock role-based UAT testing. **Team 01 must review, accept, or reject each change.**

Changes are visible in:

```
git diff origin/fix/pr26-production-remediation...HEAD -- App.tsx services/authService.ts
```

---

## Change Inventory

### DISC-01: Broker Network Permission Gate

- **File**: `App.tsx`
- **Exact change**: Added `permission: "LOAD_RATE_VIEW"` to the Broker Network nav item
- **Before**:
  ```ts
  { id: "network", label: "Broker Network", icon: Globe }
  ```
- **After**:
  ```ts
  { id: "network", label: "Broker Network", icon: Globe, permission: "LOAD_RATE_VIEW" }
  ```
- **Matrix requirement**: Driver = None, Safety/Ops Control = None for Broker Network
- **Effect**: Only roles holding `LOAD_RATE_VIEW` see Broker Network in the sidebar. `LOAD_RATE_VIEW` is present on DISPATCHER, ACCOUNTING_AR, and PAYROLL_SETTLEMENTS. It is absent from DRIVER_PORTAL and SAFETY_COMPLIANCE.
- **Aligns with matrix**: YES — Driver and Safety are correctly blocked; Dispatcher, Accounting, and Admin retain access
- **Recommendation**: KEEP

---

### DISC-03: ORG_SETTINGS_VIEW for DISPATCHER and SAFETY_COMPLIANCE

- **File**: `services/authService.ts`
- **Exact change**: Added `"ORG_SETTINGS_VIEW"` to both `DISPATCHER` and `SAFETY_COMPLIANCE` preset arrays
- **Before (DISPATCHER)**:
  ```ts
  DISPATCHER: [
    ...,
    "LOAD_RATE_VIEW",
  ],
  ```
- **After (DISPATCHER)**:
  ```ts
  DISPATCHER: [
    ...,
    "LOAD_RATE_VIEW",
    "ORG_SETTINGS_VIEW",
    "SETTLEMENT_VIEW",   // also DISC-05, see below
  ],
  ```
- **Before (SAFETY_COMPLIANCE)**:
  ```ts
  SAFETY_COMPLIANCE: [
    ...,
    "SAFETY_EVENT_EDIT",
  ],
  ```
- **After (SAFETY_COMPLIANCE)**:
  ```ts
  SAFETY_COMPLIANCE: [
    ...,
    "SAFETY_EVENT_EDIT",
    "ORG_SETTINGS_VIEW",
  ],
  ```
- **Matrix requirement**: Company Settings — Dispatcher = Read, Safety/Ops Control = Read
- **Effect**: `ORG_SETTINGS_VIEW` is the permission gate on the Company Settings nav item. Without it, Dispatcher and Safety roles could not see Company Settings at all, contradicting the matrix's Read grant.
- **Aligns with matrix**: YES — both roles now satisfy the gate and will see Company Settings
- **Note**: The gate only controls nav visibility. Preventing mutations within Company Settings requires view-level enforcement that is outside the scope of this change.
- **Recommendation**: KEEP

---

### DISC-04: INVOICE_CREATE and LOAD_RATE_VIEW for PAYROLL_SETTLEMENTS

- **File**: `services/authService.ts`
- **Exact change**: Added `"ORG_SETTINGS_VIEW"`, `"INVOICE_CREATE"`, and `"LOAD_RATE_VIEW"` to `PAYROLL_SETTLEMENTS`
- **Before**:
  ```ts
  PAYROLL_SETTLEMENTS: [
    "EXPORT_DATA",
    "AUDIT_LOG_VIEW",
    "DOCUMENT_VIEW",
    "SETTLEMENT_VIEW",
    "SETTLEMENT_EDIT",
    "SETTLEMENT_APPROVE",
  ],
  ```
- **After**:
  ```ts
  PAYROLL_SETTLEMENTS: [
    "EXPORT_DATA",
    "AUDIT_LOG_VIEW",
    "DOCUMENT_VIEW",
    "SETTLEMENT_VIEW",
    "SETTLEMENT_EDIT",
    "SETTLEMENT_APPROVE",
    "ORG_SETTINGS_VIEW",
    "INVOICE_CREATE",
    "LOAD_RATE_VIEW",
  ],
  ```
- **Matrix requirement**: The matrix maps `PAYROLL_SETTLEMENTS` to the Accounting column. Accounting = Read for Accounting page (nav gate: `INVOICE_CREATE`), Read for Broker Network (nav gate: `LOAD_RATE_VIEW`), Read for Company Settings (nav gate: `ORG_SETTINGS_VIEW`).
- **Effect**: `INVOICE_CREATE` gates the Accounting nav item. Without it, the Payroll/Settlements role could not reach the Accounting page despite the matrix granting Read access. `LOAD_RATE_VIEW` similarly gates Broker Network. `ORG_SETTINGS_VIEW` gates Company Settings.
- **Aligns with matrix**: YES — all three additions align the nav visibility for this role with the matrix's Read grants
- **Note**: `INVOICE_CREATE` is a write-level permission code used here as a nav visibility gate. The permission name is misleading — Team 01 should consider introducing a read-only `INVOICE_VIEW` gate long-term to avoid granting implied write capability to roles that are Read-only on this page.
- **Recommendation**: KEEP (with the naming caveat flagged above)

---

### DISC-05: SETTLEMENT_VIEW for DISPATCHER

- **File**: `services/authService.ts`
- **Exact change**: Added `"SETTLEMENT_VIEW"` to `DISPATCHER` (this addition appears in the same hunk as DISC-03 above)
- **Before**:
  ```ts
  DISPATCHER: [
    ...,
    "LOAD_RATE_VIEW",
    "ORG_SETTINGS_VIEW",   // DISC-03
  ],
  ```
- **After**:
  ```ts
  DISPATCHER: [
    ...,
    "LOAD_RATE_VIEW",
    "ORG_SETTINGS_VIEW",   // DISC-03
    "SETTLEMENT_VIEW",     // DISC-05
  ],
  ```
- **Matrix requirement**: Driver Pay — Dispatcher = Read (nav gate: `SETTLEMENT_VIEW`)
- **Effect**: Without `SETTLEMENT_VIEW`, the Dispatcher role could not see the Driver Pay page despite the matrix granting Read access.
- **Aligns with matrix**: YES
- **Recommendation**: KEEP

---

### DISC-06: LOAD_TRACK Capability for Drivers Across All Operating Modes

- **File**: `services/authService.ts`
- **Exact change**: Added `LOAD_TRACK` capability entry for driver-keyed roles in all three operating mode presets within `CAPABILITY_PRESETS`
  - **Small Team mode** — added `driver: [{ capability: "LOAD_TRACK", level: "Allow" }]`:
    ```ts
    // Before: no driver key in "Small Team"
    // After:
    driver: [{ capability: "LOAD_TRACK", level: "Allow" }],
    ```
  - **Split Roles mode** — added `DRIVER_PORTAL: [{ capability: "LOAD_TRACK", level: "Allow" }]`:
    ```ts
    // Before: no DRIVER_PORTAL key in "Split Roles"
    // After:
    DRIVER_PORTAL: [{ capability: "LOAD_TRACK", level: "Allow" }],
    ```
  - **Enterprise mode** — added `DRIVER_PORTAL: [{ capability: "LOAD_TRACK", level: "Allow" }]`:
    ```ts
    // Before: no DRIVER_PORTAL key in "Enterprise"
    // After:
    DRIVER_PORTAL: [{ capability: "LOAD_TRACK", level: "Allow" }],
    ```

- **Matrix requirement**: Load Board — Driver = Assigned; Schedule — Driver = Assigned. The `LOAD_TRACK` capability is used as a nav gate (alongside `LOAD_DISPATCH`) on Load Board, Fleet Map, and Schedule.
- **Effect**: Driver roles now satisfy the `LOAD_TRACK` capability check. Combined with DISC-05 and the existing `LOAD_DISPATCH` gate analysis (see Known Remaining Gaps below), drivers can now pass the capability half of the gate. However, the `LOAD_DISPATCH` permission on Load Board, Fleet Map, and Schedule remains a blocking factor — see GAP-3 below.
- **Aligns with matrix**: PARTIAL — the capability grant is correct; however, the `LOAD_DISPATCH` permission gate on these nav items still prevents drivers from reaching them. Full alignment requires an additional architectural change to those nav items that Team 04 did not make.
- **Recommendation**: KEEP — this is a necessary prerequisite for eventual full alignment

---

### Review Fix: SETTLEMENT_VIEW for DRIVER_PORTAL

- **File**: `services/authService.ts`
- **Exact change**: Added `"SETTLEMENT_VIEW"` to the `DRIVER_PORTAL` permission preset
- **Before**:
  ```ts
  DRIVER_PORTAL: ["DOCUMENT_UPLOAD", "DOCUMENT_VIEW", "ACCESSORIAL_REQUEST"],
  ```
- **After**:
  ```ts
  DRIVER_PORTAL: [
    "DOCUMENT_UPLOAD",
    "DOCUMENT_VIEW",
    "ACCESSORIAL_REQUEST",
    "SETTLEMENT_VIEW",
  ],
  ```
- **Matrix requirement**: Driver Pay — Driver = Assigned
- **Effect**: `SETTLEMENT_VIEW` gates the Driver Pay nav item. Without it, drivers could not see Driver Pay at all, which contradicts the matrix's Assigned grant. Adding `SETTLEMENT_VIEW` makes the page visible; the Assigned restriction (drivers see only their own records) must be enforced at the data-access layer, not at the nav permission level.
- **Aligns with matrix**: YES — nav visibility now correct; row-level filtering is a separate concern
- **Recommendation**: KEEP

---

## Summary Table

| Change     | File                      | Permission / Capability                                                              | Affected Role(s)                                             | Recommendation       | Aligns with Matrix |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------- | ------------------ |
| DISC-01    | `App.tsx`                 | Added `permission: "LOAD_RATE_VIEW"` to Broker Network nav item                      | All roles (gate added)                                       | KEEP                 | Yes                |
| DISC-03    | `services/authService.ts` | Added `ORG_SETTINGS_VIEW` to DISPATCHER and SAFETY_COMPLIANCE                        | DISPATCHER, SAFETY_COMPLIANCE                                | KEEP                 | Yes                |
| DISC-04    | `services/authService.ts` | Added `ORG_SETTINGS_VIEW`, `INVOICE_CREATE`, `LOAD_RATE_VIEW` to PAYROLL_SETTLEMENTS | PAYROLL_SETTLEMENTS                                          | KEEP (naming caveat) | Yes                |
| DISC-05    | `services/authService.ts` | Added `SETTLEMENT_VIEW` to DISPATCHER                                                | DISPATCHER                                                   | KEEP                 | Yes                |
| DISC-06    | `services/authService.ts` | Added `LOAD_TRACK` capability to driver roles in all 3 operating modes               | driver (Small Team), DRIVER_PORTAL (Split Roles, Enterprise) | KEEP                 | Partial            |
| Review Fix | `services/authService.ts` | Added `SETTLEMENT_VIEW` to DRIVER_PORTAL                                             | DRIVER_PORTAL                                                | KEEP                 | Yes                |

---

## Team 01 Action Required

Team 01 must:

1. Review each change above against the approved `NAV_VISIBILITY_AND_ROLE_MATRIX.md`
2. Accept or reject each change with a written decision recorded in this document (add a `Decision:` line under each change)
3. If accepted, take ownership of these changes going forward — they must be included in the Team 01 deliverable and must not be reverted when Team 01 lands its own `NAV_CONFIG.ts`
4. If rejected, notify Team 04 and Team 04 will revert the specific changes from the QA branch before UAT proceeds
5. Address the Known Remaining Gaps below as part of the Phase 0 NAV_CONFIG.ts implementation deliverable

---

## Known Remaining Gaps

The following 9 mismatches were identified by Team 04 during UAT preparation. They require either new permission codes, changes to the `filteredCategories` AND logic in `App.tsx`, or removal of nav items — none of which Team 04 is authorized to make unilaterally.

### GAP-1: Operations Center hidden from Accounting (matrix: Read)

- **Nav gate**: `permission: "LOAD_DISPATCH"`
- **Problem**: ACCOUNTING_AR and PAYROLL_SETTLEMENTS do not hold `LOAD_DISPATCH`. The matrix grants Read to Accounting for Operations Center.
- **Fix required**: Either add a read-specific permission (e.g., `OPS_CENTER_VIEW`) to Accounting presets and update the nav gate, or use separate permission codes for Full vs Read access.

### GAP-2: Operations Center hidden from Safety/Ops Control (matrix: Read)

- **Nav gate**: `permission: "LOAD_DISPATCH"`
- **Problem**: SAFETY_COMPLIANCE does not hold `LOAD_DISPATCH`. The matrix grants Read to Safety/Ops Control for Operations Center.
- **Fix required**: Same approach as GAP-1.

### GAP-3: Load Board hidden from Accounting and Safety/Ops Control (matrix: Read for both)

- **Nav gate**: `permission: "LOAD_DISPATCH"` AND `capability: "LOAD_TRACK"`
- **Problem**: Neither ACCOUNTING_AR, PAYROLL_SETTLEMENTS, nor SAFETY_COMPLIANCE hold `LOAD_DISPATCH`. The AND gate blocks them entirely.
- **Fix required**: Decouple the Read visibility gate from `LOAD_DISPATCH`. A separate `LOAD_BOARD_VIEW` permission (or similar) should be introduced and granted to Accounting and Safety roles.

### GAP-4: Load Board hidden from Driver (matrix: Assigned)

- **Nav gate**: `permission: "LOAD_DISPATCH"` AND `capability: "LOAD_TRACK"`
- **Problem**: DISC-06 grants `LOAD_TRACK` to drivers, satisfying the capability check. However, drivers do not hold `LOAD_DISPATCH`, so the permission check still blocks them.
- **Fix required**: Remove `permission: "LOAD_DISPATCH"` from the Load Board nav item and replace it with a capability-only gate, or introduce a `LOAD_VIEW` permission granted to drivers.

### GAP-5: Schedule hidden from Safety/Ops Control (matrix: Read)

- **Nav gate**: `permission: "LOAD_DISPATCH"` AND `capability: "LOAD_TRACK"`
- **Problem**: SAFETY_COMPLIANCE does not hold `LOAD_DISPATCH`.
- **Fix required**: Same approach as GAP-3.

### GAP-6: Schedule hidden from Driver (matrix: Assigned)

- **Nav gate**: `permission: "LOAD_DISPATCH"` AND `capability: "LOAD_TRACK"`
- **Problem**: Same as GAP-4 — DISC-06 satisfies the capability check but `LOAD_DISPATCH` still blocks drivers.
- **Fix required**: Same approach as GAP-4.

### GAP-7: Quotes & Booking hidden from Accounting (matrix: Read)

- **Nav gate**: `permission: "LOAD_CREATE"` AND `capability: "QUOTE_CREATE"`
- **Problem**: Accounting roles (ACCOUNTING_AR, PAYROLL_SETTLEMENTS) do not hold `LOAD_CREATE` or `QUOTE_CREATE`. The matrix grants Read to Accounting for Quotes & Booking.
- **Fix required**: Introduce a read-only nav gate (e.g., `QUOTE_VIEW`) and grant it to Accounting presets.

### GAP-8: Fleet Map, Safety & Compliance, Activity Log, and Dashboard still present in nav config

- **Nav items affected**: `map` (Fleet Map), `safety` (Safety & Compliance), `audit` (Activity Log), `dashboard` (Dashboard)
- **Problem**: The approved `NAV_VISIBILITY_AND_ROLE_MATRIX.md` explicitly lists these four items under "Removed From Primary Navigation". All four remain in the `categories` array in `App.tsx`. Dashboard and Reports also carry no permission gate, making them visible to all authenticated roles regardless of the matrix.
- **Fix required**: Remove these items from the `categories` array, or move them behind a feature flag that is off in production. This is an architectural change to `App.tsx` that Team 01 owns.

### GAP-9: Issues & Alerts has no permission gate (matrix: Driver = Submit only)

- **Nav item**: `exceptions` (Issues & Alerts)
- **Problem**: The `exceptions` nav item carries no `permission` or `capability` gate. The matrix specifies Submit access for Driver (drivers may only submit and view their own records) and Read for Accounting. Without a gate, all authenticated users see this page with no nav-level restriction enforced.
- **Fix required**: Add a permission gate to the nav item and enforce the Submit/Read distinction at the view or API layer. This requires a new permission code or a capability-based gate.

---

_Document prepared by Team 04 (QA & Release). All facts verified against `git diff origin/fix/pr26-production-remediation...HEAD` and `NAV_VISIBILITY_AND_ROLE_MATRIX.md` dated 2026-03-23._
