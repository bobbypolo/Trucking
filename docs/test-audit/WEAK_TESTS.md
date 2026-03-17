# Weak Test Audit Report

**Agent**: 10 (E2E Governance)
**Date**: 2026-03-17
**Scope**: Source-inspection tests, mock-heavy tests, shallow tests

---

## Classification Key

| Category | Definition |
|---|---|
| **Source-Inspection** | Reads source files with `fs.readFileSync` and asserts on string contents. Does not execute the code under test. |
| **Mock-Heavy** | Mocks the module being tested (DB, auth, services) so deeply that removing mocks would break every test. |
| **Shallow** | Tests trivial properties (e.g., asserting a string equals itself) without exercising real behavior. |
| **Contract-Only** | Documents expected behavior via in-memory assertions (no I/O, no rendering, no API calls). |

---

## Critical Findings

### 1. `src/__tests__/services/bookingsService.test.ts`

**Category**: Source-Inspection + Mock-Heavy
**Severity**: High

**What is wrong**:
- Lines 22-37 (R-S14-01, R-S14-02): All 5 tests use `fs.readFileSync` to read `services/storage/bookings.ts` and assert on string contents. These are source-inspection tests that verify code *contains* certain strings rather than verifying runtime behavior.
- Lines 103-187 (R-S14-03): The "functional" tests mock `fetch` globally with `vi.stubGlobal("fetch", mockFetch)`, then assert mock call arguments. They test the mock setup, not real HTTP behavior.

**Recommendation**: Replace source-inspection tests with integration tests that call `getBookings()`/`saveBooking()` against a real or test API server. The functional tests with mocked fetch are acceptable as unit tests but should be supplemented with E2E tests that verify actual API round-trips.

---

### 2. `server/__tests__/routes/modularization.test.ts`

**Category**: Source-Inspection
**Severity**: High

**What is wrong**:
- All 8 tests read source files with `fs.readFileSync` and assert on string patterns (e.g., `content.includes("Router()")`, `content.includes("export default router")`).
- Line 26-28: Checks index.ts line count by reading the file and splitting on newlines.
- Line 42-68: Iterates over route module files, reads each, and checks for string patterns like `"import { Router }"` and `"Router()"`.
- Line 92-133: Scans source files with regex to detect duplicate route definitions.
- None of these tests import, instantiate, or exercise the modules. They would pass even if the modules had runtime errors.

**Recommendation**: Replace with integration tests that import each route module, mount it on a test Express app, and verify at least one route responds correctly. The duplicate-route scanner (AC3) is a valid lint-style guard and can remain as a supplementary check.

---

### 3. `server/__tests__/integration/forbidden-patterns.test.ts`

**Category**: Source-Inspection (Lint Guard)
**Severity**: Medium (intentional by design, but not coverage)

**What is wrong**:
- All 22 tests read source files and scan for forbidden string patterns using `fs.readFileSync`, `grep`, and custom `scanFiles()`/`walkFiles()` utilities.
- These are static analysis guards, not behavioral tests. They verify that certain strings are absent from production code.
- They contribute to test count but provide zero code coverage of actual runtime paths.

**Recommendation**: Keep as CI lint guards (they serve a valid purpose preventing regressions), but do NOT count them toward coverage targets. They should be in a separate `lint/` or `guards/` test category so coverage reports are not inflated.

---

### 4. `src/__tests__/components/LoadCreation.test.tsx`

**Category**: Mock-Heavy
**Severity**: Medium

**What is wrong**:
- Lines 19-51: Mocks 3 service modules (`brokerService`, `authService`, `storageService`) completely. The component under test (`EditLoadForm`, `LoadSetupModal`) never touches real services.
- The tests do exercise real React rendering and user interactions (click, fireEvent), which is good.
- However, the mock layer is so thick that the tests would pass even if the real services were completely broken.

**Recommendation**: Keep these component tests but supplement with E2E tests that exercise the full load creation flow through the real UI with real API calls. The component tests are acceptable for isolated UI behavior verification.

---

### 5. `server/__tests__/routes/clients.test.ts`

**Category**: Mock-Heavy (but structurally sound)
**Severity**: Low

**What is wrong**:
- Mocks DB (`vi.mock("../../db")`), Firestore (`vi.mock("../../firestore")`), logger, helpers, and auth/tenant middleware.
- Uses supertest with real Express routing, which is good -- it exercises the actual route handler code.
- The auth middleware mock always injects `req.user`, which means auth rejection tests use a separate `buildUnauthApp()` that bypasses the real route entirely.

**Recommendation**: This is an acceptable pattern for route-level unit tests. The mock-DB approach tests SQL generation and error handling without a real database. Supplement with E2E API tests that use real auth tokens (already partially covered in `e2e/load-lifecycle.spec.ts` pattern).

---

### 6. `src/__tests__/components/*.labels.test.tsx` (11 files)

**Category**: Source-Inspection
**Severity**: High (cumulative)

**Files**:
- `Dashboard.labels.test.tsx`
- `CommandCenterView.labels.test.tsx`
- `ExceptionConsole.labels.test.tsx`
- `GlobalMapViewEnhanced.labels.test.tsx`
- `LoadBoardEnhanced.labels.test.tsx`
- `NetworkPortal.labels.test.tsx`
- `QuoteManager.labels.test.tsx`
- `SafetyView.labels.test.tsx`
- `AccountingPortal.labels.test.tsx`
- `CustomerPortalView.labels.test.tsx`
- `DriverMobileHome.labels.test.tsx`

**What is wrong**:
- Every file reads component source with `fs.readFileSync` and asserts that certain jargon strings are absent (e.g., `"Unified Command Center"`, `"Strategy & Analytics"`).
- These are string-absence checks on source code, not behavioral tests.
- They inflate the test count by ~50+ tests while providing zero code coverage.

**Recommendation**: Consolidate into a single lint guard file (similar to `forbidden-patterns.test.ts`). Do not count toward coverage targets.

---

### 7. `src/__tests__/components/Auth.jargon.test.tsx`

**Category**: Source-Inspection
**Severity**: High

**What is wrong**:
- Reads 9 component source files and asserts on 20+ string patterns.
- Tests things like `expect(authSource).toContain('placeholder="you@company.com"')` -- checking exact source code strings.
- Zero rendering, zero user interaction, zero runtime behavior.

**Recommendation**: Replace with E2E tests that render the login page and verify visible text. The jargon checks can remain as a separate lint guard.

---

### 8. `src/__tests__/components/App.devtools.test.tsx` and `IntelligenceHub.devtools.test.tsx`

**Category**: Source-Inspection
**Severity**: Medium

**What is wrong**:
- Both files read source code and assert on feature flag patterns (e.g., `features.apiTester`, `features.simulateActions`).
- They verify that feature guards appear before certain UI elements in the source text by comparing string indices.
- This is AST-level validation done via string matching -- fragile and not behavioral.

**Recommendation**: Replace with E2E tests that verify dev-tools UI elements are hidden when `import.meta.env.DEV` is false. Keep as supplementary guards if desired.

---

### 9. `src/__tests__/components/GlobalMapViewEnhanced.mockdata.test.tsx`

**Category**: Source-Inspection
**Severity**: Medium

**What is wrong**:
- Single test reads `GlobalMapViewEnhanced.tsx` with `fs.readFileSync` and checks that `seed %` pattern is absent.
- A one-line lint check masquerading as a test.

**Recommendation**: Move to forbidden-patterns or a lint guard. Not a valid coverage test.

---

### 10. `scripts/__tests__/*-syntax.test.ts` (11 files)

**Category**: Source-Inspection
**Severity**: Low (intentional)

**What is wrong**:
- All 11 files read shell scripts and documentation with `fs.readFileSync` and assert on content patterns.
- They verify script existence, shebang lines, required commands, and documentation structure.
- These are valid deployment artifact guards but provide zero runtime coverage.

**Recommendation**: Keep as deployment guards. Categorize separately from unit/integration tests.

---

### 11. `server/__tests__/routes/route-ownership-audit.test.ts` and `server/__tests__/middleware/route-audit.test.ts`

**Category**: Source-Inspection
**Severity**: Medium

**What is wrong**:
- Both files read route module source files and scan for patterns (route definitions, middleware usage).
- `route-audit.test.ts` verifies that every route has `requireAuth`/`requireTenant` by string-matching in source code.
- Valuable as a security lint guard, but not behavioral tests.

**Recommendation**: Keep as security guards. Supplement with E2E tests that actually hit each route without auth and verify 401/403 responses (partially done in existing E2E specs).

---

## Summary Table

| File | Category | Severity | Tests | Recommendation |
|---|---|---|---|---|
| `bookingsService.test.ts` | Source-Inspection + Mock | High | 10 | Replace with integration tests |
| `modularization.test.ts` | Source-Inspection | High | 8 | Replace with import/mount tests |
| `forbidden-patterns.test.ts` | Source-Inspection (Lint) | Medium | 22 | Keep as lint guard, recategorize |
| `LoadCreation.test.tsx` | Mock-Heavy | Medium | 11 | Keep, supplement with E2E |
| `clients.test.ts` | Mock-Heavy (sound) | Low | 17 | Acceptable, supplement with E2E |
| `*.labels.test.tsx` (11 files) | Source-Inspection | High | ~55 | Consolidate to lint guard |
| `Auth.jargon.test.tsx` | Source-Inspection | High | 20 | Replace with E2E rendering tests |
| `App.devtools.test.tsx` | Source-Inspection | Medium | 6 | Replace with E2E feature-flag tests |
| `IntelligenceHub.devtools.test.tsx` | Source-Inspection | Medium | 8 | Replace with E2E feature-flag tests |
| `GlobalMapViewEnhanced.mockdata.test.tsx` | Source-Inspection | Medium | 1 | Move to lint guard |
| `*-syntax.test.ts` (11 files) | Source-Inspection | Low | ~60 | Keep as deploy guards, recategorize |
| `route-ownership-audit.test.ts` | Source-Inspection | Medium | ~15 | Keep as security guard |
| `route-audit.test.ts` | Source-Inspection | Medium | ~10 | Keep as security guard |

**Total weak/source-inspection tests**: ~243 tests across ~30 files
**Impact**: These tests inflate test counts while providing near-zero code coverage. Recategorizing them would give a more accurate picture of actual behavioral test coverage.
