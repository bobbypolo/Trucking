# Plan: UX Consolidation Sprint

## Goal

Implement 5 workstreams: (0) Firebase Emulator setup + Firestore cost-saving guards for zero-cost local dev, (1) Remove the duplicate "Driver Pay" nav item since Settlements IS driver pay, (2) Add role-based nav visibility so drivers only see their relevant pages while dispatchers see the three-surface dispatch model, (3) Verify SafetyView KPIs are data-driven (confirmed already fixed during Discovery), (4) Convert the Team tab user editor from a full-screen modal to a slide-out panel with inline quick-edit on roster rows.

Brainstorm: `.claude/docs/brainstorms/2026-03-31-ux-consolidation.md`

## System Context

### Files Read

<!-- Discovery via Glob(**/*.tsx), Grep("driver-pay|NavItem|categories"), Read(App.tsx, SafetyView.tsx, CompanyProfile.tsx, EditUserModal.tsx, authService.ts, types.ts) -->

| File | Findings |
|------|----------|
| `App.tsx` | NavItem interface (lines 158-164): `{id, label, icon, permission?, capability?}`. No `roles?` or `hideForRoles?` field. NavCategory: `{title, items}`. Categories array (lines 561-622): OPERATIONS (5 items), FINANCIALS (2 items: Financials + Driver Pay), ADMIN (2 items). filteredCategories (lines 624-648): checks admin bypass, then capability, then permission. No role-based filtering. LEGACY_TAB_ALIASES maps `settlements`/`payroll` to `driver-pay`. `driver-pay` tab renders `<Settlements>` at line 1108-1118. |
| `components/SafetyView.tsx` | KPIs computed dynamically at lines 438-518: `nonCompliantCount` from `operators.filter()`, `pendingMaintenanceCount` from `serviceTickets.filter()`, `oosCount` from `fleetEquipment.filter()`. Shows `"N/A"` when arrays are empty. No hardcoded `"13"`. Grep("13"|hardcoded) returned 0 matches. Already fixed. |
| `components/CompanyProfile.tsx` | TabId type: `identity`, `company_profile`, `registry`, `permissions`, `policy`, `driver_cockpit`. Registry tab (lines 1405-1466): renders user rows with Edit button that calls `setEditingUser(u)`. `EditUserModal` rendered at line 676. `handleUserUpdate` at lines 598-610 calls `updateUser()` then refreshes. |
| `components/EditUserModal.tsx` | Full-screen centered modal (392 lines). 3 tabs: `info`, `financials`, `access`. Has form validation, `useFocusTrap` hook, pay model picker, permission toggles. Currently `fixed inset-0` overlay with `flex items-center justify-center`. |
| `services/authService.ts` | `PERMISSION_PRESETS`: `DRIVER_PORTAL` has only `DOCUMENT_UPLOAD`, `DOCUMENT_VIEW`, `ACCESSORIAL_REQUEST`. `DISPATCHER` has `LOAD_CREATE/EDIT/DISPATCH/CLOSE`, `ACCESSORIAL_REQUEST`, `DOCUMENT_UPLOAD/VIEW`, `LOAD_RATE_VIEW`. `getEffectivePermissions()` returns full permissions object. `checkCapability()` checks per-role capability matrix. `updateUser()` calls `api.post("/users", user)` and updates cache. |
| `types.ts` | `UserRole` union: `admin`, `driver`, `owner_operator`, `safety_manager`, `dispatcher`, `payroll_manager`, `customer` + 12 Enterprise roles. `OperatingMode`: `"Small Team"` \| `"Split Roles"` \| `"Enterprise"`. |
| `src/__tests__/components/App.navigation.test.tsx` | Source-file-based tests checking nav labels. Line 33 test says "Driver Pay" is within AccountingPortal (test comment contradicts actual code). Tests check retired labels aren't in categories block. |
| `src/__tests__/components/SafetyView.kpi.test.tsx` | Tests R-P6-01 through R-P6-04: verifies KPIs computed from API data, not hardcoded. Tests already pass with dynamic values. |
| `src/__tests__/components/EditUserModal.test.tsx` | Tests for `EditUserModal` rendering and validation. |
| `src/__tests__/components/CompanyProfile.test.tsx` | Tests for `CompanyProfile` rendering. |

### Data Flow Diagram

```bash
# Grep output: filteredCategories filter chain in App.tsx lines 624-648
# user?.role === "admin" -> return true (bypass all gates)
# item.capability -> checkCapability(user!, item.capability, undefined, company)
# item.permission -> permissions.permissions?.includes(item.permission!)
# categories.filter(cat => cat.items.length > 0) -> remove empty categories

User authenticates -> App.tsx gets user.role + permissions
  -> categories array defines all nav items with permission/capability gates
  -> filteredCategories removes items user lacks permission for
  -> Sidebar renders filteredCategories
  -> Tab click sets activeTab -> renders corresponding component
  -> CompanyProfile registry tab -> user row -> EditUserModal (full-screen)
```

### Existing Patterns

- Nav filtering uses `permission` (PermissionCode) and `capability` (Capability) fields on NavItem
- Permission check: `permissions.permissions?.includes(item.permission!)`
- Capability check: `checkCapability(user!, item.capability, ...)`
- Admin bypass: `if (user?.role === "admin") return true`
- EditUserModal uses `useFocusTrap` hook and form validation pattern

### Blast Radius Assessment

| File / Module | Impact | Risk |
|---------------|--------|------|
| `App.tsx` | Nav items removed + role filter added | Medium -- affects what every user sees |
| `App.navigation.test.tsx` | Must update to reflect Driver Pay removal | Low |
| `components/EditUserModal.tsx` | Converted from modal to slide-out panel | Medium -- visual change, same functionality |
| `components/CompanyProfile.tsx` | Inline quick-edit fields added to roster rows | Medium -- new UI on existing tab |
| `LEGACY_TAB_ALIASES` in App.tsx | Remove `settlements` and `payroll` aliases to `driver-pay` | Low -- redirect cleanup |

---

## Phase 0 -- Firebase Emulator Setup + Firestore Cost-Saving Guards

**Phase Type**: `foundation`

### Rationale

All local dev and CI must use the Firebase Emulator Suite (Auth + Firestore) to avoid incurring Firebase usage charges. Server-side Firestore reads must add `.limit()` guards, and no `onSnapshot` listeners should exist on large collections.

### Discovery

| File | Current State |
|------|---------------|
| `server/auth.ts` | Loads `serviceAccount.json` → `admin.initializeApp()`. No emulator detection. |
| `server/firestore.ts` | Gets `admin.firestore()`. No emulator env var check. |
| `services/firebase.ts` | Client-side Auth init. No `connectAuthEmulator` call. |
| `firebase.json` | Hosting config only — no `emulators` block. |
| Server Firestore reads | 7 `.collection()` calls in routes — all single-doc `.doc(id).get()` reads. No unbounded collection scans. No `.limit()` needed on single-doc reads. |
| Frontend Firestore | Zero direct Firestore client SDK usage — all data via Express API. |
| `onSnapshot` | Zero occurrences in entire codebase. Already clean. |

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `firebase.json` | Add `emulators` block: `auth` on port 9099, `firestore` on port 8080, `ui` on port 4000. | `server/__tests__/integration/firebase-emulator.test.ts` | integration |
| MODIFY | `server/auth.ts` | After `admin.initializeApp()`, detect `FIREBASE_AUTH_EMULATOR_HOST` env var. If set, log that auth emulator is active. Firebase Admin SDK auto-connects to emulator when this env var is set — no code change needed beyond logging. | `server/__tests__/integration/firebase-emulator.test.ts` | integration |
| MODIFY | `server/firestore.ts` | After `admin.firestore()`, detect `FIRESTORE_EMULATOR_HOST` env var. If set, log that Firestore emulator is active. Firebase Admin SDK auto-connects when env var is set. | `server/__tests__/integration/firebase-emulator.test.ts` | integration |
| MODIFY | `services/firebase.ts` | Import `connectAuthEmulator` from `firebase/auth`. If `VITE_USE_FIREBASE_EMULATOR === "true"`, call `connectAuthEmulator(auth, "http://localhost:9099")` after `getAuth()`. | `src/__tests__/services/firebase.test.ts` | unit |
| CREATE | `.env.emulator` | Template env file for emulator mode: `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, `FIRESTORE_EMULATOR_HOST=localhost:8080`, `VITE_USE_FIREBASE_EMULATOR=true`. | N/A | N/A |
| MODIFY | `.env` | Add comment block documenting emulator usage: `# To use Firebase Emulators (zero cost): source .env.emulator && firebase emulators:start` | N/A | N/A |

### Interface Contracts

| Component | Env Var | Behavior |
|-----------|---------|----------|
| Server Auth | `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` | Firebase Admin SDK auto-routes auth verification to emulator |
| Server Firestore | `FIRESTORE_EMULATOR_HOST=localhost:8080` | Firebase Admin SDK auto-routes Firestore reads/writes to emulator |
| Frontend Auth | `VITE_USE_FIREBASE_EMULATOR=true` | Client SDK calls `connectAuthEmulator` to route sign-in to emulator |

### Data Flow

```
Developer starts emulators:
  firebase emulators:start
  -> Auth emulator on :9099, Firestore emulator on :8080

Server (with FIREBASE_AUTH_EMULATOR_HOST set):
  -> admin.auth().verifyIdToken() routes to emulator
  -> admin.firestore().collection().doc().get() routes to emulator
  -> Zero Firebase cloud reads/writes

Frontend (with VITE_USE_FIREBASE_EMULATOR=true):
  -> signInWithEmailAndPassword routes to emulator
  -> User created in emulator, not cloud
  -> Zero Firebase cloud auth calls
```

### Done When

- R-P0-01: `firebase.json` contains an `emulators` block with `auth.port` = 9099 and `firestore.port` = 8080
- R-P0-02: `server/auth.ts` logs `"Firebase Auth Emulator active"` when `FIREBASE_AUTH_EMULATOR_HOST` env var is set
- R-P0-03: `server/firestore.ts` logs `"Firestore Emulator active"` when `FIRESTORE_EMULATOR_HOST` env var is set
- R-P0-04: `services/firebase.ts` calls `connectAuthEmulator` when `VITE_USE_FIREBASE_EMULATOR === "true"`
- R-P0-05: `.env.emulator` file exists with `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, and `VITE_USE_FIREBASE_EMULATOR` variables
- R-P0-06: Zero `onSnapshot` calls exist on collection-level queries in the codebase (grep verification — already passing, formalize as regression gate)
- R-P0-07: All server-side Firestore reads are single-doc `.doc(id).get()` or have `.limit()` applied (grep verification)

### Verification Command

```bash
# Verify emulator config
grep -q '"auth"' firebase.json && grep -q '"firestore"' firebase.json && echo "PASS: emulator config" || echo "FAIL"
# Verify no unbounded collection scans (no .get() without .doc() or .limit())
grep -rn "\.collection(" server/routes/ --include="*.ts" | grep -v "\.doc(" | grep -v "\.limit(" | grep -v "__tests__" | grep -v "node_modules"
# Verify zero onSnapshot
grep -rn "onSnapshot" services/ components/ server/routes/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "node_modules" | wc -l
```

---

## Phase 1 -- Remove Driver Pay Nav + Role-Based Nav Visibility

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `App.tsx` | Remove "Driver Pay" nav item from FINANCIALS category. Remove `settlements` and `payroll` entries from LEGACY_TAB_ALIASES. Remove `driver-pay` tab rendering block (lines 1108-1118). Add optional `roles?: UserRole[]` field to NavItem interface. Add role-based visibility to Operations Center (hide for drivers), Telematics (hide for drivers), Onboarding (hide for drivers). Clean up unused Wallet import if no longer referenced. | `src/__tests__/components/App.navigation.test.tsx` | unit |
| MODIFY | `src/__tests__/components/App.navigation.test.tsx` | Update test: remove test asserting `"Driver Pay"` exists. Add test asserting `"Driver Pay"` is NOT in `categories` block. Add tests verifying `roles` array present on `operations-hub` nav items. Add negative test: `"driver"` role not in `operations-hub` `roles`. | `src/__tests__/components/App.navigation.test.tsx` | unit |

### Untested Files

N/A -- all changes have direct test coverage.

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `NavItem.roles` (new field) | `roles?: UserRole[]` | Optional array of roles that can see this item | If set, item only visible to listed roles (+ admin always sees all) | N/A | `filteredCategories` filter logic | N/A |
| `filteredCategories` filter (modified) | `categories.map().filter()` | `NavItem` with optional `roles`, `user.role` | Filtered categories excluding items where user role not in `roles` | N/A | Sidebar render | `NavItem.roles` |

### Data Flow

```
categories array (with roles? annotations)
  -> filteredCategories map+filter
     -> If item.roles defined AND user.role !== 'admin':
        -> Check user.role is in item.roles array
        -> If not: filter out
     -> Existing permission + capability checks remain
  -> Sidebar renders filtered items
```

Error paths: If `roles` is undefined/empty on an item, it is visible to all (backward compatible). Admin always bypasses.

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|---------------------|
| `"Driver Pay"` removed from categories | unit | Real | Pure string assertion on source file read via `fs.readFileSync` | `App.navigation.test.tsx` | `expect(categoryBlock).not.toContain('"Driver Pay"')` |
| `"driver-pay"` removed from `LEGACY_TAB_ALIASES` | unit | Real | Pure string assertion on source | `App.navigation.test.tsx` | `expect(aliasBlock).not.toContain('driver-pay')` |
| `operations-hub` has `roles` annotation | unit | Real | Verify `roles` array exists on `operations-hub` nav item | `App.navigation.test.tsx` | `expect(opsHubItem).toContain('roles:')` |
| `"driver"` not in `operations-hub` roles | unit | Real | Verify driver role excluded from ops center nav | `App.navigation.test.tsx` | `expect(opsHubRoles).not.toContain('"driver"')` |
| Item with `roles` that excludes user role is filtered out | unit | Real | Verify filter logic rejects non-matching role | `App.navigation.test.tsx` | `expect(categoryBlock).toContain('item.roles')` in the filter function |

### Done When

- R-P1-01: The string `"Driver Pay"` does not appear as a nav label in the `categories` array in `App.tsx`
- R-P1-02: `LEGACY_TAB_ALIASES` in `App.tsx` does not contain entries mapping to `"driver-pay"` (0 occurrences)
- R-P1-03: The `activeTab === "driver-pay"` rendering block is removed from `App.tsx` (0 occurrences in render)
- R-P1-04: `NavItem` interface in `App.tsx` includes `roles?: UserRole[]` field (Grep for `roles\?:` in `NavItem` returns 1 match)
- R-P1-05: `operations-hub` nav item includes a `roles` array that does NOT contain `"driver"` or `"DRIVER_PORTAL"`
- R-P1-06: `loads` (Load Board) nav item has no `roles` restriction OR its `roles` array includes both `"dispatcher"` and `"driver"`
- R-P1-07: `filteredCategories` filter function checks `item.roles` and returns `false` when `user.role` is not in the array (admin bypasses)
- R-P1-08: `npx vitest run src/__tests__/components/App.navigation.test.tsx` exits with code 0 and all assertions pass
- R-P1-09: `filteredCategories` fails when `user.role === "driver"` attempts to access `operations-hub` -- returns 0 items matching that `id` (role-gated item filtered out)

### Verification Command

```bash
npx vitest run src/__tests__/components/App.navigation.test.tsx --reporter=verbose
```

---

## Phase 2 -- SafetyView KPI Verification (Confirmed Fixed)

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `src/__tests__/components/SafetyView.kpi.test.tsx` | Add test verifying that with `getCompanyUsers` returning `[]`, the `"Non-Compliant"` KPI shows `"N/A"` not a hardcoded number. Add test verifying with `getEquipment` returning `[]`, `"Out of Service"` KPI shows `"N/A"`. These tests formalize that the demo blocker is resolved. | `src/__tests__/components/SafetyView.kpi.test.tsx` | unit |

### Untested Files

N/A -- SafetyView.tsx is not modified (KPIs already data-driven). Only new tests added.

### Interface Contracts

N/A -- No new interfaces. Existing SafetyView KPI computation is unchanged.

### Data Flow

```
SafetyView mounts
  -> useEffect fetches /api/safety/*, getCompanyUsers, getEquipment, getServiceTickets
  -> operators array populated from API response
  -> KPI cards computed: nonCompliantCount = operators.filter(op => low score).length
  -> If operators.length === 0: displays "N/A" (not hardcoded number)
  -> If fleetEquipment.length === 0: OOS displays "N/A"
```

Error paths: API failure -> loading/error state shown (already handled by existing ErrorState component).

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|---------------------|
| Empty operators shows `"N/A"` for Non-Compliant | unit | Mock | Network calls mocked at service boundary via `vi.mock`, render logic exercised real | `SafetyView.kpi.test.tsx` | `expect(screen.getByText('N/A')).toBeInTheDocument()` when `getCompanyUsers` returns `[]` |
| Empty fleet shows `"N/A"` for Out of Service | unit | Mock | Network calls mocked at service boundary via `vi.mock`, render logic exercised real | `SafetyView.kpi.test.tsx` | `expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2)` when `getEquipment` returns `[]` |
| Non-empty operators shows count not `"N/A"` | unit | Mock | Verify positive case: operators with low score yield numeric count | `SafetyView.kpi.test.tsx` | `expect(screen.getByText('1')).toBeInTheDocument()` (existing test R-P6-01 already covers) |

### Done When

- R-P2-01: A test renders `SafetyView` with `getCompanyUsers` returning `[]` and asserts the `"Non-Compliant"` KPI card displays `"N/A"` (not a hardcoded number like `"13"`)
- R-P2-02: A test renders `SafetyView` with `getEquipment` returning `[]` and asserts the `"Out of Service"` KPI card displays `"N/A"` (not a hardcoded number)
- R-P2-03: With 1 operator having `totalScore < 70`, the Non-Compliant KPI displays `"1"` not `"N/A"` (positive case, covered by existing R-P6-01 test)
- R-P2-04: Grep for hardcoded `"13"` in `SafetyView.tsx` KPI rendering returns 0 matches -- rejects hardcoded compliance counts

### Verification Command

```bash
npx vitest run src/__tests__/components/SafetyView.kpi.test.tsx --reporter=verbose
```

---

## Phase 3 -- Team Tab Slide-Out Profile Editor with Inline Quick Edit

**Phase Type**: `module`

### Changes

| Action | File | Description | Test File | Test Type |
|--------|------|-------------|-----------|-----------|
| MODIFY | `components/EditUserModal.tsx` | Convert from full-screen centered modal to right-side slide-out panel. Change outer wrapper from `fixed inset-0 ... flex items-center justify-center` to `fixed inset-y-0 right-0 w-full max-w-2xl` with slide-in-from-right animation. Add responsive handling: full-width via `md:max-w-2xl` (full-screen below 768px). Keep all 3 existing tabs, validation, and `useFocusTrap`. Rename export to `UserProfilePanel` with backward-compatible `EditUserModal` re-export. | `src/__tests__/components/EditUserModal.test.tsx` | unit |
| MODIFY | `components/CompanyProfile.tsx` | Add inline quick-edit fields to each user row in the `registry` tab: `<select>` for `user.role` and `<input type="number">` for `user.payRate`. On change, call `handleUserUpdate` with the modified user. Add `ChevronRight` "Details" button that opens the slide-out via `setEditingUser(u)`. | `src/__tests__/components/CompanyProfile.test.tsx` | unit |
| MODIFY | `src/__tests__/components/EditUserModal.test.tsx` | Update tests to verify slide-out positioning (`right-0`, `inset-y-0`). Verify `UserProfilePanel` export exists. Verify all 3 tabs (`"Identity"`, `"Pay Profile"`, `"Access"`) render in slide-out layout. | `src/__tests__/components/EditUserModal.test.tsx` | unit |
| MODIFY | `src/__tests__/components/CompanyProfile.test.tsx` | Add tests for inline quick-edit: `role` dropdown renders per user row, `payRate` input renders, change triggers `handleUserUpdate`. Add test for Details button opening slide-out. Add negative test: `payRate` rejects value `-1`. | `src/__tests__/components/CompanyProfile.test.tsx` | unit |

### Untested Files

N/A -- all changes have direct test coverage.

### Interface Contracts

| Component | Signature | Input | Output | Errors | Called By | Calls |
|-----------|-----------|-------|--------|--------|-----------|-------|
| `UserProfilePanel` (renamed EditUserModal) | `React.FC<{user: User; onSave: (u: User) => void; onCancel: () => void}>` | Same props as current EditUserModal | Same behavior: calls onSave with updated User | Validation errors shown inline | CompanyProfile registry tab | N/A |
| `EditUserModal` (re-export) | `export { UserProfilePanel as EditUserModal }` | Same as UserProfilePanel | Backward compatible alias | N/A | Any file importing EditUserModal | UserProfilePanel |
| Inline quick-edit (role dropdown) | Embedded in CompanyProfile user row JSX | User object, handleUserUpdate callback | Calls handleUserUpdate with `{...user, role: newRole}` | API error caught by handleUserUpdate try/catch | CompanyProfile registry tab | `updateUser` via `handleUserUpdate` |
| Inline quick-edit (pay rate) | Embedded in CompanyProfile user row JSX | User object, handleUserUpdate callback | Calls handleUserUpdate with `{...user, payRate: newRate}` on blur | API error caught by handleUserUpdate try/catch, negative rate prevented | CompanyProfile registry tab | `updateUser` via `handleUserUpdate` |

### Data Flow

```
CompanyProfile registry tab renders user rows
  -> Each row shows: avatar, name, role dropdown (inline), pay rate input (inline), Details button
  -> Role dropdown onChange:
     -> Create modified user: {...user, role: newRole}
     -> Call handleUserUpdate(modifiedUser)
     -> handleUserUpdate calls updateUser() API -> refresh user list
     -> Error: show toast "Failed to save user changes"
  -> Pay rate input onBlur:
     -> Validate: rate >= 0
     -> Create modified user: {...user, payRate: newRate}
     -> Call handleUserUpdate(modifiedUser)
     -> Error: show toast
  -> Details button (or pencil icon) onClick:
     -> setEditingUser(user) -> renders UserProfilePanel (slide-out from right)
     -> Slide-out slides in from right with backdrop
     -> On save: handleUserUpdate -> close panel -> refresh
     -> On cancel: setEditingUser(null) -> panel slides out
```

Error paths:
- API failure on inline edit: toast notification via showMsg, user data refreshed on next load
- Invalid pay rate (negative): inline validation prevents save
- Network timeout: existing api.ts retry/timeout handling applies

### Testing Strategy

| What | Type | Real/Mock | Justification | Test File | Assertion Blueprint |
|------|------|-----------|---------------|-----------|---------------------|
| Slide-out panel has `right-0` positioning | unit | Real | DOM class assertion on rendered output, no network calls | `EditUserModal.test.tsx` | `expect(panel.className).toContain('right-0')` |
| Slide-out panel renders 3 tabs | unit | Real | Existing tab functionality preserved, pure render check | `EditUserModal.test.tsx` | `expect(screen.getByText('Identity')).toBeInTheDocument()` |
| `UserProfilePanel` export exists | unit | Real | Import check, no mocking needed | `EditUserModal.test.tsx` | `expect(UserProfilePanel).toBeDefined()` |
| Inline role `<select>` renders per user | unit | Mock | `getCompanyUsers` mocked at service boundary, DOM interaction real | `CompanyProfile.test.tsx` | `expect(screen.getAllByLabelText(/role/i).length).toBe(2)` for 2 users |
| Inline `payRate` `<input>` present per user row | unit | Mock | `getCompanyUsers` mocked at service boundary, DOM interaction real | `CompanyProfile.test.tsx` | `expect(screen.getAllByLabelText(/pay rate/i).length).toBeGreaterThanOrEqual(1)` |
| Details button opens slide-out | unit | Mock | `getCompanyUsers` mocked, click interaction real | `CompanyProfile.test.tsx` | After click, `expect(screen.getByText('Identity')).toBeInTheDocument()` |
| Negative `payRate` value `-1` is rejected | unit | Mock | `getCompanyUsers` mocked, validation logic real | `CompanyProfile.test.tsx` | `expect(updateUser).not.toHaveBeenCalled()` after entering `-1` |

### Done When

- R-P3-01: `EditUserModal.tsx` outer wrapper uses `right-0` and `inset-y-0` CSS classes (not `inset-0` with centered flex)
- R-P3-02: Panel outer div contains CSS classes `w-full` and `md:max-w-2xl` -- below 768px viewport the panel renders at 100% width
- R-P3-03: `screen.getByText("Identity")`, `screen.getByText("Pay Profile")`, and `screen.getByText("Access")` all return truthy in a render of `UserProfilePanel`
- R-P3-04: `CompanyProfile` registry tab renders 1 `<select>` element with `aria-label` containing `"role"` per user row
- R-P3-05: Changing the inline role `<select>` to `"dispatcher"` calls `updateUser` with `expect.objectContaining({ role: "dispatcher" })`
- R-P3-06: `CompanyProfile` registry tab renders 1 `<input type="number">` with `aria-label` containing `"pay rate"` per user row
- R-P3-07: Blurring the `payRate` input with value `50` calls `updateUser` with `expect.objectContaining({ payRate: 50 })`
- R-P3-08: Clicking the `ChevronRight` details button renders `UserProfilePanel` with `screen.getByText("Identity")` returning truthy
- R-P3-09: `import { EditUserModal } from "./EditUserModal"` resolves to `UserProfilePanel` (backward-compatible re-export)
- R-P3-10: `npx vitest run src/__tests__/components/EditUserModal.test.tsx` exits with code 0 after conversion
- R-P3-11: Entering `payRate` value `-1` in the inline input does NOT trigger `updateUser` (invalid input rejected)

### Verification Command

```bash
npx vitest run src/__tests__/components/EditUserModal.test.tsx src/__tests__/components/CompanyProfile.test.tsx --reporter=verbose
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Removing Driver Pay nav breaks bookmarks/deep links | Medium | Low | LEGACY_TAB_ALIASES cleanup handles redirect. Users hitting old `settlements` or `payroll` aliases now route to `accounting`. |
| Role-based nav hides pages from users who need them | Medium | High | Admin always sees everything. Load Board visible to all roles. Test each role. |
| Slide-out panel blocks content on mobile | Low | Medium | Full-screen takeover on screens < 768px (Tailwind `md:` breakpoint). |
| Inline quick-edit accidental saves | Low | Medium | Pay rate saves on blur only (not on every keystroke). Role dropdown saves on change with existing error handling. |
| Backward compatibility of EditUserModal import | Low | Low | Re-export `UserProfilePanel as EditUserModal` maintains all existing imports. |

## Dependencies

- **Internal**: `services/authService.ts` (updateUser, PERMISSION_PRESETS), `types.ts` (UserRole), `hooks/useFocusTrap.ts`
- **External**: None (no new libraries required)

## Rollback Plan

1. `git revert` the commits from this sprint on the feature branch
2. All changes are UI-only -- no database migrations, no API changes, no schema changes
3. The existing EditUserModal full-screen layout is preserved via `UserProfilePanel` alias; reverting restores the `fixed inset-0` positioning

## Open Questions

None -- all decisions were made in the brainstorm and confirmed during Discovery. SafetyView KPIs are already data-driven (no fix needed, only test formalization).
