# Test Strategy

> Generated: 2026-03-07 | Story: R-P0-04
> Applies to: LoadPilot Recovery Program (Phases 1-6)

## 1. Framework Choice: Vitest

### Why Vitest

| Criterion | Vitest | Jest | Rationale |
|-----------|--------|------|-----------|
| Vite integration | Native | Requires transform config | LoadPilot uses Vite for frontend build; Vitest shares the same config |
| TypeScript support | Built-in (esbuild/SWC) | Requires ts-jest or babel | Zero-config TS support |
| ESM support | Native | Experimental | Frontend package.json has `"type": "module"` |
| Speed | ~2-5x faster than Jest | Baseline | Uses Vite's dev server for instant HMR-like test reloads |
| API compatibility | Jest-compatible API | N/A | `describe`, `it`, `expect`, `vi.mock()` -- same patterns |
| Watch mode | Built-in (Vite HMR) | Built-in | Faster file change detection via Vite |

### Installation Plan (Phase 1, R-P1-01)

**Frontend** (`package.json`):
```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

**Server** (`server/package.json`):
```bash
cd server && npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

### Configuration

**Frontend** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '**/*.test.*', '**/test/**', 'dist/'],
    },
  },
});
```

**Server** (`server/vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '**/*.test.*', 'dist/', 'migrations/'],
    },
  },
});
```

---

## 2. Test Tiers

### Tier 1: Unit Tests

| Attribute | Value |
|-----------|-------|
| **Scope** | Individual functions, utility modules, pure logic, state machine validators |
| **Runner** | `vitest run` |
| **Environment** | jsdom (frontend), node (server) |
| **Dependencies** | Mocked -- no real DB, no real API, no real Firebase |
| **Speed target** | < 30 seconds for full suite |
| **Coverage target** | 80% line coverage on changed files |
| **Naming convention** | `*.test.ts` / `*.test.tsx` colocated with source |
| **When to run** | Every commit (pre-commit hook), every CI push |

**Priority targets for unit tests:**
1. State machine transition validators (load, settlement) -- Phase 2
2. Financial calculation functions (driver pay, invoice totals, IFTA) -- Phase 4
3. Type guards and validation functions -- Phase 1
4. API client request/response transformers -- Phase 2

### Tier 2: Integration Tests

| Attribute | Value |
|-----------|-------|
| **Scope** | Route handlers with real middleware chain, DB interactions with test database |
| **Runner** | `vitest run --config vitest.integration.config.ts` |
| **Environment** | node (server only) |
| **Dependencies** | Test MySQL database (separate schema), mocked Firebase Auth |
| **Speed target** | < 2 minutes for full suite |
| **Coverage target** | 60% line coverage on route handlers |
| **Naming convention** | `*.integration.test.ts` in `server/__tests__/` |
| **When to run** | Pre-merge CI, nightly |

**Priority targets for integration tests:**
1. Auth middleware chain (token validation, tenant extraction) -- Phase 1
2. Load CRUD with state machine enforcement -- Phase 2
3. Settlement lifecycle (create, calculate, approve, post GL) -- Phase 4
4. Tenant isolation (verify company_id filtering) -- Phase 1

### Tier 3: Smoke Tests

| Attribute | Value |
|-----------|-------|
| **Scope** | Critical happy paths through the full stack (API + DB + Auth) |
| **Runner** | `vitest run --config vitest.smoke.config.ts` |
| **Environment** | node against running server instance |
| **Dependencies** | Running server, test database, Firebase Auth emulator |
| **Speed target** | < 5 minutes |
| **Coverage target** | N/A (path coverage, not line coverage) |
| **Naming convention** | `*.smoke.test.ts` in `__tests__/smoke/` |
| **When to run** | Pre-deploy, post-deploy verification |

**Smoke test scenarios (10 critical paths):**
1. User registration and login
2. Create company, create user, verify tenant isolation
3. Create load, advance through all status transitions to completed
4. Create invoice, verify GL journal entry posted
5. Create settlement, advance through lifecycle to posted
6. Create incident, add actions, close
7. Create quote, convert to booking, dispatch load
8. Upload document to vault, lock after approval
9. Create exception, triage, resolve
10. Global search returns tenant-scoped results

### Tier 4: Regression Tests

| Attribute | Value |
|-----------|-------|
| **Scope** | Full test suite (Tier 1 + Tier 2 + Tier 3) |
| **Runner** | `npm run test:all` |
| **Environment** | Full stack |
| **Speed target** | < 10 minutes |
| **Coverage target** | Combined 70% line coverage |
| **When to run** | Pre-release gate, nightly CI |

---

## 3. Coverage Targets by Phase

| Phase | Unit Target | Integration Target | Smoke Tests | Cumulative Target |
|-------|-------------|--------------------|-------------|-------------------|
| Phase 1 (Foundation) | 80% on new code | Auth middleware: 90% | 2 smoke paths | 40% overall |
| Phase 2 (Core Slice) | 80% on state machines | Load/Settlement CRUD: 70% | 5 smoke paths | 55% overall |
| Phase 3 (Integration) | 80% on new modules | API client integration: 60% | 7 smoke paths | 60% overall |
| Phase 4 (Financial) | 90% on financial calcs | GL posting: 80% | 9 smoke paths | 65% overall |
| Phase 5 (Stabilize) | 80% maintenance | Error handling paths: 60% | All 10 smoke paths | 70% overall |
| Phase 6 (Deploy) | No regression | No regression | All 10 pass | 70% overall |

### Coverage Enforcement

- **Gate rule**: No PR merged if coverage drops below phase target
- **New code rule**: All new files must have >= 80% coverage (unit) or explicit exemption with reason
- **Exemptions**: Configuration files, type definitions, migration scripts, seed scripts

---

## 4. Test Infrastructure

### Test Database

```
Database: trucklogix_test
Strategy: Clean schema per test suite run (not per test)
Setup: Run schema.sql + all migrations before suite
Teardown: DROP DATABASE after suite (CI) or TRUNCATE between suites (dev)
```

### Firebase Auth Emulator

```bash
firebase emulators:start --only auth
# Set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 in test .env
```

### CI Pipeline (npm scripts)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:server": "cd server && vitest run",
    "test:integration": "cd server && vitest run --config vitest.integration.config.ts",
    "test:smoke": "vitest run --config vitest.smoke.config.ts",
    "test:all": "npm run test && npm run test:server && npm run test:integration && npm run test:smoke"
  }
}
```

---

## 5. Testing Conventions

### File Organization

```
src/
  components/
    LoadList.tsx
    LoadList.test.tsx          # Tier 1: colocated unit test
  services/
    api.ts
    api.test.ts                # Tier 1: colocated unit test
  test/
    setup.ts                   # Global test setup (jsdom, matchers)

server/
  routes/
    loads.routes.ts
    loads.routes.test.ts       # Tier 1: unit test for route logic
  __tests__/
    loads.integration.test.ts  # Tier 2: integration test with DB
  middleware/
    auth.ts
    auth.test.ts               # Tier 1: unit test

__tests__/
  smoke/
    auth.smoke.test.ts         # Tier 3: smoke test
    load-lifecycle.smoke.test.ts
```

### Naming Patterns

| Pattern | Example | Tier |
|---------|---------|------|
| `describe('ModuleName')` | `describe('LoadStateMachine')` | All |
| `it('should <behavior>')` | `it('should reject planned->settled transition')` | All |
| `it.each(table)` | State machine transition matrix | Unit |
| `beforeAll` / `afterAll` | DB setup/teardown | Integration |

### Mocking Strategy

| Dependency | Unit Test Mock | Integration Test |
|------------|---------------|------------------|
| MySQL (pool) | `vi.mock('../db')` returning fake pool | Real test database |
| Firebase Auth | `vi.mock('firebase-admin')` returning fake tokens | Firebase Auth emulator |
| Firestore | `vi.mock('../firestore')` returning fake docs | Firebase Firestore emulator or mock |
| External APIs (Gemini, Maps) | `vi.mock()` with fixture responses | Same mocks (no real API calls) |
| localStorage | `vi.stubGlobal('localStorage', ...)` | N/A (server tests) |

---

## 6. Risk-to-Test Mapping

| Risk ID | Test Approach | Phase |
|---------|---------------|-------|
| RISK-001 (Unauth routes) | Integration: verify 401 on all protected routes | Phase 1 |
| RISK-002 (Tenant isolation) | Integration: verify query includes company_id filter | Phase 1 |
| RISK-003 (State machine) | Unit: transition table matrix test; Integration: API enforcement | Phase 2 |
| RISK-004 (localStorage) | Unit: verify zero localStorage calls in new API client | Phase 2 |
| RISK-005 (Mock seeding) | Unit: verify App.tsx does not call seed functions | Phase 2 |
| RISK-006 (Dual-write) | Integration: verify single SOR write path | Phase 1 |
| RISK-007 (Missing DDL) | Integration: verify all tables exist after migration run | Phase 1 |
| RISK-008 (Monolith) | Unit: each route module testable in isolation | Phase 2 |
| RISK-012 (Financial) | Unit: balanced-entry validation; Integration: idempotent GL posting | Phase 4 |
| RISK-016 (Status mismatch) | Unit: canonical status list shared between frontend/server | Phase 2 |
| RISK-018 (Optimistic lock) | Integration: concurrent update returns 409 | Phase 2 |
