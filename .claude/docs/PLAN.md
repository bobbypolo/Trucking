# Fleet OS Complete -- Ralph Mega-Sprint

## Goal

Convert LoadPilot SaaS into a production-ready fleet operating system.
Single Ralph sprint: 8 gated phases (A-H), ~100 stories,
~400 R-markers across 12 workstreams.
Phase gates enforced via story dependencies.

**Base branch**: main
**Issue ref**: Fleet OS Master Plan (docs/MASTER_PLAN_FLEET_OS.md)
**Branch**: ralph/fleet-os-complete
**R-marker convention**: R-FLEET-W{workstream}-{XX}

## Operating Constraints

1. Phase-gate checkpoint after each execution phase
2. Re-baseline qa_runner after each phase
3. Cross-phase replanning if assumptions invalidated
4. Circuit breaker on 2x phase verification failure
5. Parallel dispatch only within a phase

## Dependency Graph

```
A(1-12) -> B(13-22) -> C(23-32) -> F(59-71) -> G(72-86) -> H(87-100)
                    -> D(33-44) -> G
                    -> E(45-58) -> G
```

## Phase 1 -- Route inventory and allowlist

**Phase Type**: module

<!-- Phase: A | A-01 | W0 | PG:1 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/*` | Route inventory and allowlist |

### Done When

- R-FLEET-W0-01 [backend]: Every route is classified and the explicit allowlist is documented and tested
- R-FLEET-W0-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/route-audit.test.ts
```

## Phase 2 -- Missing auth / tenant / validation closure

**Phase Type**: module

<!-- Phase: A | A-02 | W0 | PG:1 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `route files missing guards` | Missing auth / tenant / validation closure |

### Done When

- R-FLEET-W0-04 [backend]: Known gaps are closed and route audit passes
- R-FLEET-W0-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/route-audit.test.ts
```

## Phase 3 -- Server-side RBAC completion

**Phase Type**: module

<!-- Phase: A | A-03 | W0 | PG:1 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/loads.ts, server/routes/accounting.ts, server/routes/documents.ts` | Server-side RBAC completion |

### Done When

- R-FLEET-W0-07 [backend]: Sensitive routes enforce server-side roles and tiers
- R-FLEET-W0-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/route-audit.test.ts
```

## Phase 4 -- Pagination and filtering standard

**Phase Type**: module

<!-- Phase: A | A-04 | W0 | PG:1 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `list-heavy routes` | Pagination and filtering standard |

### Done When

- R-FLEET-W0-10 [backend]: Large endpoints expose and honor pagination and filters
- R-FLEET-W0-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/route-audit.test.ts
```

## Phase 5 -- Health check and dependency readiness

**Phase Type**: module

<!-- Phase: A | A-05 | W0 | PG:2 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/health.ts` | Health check and dependency readiness |

### Done When

- R-FLEET-W0-13 [backend]: Health reflects DB and dependency readiness correctly
- R-FLEET-W0-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/ --reporter=default
```

## Phase 6 -- Rate limiting and idempotency baseline

**Phase Type**: module

<!-- Phase: A | A-06 | W0 | PG:2 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `middleware` | Rate limiting and idempotency baseline |

### Done When

- R-FLEET-W0-16 [backend]: Repeated writes are safe and abusive traffic is constrained
- R-FLEET-W0-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/ --reporter=default
```

## Phase 7 -- Tenant isolation regression pack

**Phase Type**: module

<!-- Phase: A | A-07 | W0 | PG:2 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `routes` | Tenant isolation regression pack |

### Done When

- R-FLEET-W0-19 [backend]: Cross-tenant regression suite passes
- R-FLEET-W0-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/middleware/ --reporter=default
```

## Phase 8 -- `server/index.ts` modularization

**Phase Type**: module

<!-- Phase: A | A-08 | W0 | PG:2 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/index.ts` | `server/index.ts` modularization |

### Done When

- R-FLEET-W0-22 [backend]: Bootstrap is delegated cleanly and route behavior is unchanged
- R-FLEET-W0-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W0-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/modularization.test.ts __tests__/routes/health.test.ts
```

## Phase 9 -- Canonical load / trip / stop ruling implementation scaffold

**Phase Type**: module

<!-- Phase: A | A-09 | W1 | PG:3 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `docs/architecture/entity-ownership-map.md` | Canonical load / trip / stop ruling implementation scaffold |

### Done When

- R-FLEET-W1-01 [backend]: Architecture ruling is encoded in contracts and docs
- R-FLEET-W1-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 10 -- Trip foundation schema

**Phase Type**: module

<!-- Phase: A | A-10 | W1 | PG:3 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| ADD | `new trip table and load-to-trip linkage migrations` | Trip foundation schema |

### Done When

- R-FLEET-W1-04 [backend]: First-class trip entity exists without breaking current flows
- R-FLEET-W1-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 11 -- Stop linkage normalization

**Phase Type**: module

<!-- Phase: A | A-11 | W1 | PG:3 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `load_legs` | Stop linkage normalization |

### Done When

- R-FLEET-W1-07 [backend]: Existing `load_legs` is linked into the new execution model
- R-FLEET-W1-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 12 -- Document lineage foundation

**Phase Type**: module

<!-- Phase: A | A-12 | W1 | PG:3 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `document schema and indexes` | Document lineage foundation |

### Done When

- R-FLEET-W1-10 [docs]: Documents can link to canonical parents under the new lineage model
- R-FLEET-W1-11 [docs]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-12 [docs]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 13 -- Lineage matrix and ownership enforcement

**Phase Type**: module

<!-- Phase: B | B-01 | W1 | PG:5 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `contracts` | Lineage matrix and ownership enforcement |

### Done When

- R-FLEET-W1-13 [backend]: Canonical ownership map is implemented, not just documented
- R-FLEET-W1-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 14 -- OCR result lineage completion

**Phase Type**: module

<!-- Phase: B | B-02 | W1 | PG:5 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `OCR tables` | OCR result lineage completion |

### Done When

- R-FLEET-W1-16 [backend]: OCR results can be traced to document and business context
- R-FLEET-W1-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 15 -- Settlement lineage schema

**Phase Type**: module

<!-- Phase: B | B-03 | W1 | PG:5 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `settlement tables and repositories` | Settlement lineage schema |

### Done When

- R-FLEET-W1-19 [backend]: Settlement records and lines trace to load and trip correctly
- R-FLEET-W1-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 16 -- Expense and reimbursement lineage

**Phase Type**: module

<!-- Phase: B | B-04 | W1 | PG:5 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `financial tables and services` | Expense and reimbursement lineage |

### Done When

- R-FLEET-W1-22 [backend]: Expenses tie to source trip, stop, document, or policy
- R-FLEET-W1-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 17 -- Telematics lineage schema

**Phase Type**: module

<!-- Phase: B | B-05 | W1 | PG:6 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `tracking tables and repositories` | Telematics lineage schema |

### Done When

- R-FLEET-W1-25 [backend]: Telemetry can attach to trip and vehicle consistently
- R-FLEET-W1-26 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-27 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 18 -- Compliance evidence lineage

**Phase Type**: module

<!-- Phase: B | B-06 | W1 | PG:6 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `IFTA and compliance tables` | Compliance evidence lineage |

### Done When

- R-FLEET-W1-28 [backend]: Evidence ties to compliance period and trip/load context
- R-FLEET-W1-29 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-30 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/migrations/ --reporter=default
```

## Phase 19 -- Orphan-row backfill engine

**Phase Type**: module

<!-- Phase: B | B-07 | W1 | PG:6 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| ADD | `migrations` | Orphan-row backfill engine |

### Done When

- R-FLEET-W1-31 [backend]: Existing records are classified, backfilled, or queued for review
- R-FLEET-W1-32 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-33 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/ --reporter=default
```

## Phase 20 -- Duplicate-truth reconciliation

**Phase Type**: module

<!-- Phase: B | B-08 | W1 | PG:6 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `reconciliation service` | Duplicate-truth reconciliation |

### Done When

- R-FLEET-W1-34 [backend]: Duplicate parentage and shadow models are surfaced and reduced
- R-FLEET-W1-35 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-36 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/ --reporter=default
```

## Phase 21 -- Lineage query pack for certified journeys

**Phase Type**: module

<!-- Phase: B | B-09 | W1 | PG:7 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `SQL/reporting utilities` | Lineage query pack for certified journeys |

### Done When

- R-FLEET-W1-37 [backend]: Each certified journey has reproducible lineage output
- R-FLEET-W1-38 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-39 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/ --reporter=default
```

## Phase 22 -- Strictness hardening for new writes

**Phase Type**: module

<!-- Phase: B | B-10 | W1 | PG:7 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `validators` | Strictness hardening for new writes |

### Done When

- R-FLEET-W1-40 [backend]: New writes require canonical parent linkage where mandated
- R-FLEET-W1-41 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W1-42 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/ --reporter=default
```

## Phase 23 -- Quote model normalization

**Phase Type**: integration

<!-- Phase: C | C-01 | W2 | PG:8 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `quote schema` | Quote model normalization |

### Done When

- R-FLEET-W2-01 [backend]: Quotes carry the fields needed for full downstream continuity
- R-FLEET-W2-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 24 -- Booking-to-load conversion hardening

**Phase Type**: integration

<!-- Phase: C | C-02 | W2 | PG:8 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/repositories/booking.repository.ts` | Booking-to-load conversion hardening |

### Done When

- R-FLEET-W2-04 [backend]: Bookings convert cleanly with no data loss
- R-FLEET-W2-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 25 -- Load lifecycle state certification

**Phase Type**: integration

<!-- Phase: C | C-03 | W2 | PG:8 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `load routes` | Load lifecycle state certification |

### Done When

- R-FLEET-W2-07 [backend]: Full valid and invalid state transitions are verified
- R-FLEET-W2-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 26 -- Assignment and repower closure

**Phase Type**: integration

<!-- Phase: C | C-04 | W2 | PG:8 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `dispatch routes` | Assignment and repower closure |

### Done When

- R-FLEET-W2-10 [backend]: Reassignment and repower keep continuity and audit trail
- R-FLEET-W2-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 27 -- Dispatcher timeline and calendar truth

**Phase Type**: integration

<!-- Phase: C | C-05 | W2 | PG:9 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `timeline and calendar components` | Dispatcher timeline and calendar truth |

### Done When

- R-FLEET-W2-13 [frontend]: Timeline and calendar reflect canonical load/trip state
- R-FLEET-W2-14 [frontend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-15 [frontend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 28 -- Exception and work-item continuity

**Phase Type**: integration

<!-- Phase: C | C-06 | W2 | PG:9 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `exception console` | Exception and work-item continuity |

### Done When

- R-FLEET-W2-16 [backend]: Operational exceptions remain tied to the same business context
- R-FLEET-W2-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 29 -- Customer and broker continuity

**Phase Type**: integration

<!-- Phase: C | C-07 | W2 | PG:9 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `network` | Customer and broker continuity |

### Done When

- R-FLEET-W2-19 [backend]: Customer / broker identity is preserved across execution views
- R-FLEET-W2-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W2-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 30 -- Document completeness by trip and load

**Phase Type**: integration

<!-- Phase: C | C-08 | W3 | PG:9 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `docs routes` | Document completeness by trip and load |

### Done When

- R-FLEET-W3-01 [docs]: Missing artifacts are visible and block downstream steps where required
- R-FLEET-W3-02 [docs]: Tests verify implementation matches acceptance criterion
- R-FLEET-W3-03 [docs]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default && npx vitest run src/__tests__/components/ --reporter=default
```

## Phase 31 -- OCR review-to-apply pipeline closure

**Phase Type**: integration

<!-- Phase: C | C-09 | W3 | PG:10 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `OCR review UI` | OCR review-to-apply pipeline closure |

### Done When

- R-FLEET-W3-04 [backend]: Human-reviewed extraction can safely update target records
- R-FLEET-W3-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W3-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default && npx vitest run src/__tests__/components/ --reporter=default
```

## Phase 32 -- Quote-to-load-to-settlement certification

**Phase Type**: integration

<!-- Phase: C | C-10 | W7 | PG:10 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `cross-domain tests and runbooks` | Quote-to-load-to-settlement certification |

### Done When

- R-FLEET-W7-01 [backend]: Full core loop journey is certified end to end
- R-FLEET-W7-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default && npx vitest run src/__tests__/components/ --reporter=default
```

## Phase 33 -- Driver trip workspace canonicalization

**Phase Type**: module

<!-- Phase: D | D-01 | W4 | PG:12 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `components/DriverMobileHome.tsx`, `components/driver/DriverLoadIntakePanel.tsx` | Driver trip workspace canonicalization |

### Done When

- R-FLEET-W4-01 [frontend]: Driver sees one canonical trip workspace with the same execution truth used by dispatch
- R-FLEET-W4-02 [frontend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-03 [frontend]: No regression in existing test suite for affected files

### Verification Command

```bash
npx vitest run src/__tests__/components/DriverMobileHome.workspace.test.tsx --reporter=default && cd server && npx vitest run __tests__/routes/loads.driver-active.test.ts --reporter=default
```

## Phase 34 -- Stop sequence, appointment, and next-action truth

**Phase Type**: module

<!-- Phase: D | D-02 | W4 | PG:12 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `load_legs` | Stop sequence, appointment, and next-action truth |

### Done When

- R-FLEET-W4-04 [backend]: Driver UI reflects ordered stops, appointments, next required action, and stop-level state correctly
- R-FLEET-W4-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
npx vitest run src/__tests__/components/DriverMobileHome.stops.test.tsx --reporter=default && cd server && npx vitest run __tests__/routes/dispatch.stops.test.ts --reporter=default
```

## Phase 35 -- Driver status update contract completion

**Phase Type**: module

<!-- Phase: D | D-03 | W4 | PG:12 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `mobile actions` | Driver status update contract completion |

### Done When

- R-FLEET-W4-07 [backend]: Departed, arrived, loaded, unloaded, delivered, and exception statuses map cleanly to backend state transitions
- R-FLEET-W4-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/loads.driver-status.test.ts --reporter=default
```

## Phase 36 -- Delay, detention, lumper, and breakdown workflow closure

**Phase Type**: module

<!-- Phase: D | D-04 | W4 | PG:12 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `issue routes` | Delay, detention, lumper, and breakdown workflow closure |

### Done When

- R-FLEET-W4-10 [backend]: Field-reported operational events create traceable office-side work items and downstream impacts
- R-FLEET-W4-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/exceptions.driver-issue.test.ts --reporter=default
```

## Phase 37 -- Driver messaging and read-state continuity

**Phase Type**: module

<!-- Phase: D | D-05 | W9 | PG:13 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/messages.ts` | Driver messaging and read-state continuity |

### Done When

- R-FLEET-W9-01 [backend]: Driver and dispatcher messaging shares one thread model with visible read and delivery state
- R-FLEET-W9-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W9-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/messages.readstate.test.ts --reporter=default
```

## Phase 38 -- Document checklist and mobile scan flow

**Phase Type**: module

<!-- Phase: D | D-06 | W4 | PG:13 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `scanner UI` | Document checklist and mobile scan flow |

### Done When

- R-FLEET-W4-13 [docs]: Required documents are visible by trip and can be captured from the field into the canonical document lifecycle
- R-FLEET-W4-14 [docs]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-15 [docs]: No regression in existing test suite for affected files

### Verification Command

```bash
npx vitest run src/__tests__/components/DriverMobileHome.docs.test.tsx --reporter=default && cd server && npx vitest run __tests__/routes/documents.driver-upload.test.ts --reporter=default
```

## Phase 39 -- Driver pay and settlement visibility

**Phase Type**: module

<!-- Phase: D | D-07 | W4 | PG:13 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `mobile pay UI` | Driver pay and settlement visibility |

### Done When

- R-FLEET-W4-16 [backend]: Driver can see allowed settlement and pay details without exposing back-office-only controls
- R-FLEET-W4-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/accounting.driver-pay.test.ts --reporter=default
```

## Phase 40 -- Offline queue, sync, and conflict handling

**Phase Type**: module

<!-- Phase: D | D-08 | W4 | PG:13 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `mobile storage/services` | Offline queue, sync, and conflict handling |

### Done When

- R-FLEET-W4-19 [backend]: Core field actions queue offline, replay safely, and surface conflicts deterministically
- R-FLEET-W4-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
npx vitest run src/__tests__/services/offlineQueue.test.ts --reporter=default
```

## Phase 41 -- Mobile auth, session, and device hardening

**Phase Type**: module

<!-- Phase: D | D-09 | W4 | PG:14 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `mobile auth flows` | Mobile auth, session, and device hardening |

### Done When

- R-FLEET-W4-22 [backend]: Authentication, re-auth, session expiry, and lost-connectivity behavior are safe and predictable in field conditions
- R-FLEET-W4-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
npx vitest run src/__tests__/services/api.tokenRefresh.test.ts --reporter=default
```

## Phase 42 -- Push, alert, and acknowledgement path

**Phase Type**: module

<!-- Phase: D | D-10 | W9 | PG:14 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `notification services` | Push, alert, and acknowledgement path |

### Done When

- R-FLEET-W9-04 [backend]: Critical operational alerts reach the driver and capture acknowledgement or visible failure
- R-FLEET-W9-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W9-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/notification-jobs.driver-alerts.test.ts --reporter=default
```

## Phase 43 -- Pilot-channel release and legal readiness

**Phase Type**: module

<!-- Phase: D | D-11 | W4 | PG:14 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `build config` | Pilot-channel release and legal readiness |

### Done When

- R-FLEET-W4-25 [backend]: Pilot build is signable, distributable, policy-complete, and crash-observable on the supported device matrix
- R-FLEET-W4-26 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-27 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
test -f docs/release/pilot-release-checklist.md && test -f docs/legal/privacy-policy.md
```

## Phase 44 -- Driver field-loop certification

**Phase Type**: module

<!-- Phase: D | D-12 | W4 | PG:14 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `certified mobile journey tests` | Driver field-loop certification |

### Done When

- R-FLEET-W4-28 [backend]: Assignment-through-proof mobile loop is certified end to end in staging and pilot conditions
- R-FLEET-W4-29 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W4-30 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
npx vitest run src/__tests__/journeys/j2-driver-trip-execution.test.tsx --reporter=default
```

## Phase 45 -- Provider abstraction hardening

**Phase Type**: integration

<!-- Phase: E | E-01 | W5 | PG:16 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/services/gps/*` | Provider abstraction hardening |

### Done When

- R-FLEET-W5-01 [backend]: Telematics providers share a stable abstraction for auth, ingest, health, retry, and mapping
- R-FLEET-W5-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W5-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/gps/ --reporter=default
```

## Phase 46 -- Primary provider production path

**Phase Type**: integration

<!-- Phase: E | E-02 | W5 | PG:16 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `Samsara adapter` | Primary provider production path |

### Done When

- R-FLEET-W5-04 [backend]: One named provider works end to end with production-grade setup, sync, and visible failure states
- R-FLEET-W5-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W5-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/gps/ --reporter=default
```

## Phase 47 -- Vehicle, trailer, driver, and asset mapping closure

**Phase Type**: integration

<!-- Phase: E | E-03 | W5 | PG:16 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `telematics mapping UI` | Vehicle, trailer, driver, and asset mapping closure |

### Done When

- R-FLEET-W5-07 [backend]: Provider entities map cleanly to internal drivers, vehicles, and equipment with conflict handling
- R-FLEET-W5-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W5-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/gps/ --reporter=default
```

## Phase 48 -- Live telemetry ingest, health, and replay

**Phase Type**: integration

<!-- Phase: E | E-04 | W5 | PG:16 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `webhook/sync routes` | Live telemetry ingest, health, and replay |

### Done When

- R-FLEET-W5-10 [backend]: Telemetry events ingest reliably, expose health state, and can replay or backfill after outage
- R-FLEET-W5-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W5-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/gps/ --reporter=default
```

## Phase 49 -- Trip-linked telemetry consumer layer

**Phase Type**: integration

<!-- Phase: E | E-05 | W5 | PG:17 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `dispatch views` | Trip-linked telemetry consumer layer |

### Done When

- R-FLEET-W5-13 [backend]: Telemetry flows into dispatch, trip history, and compliance consumers from one canonical event stream
- R-FLEET-W5-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W5-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/gps/ --reporter=default
```

## Phase 50 -- HOS display, conflict detection, and fallback behavior implementation

**Phase Type**: integration

<!-- Phase: E | E-06 | W5 | PG:17 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| ADD | `server/services/eld/hos-display.service.ts` | HOS display, conflict detection, and fallback behavior implementation |

### Done When

- R-FLEET-W5-16 [backend]: HOS data is visible, stale or conflicting states are surfaced, and unsupported cases are represented honestly
- R-FLEET-W5-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W5-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/services/gps/ --reporter=default
```

## Phase 51 -- IFTA evidence ingestion and gap detection

**Phase Type**: integration

<!-- Phase: E | E-07 | W6 | PG:17 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `IFTA services` | IFTA evidence ingestion and gap detection |

### Done When

- R-FLEET-W6-01 [backend]: Mileage and fuel evidence ingest consistently and gap detection surfaces actionable missing evidence
- R-FLEET-W6-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 52 -- Quarter-close lock, review, and audit export

**Phase Type**: integration

<!-- Phase: E | E-08 | W6 | PG:17 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `IFTA close workflows` | Quarter-close lock, review, and audit export |

### Done When

- R-FLEET-W6-04 [backend]: IFTA quarter close produces a locked, reproducible packet with traceable evidence
- R-FLEET-W6-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 53 -- Compliance cockpit truth model

**Phase Type**: integration

<!-- Phase: E | E-09 | W6 | PG:18 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `compliance routes/UI` | Compliance cockpit truth model |

### Done When

- R-FLEET-W6-07 [backend]: Every compliance status shows source, freshness, verifier state, and whether it is manual, derived, or synced
- R-FLEET-W6-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 54 -- Permits, deadlines, and annual filing continuity

**Phase Type**: integration

<!-- Phase: E | E-10 | W6 | PG:18 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `compliance scheduler` | Permits, deadlines, and annual filing continuity |

### Done When

- R-FLEET-W6-10 [backend]: IRP, UCR, HVUT/2290, permits, and annual deadlines are tracked with reminders and evidence continuity
- R-FLEET-W6-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 55 -- Maintenance scheduling and return-to-service continuity

**Phase Type**: integration

<!-- Phase: E | E-11 | W6 | PG:18 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `maintenance UI` | Maintenance scheduling and return-to-service continuity |

### Done When

- R-FLEET-W6-13 [backend]: Maintenance and inspection actions connect equipment status, repair records, and return-to-service state
- R-FLEET-W6-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 56 -- DVIR defect, repair signoff, and photo flow

**Phase Type**: integration

<!-- Phase: E | E-12 | W6 | PG:18 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `DVIR UI/routes` | DVIR defect, repair signoff, and photo flow |

### Done When

- R-FLEET-W6-16 [backend]: DVIR supports field submission, photo evidence, defect escalation, repair signoff, and return-to-service
- R-FLEET-W6-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 57 -- Safety, incident, certificate, and inspection lifecycle

**Phase Type**: integration

<!-- Phase: E | E-13 | W6 | PG:19 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `safety routes/UI` | Safety, incident, certificate, and inspection lifecycle |

### Done When

- R-FLEET-W6-19 [backend]: Safety-critical records maintain field-to-office continuity and auditability across the full lifecycle
- R-FLEET-W6-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 58 -- Telematics-to-compliance certification

**Phase Type**: integration

<!-- Phase: E | E-14 | W6 | PG:19 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `cross-domain tests` | Telematics-to-compliance certification |

### Done When

- R-FLEET-W6-22 [backend]: Provider-backed telemetry path and compliance workflows are certified together, not as separate demos
- R-FLEET-W6-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W6-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 59 -- Settlement rule engine completion

**Phase Type**: module

<!-- Phase: F | F-01 | W7 | PG:20 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `settlement services` | Settlement rule engine completion |

### Done When

- R-FLEET-W7-04 [backend]: Settlement generation covers core trip/load cases with explicit rate, deduction, reimbursement, and provenance logic
- R-FLEET-W7-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 60 -- Settlement review, posting, and immutability

**Phase Type**: module

<!-- Phase: F | F-02 | W7 | PG:20 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `settlement posting flows` | Settlement review, posting, and immutability |

### Done When

- R-FLEET-W7-07 [backend]: Posted settlements are immutable except through explicit adjustment workflows with audit trail
- R-FLEET-W7-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 61 -- AP workflow certification

**Phase Type**: module

<!-- Phase: F | F-03 | W7 | PG:20 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `AP routes` | AP workflow certification |

### Done When

- R-FLEET-W7-10 [backend]: Accounts payable can move from evidence to payable state without spreadsheet side-processes for core cases
- R-FLEET-W7-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 62 -- AR, invoicing, and aging completion

**Phase Type**: module

<!-- Phase: F | F-04 | W7 | PG:20 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `invoice routes` | AR, invoicing, and aging completion |

### Done When

- R-FLEET-W7-13 [backend]: Accounts receivable, invoice issuance, status, and aging operate end to end from canonical load/commercial data
- R-FLEET-W7-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 63 -- GL, journal, and close baseline

**Phase Type**: module

<!-- Phase: F | F-05 | W7 | PG:21 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `accounting services` | GL, journal, and close baseline |

### Done When

- R-FLEET-W7-16 [backend]: Financial events land in consistent ledger structures and support core close activities without data drift
- R-FLEET-W7-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 64 -- Reconciliation and exception handling

**Phase Type**: module

<!-- Phase: F | F-06 | W7 | PG:21 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `reconciliation services/views` | Reconciliation and exception handling |

### Done When

- R-FLEET-W7-19 [backend]: Sync mismatches, payment mismatches, and missing postings surface in an actionable reconciliation console
- R-FLEET-W7-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 65 -- QuickBooks sync completion

**Phase Type**: module

<!-- Phase: F | F-07 | W7 | PG:21 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/quickbooks.ts` | QuickBooks sync completion |

### Done When

- R-FLEET-W7-22 [backend]: QuickBooks supports connect, sync, retry, visible error states, and reconciliation for the supported entities
- R-FLEET-W7-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 66 -- Stripe subscription and billing completion

**Phase Type**: module

<!-- Phase: F | F-08 | W7 | PG:21 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/stripe.ts` | Stripe subscription and billing completion |

### Done When

- R-FLEET-W7-25 [backend]: Stripe supports subscription/billing lifecycle, webhook handling, failure visibility, and tenant billing truth
- R-FLEET-W7-26 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W7-27 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 67 -- Customer and broker master normalization

**Phase Type**: module

<!-- Phase: F | F-09 | W8 | PG:22 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `contacts` | Customer and broker master normalization |

### Done When

- R-FLEET-W8-01 [backend]: Customer and broker identities no longer fork across quotes, loads, settlements, and invoices
- R-FLEET-W8-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W8-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 68 -- Quote, load, proof, invoice, and payment continuity

**Phase Type**: module

<!-- Phase: F | F-10 | W8 | PG:22 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `quote/bookings` | Quote, load, proof, invoice, and payment continuity |

### Done When

- R-FLEET-W8-04 [backend]: Commercial lineage from quote through proof and invoice/payment is queryable and operator-visible
- R-FLEET-W8-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W8-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 69 -- Broker payment intelligence implementation

**Phase Type**: module

<!-- Phase: F | F-11 | W8 | PG:22 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `broker performance/payment views` | Broker payment intelligence implementation |

### Done When

- R-FLEET-W8-07 [backend]: Broker payment status and performance metrics derive from canonical financial and operational records
- R-FLEET-W8-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W8-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 70 -- Financial controls and approval baseline

**Phase Type**: module

<!-- Phase: F | F-12 | W8 | PG:22 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `permissions` | Financial controls and approval baseline |

### Done When

- R-FLEET-W8-10 [backend]: Financially material actions require the correct approvals and leave a durable audit trail
- R-FLEET-W8-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W8-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 71 -- Back-office workflow certification

**Phase Type**: module

<!-- Phase: F | F-13 | W8 | PG:23 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `cross-domain tests` | Back-office workflow certification |

### Done When

- R-FLEET-W8-13 [backend]: Finance and commercial workflows are certified end to end for supported fleet operating cases
- R-FLEET-W8-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W8-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx vitest run __tests__/routes/ --reporter=default
```

## Phase 72 -- Real email provider completion

**Phase Type**: module

<!-- Phase: G | G-01 | W9 | PG:24 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `email services` | Real email provider completion |

### Done When

- R-FLEET-W9-07 [backend]: Email delivery is no longer stubbed and exposes success, retry, and failure state
- R-FLEET-W9-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W9-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 73 -- Real SMS provider completion

**Phase Type**: module

<!-- Phase: G | G-02 | W9 | PG:24 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `SMS services` | Real SMS provider completion |

### Done When

- R-FLEET-W9-10 [backend]: SMS delivery is real, observable, and policy-compliant for the supported use cases
- R-FLEET-W9-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W9-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 74 -- Notification delivery and acknowledgement model

**Phase Type**: module

<!-- Phase: G | G-03 | W9 | PG:24 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `message/notification jobs` | Notification delivery and acknowledgement model |

### Done When

- R-FLEET-W9-13 [backend]: Notifications have canonical queued, sent, delivered, failed, and acknowledged states where applicable
- R-FLEET-W9-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W9-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 75 -- Operational alerts and escalation rules

**Phase Type**: module

<!-- Phase: G | G-04 | W10 | PG:24 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `alerting config` | Operational alerts and escalation rules |

### Done When

- R-FLEET-W10-01 [backend]: Critical domain events create the right alerts and escalations for operations and support
- R-FLEET-W10-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 76 -- Notification and job observability

**Phase Type**: module

<!-- Phase: G | G-05 | W9 | PG:25 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `job dashboards` | Notification and job observability |

### Done When

- R-FLEET-W9-16 [backend]: Operators can see notification/job health, backlogs, retries, and failures without digging through logs
- R-FLEET-W9-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W9-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 77 -- Structured logging and correlation standard

**Phase Type**: module

<!-- Phase: G | G-06 | W10 | PG:25 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `backend/frontend/mobile logging` | Structured logging and correlation standard |

### Done When

- R-FLEET-W10-04 [backend]: Logs across services and clients are structured and correlate a workflow across route, job, and UI layers
- R-FLEET-W10-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 78 -- Sentry and runtime error strategy completion

**Phase Type**: module

<!-- Phase: G | G-07 | W10 | PG:25 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `Sentry client/server wiring` | Sentry and runtime error strategy completion |

### Done When

- R-FLEET-W10-07 [backend]: All major runtime surfaces emit actionable error telemetry with environment and release context
- R-FLEET-W10-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 79 -- Service ownership, on-call, and runbook completion

**Phase Type**: module

<!-- Phase: G | G-08 | W10 | PG:25 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `docs` | Service ownership, on-call, and runbook completion |

### Done When

- R-FLEET-W10-10 [backend]: Every production-critical subsystem has an owner, on-call path, and usable runbook
- R-FLEET-W10-11 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-12 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 80 -- Deployment, rollback, and recovery drills

**Phase Type**: module

<!-- Phase: G | G-09 | W10 | PG:26 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `deployment scripts/docs` | Deployment, rollback, and recovery drills |

### Done When

- R-FLEET-W10-13 [backend]: Blue-green or equivalent rollout, rollback, and restore procedures are proven in drills
- R-FLEET-W10-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 81 -- Feature flags and progressive rollout controls

**Phase Type**: module

<!-- Phase: G | G-10 | W10 | PG:26 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `feature-flag routes/services` | Feature flags and progressive rollout controls |

### Done When

- R-FLEET-W10-16 [backend]: New capabilities can be gated by tenant/tier and disabled safely during incidents
- R-FLEET-W10-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 82 -- Release evidence bundle and launch checklist

**Phase Type**: module

<!-- Phase: G | G-11 | W10 | PG:26 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `release docs` | Release evidence bundle and launch checklist |

### Done When

- R-FLEET-W10-19 [backend]: Every release can produce a repeatable evidence bundle showing what changed and how it was verified
- R-FLEET-W10-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 83 -- Product truth matrix and customer-facing alignment

**Phase Type**: module

<!-- Phase: G | G-12 | W10 | PG:26 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `sales/support docs` | Product truth matrix and customer-facing alignment |

### Done When

- R-FLEET-W10-22 [backend]: Sales, support, implementation, and product all speak from the same truth table for live vs partial vs planned
- R-FLEET-W10-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 84 -- Repo and environment hygiene cleanup

**Phase Type**: module

<!-- Phase: G | G-13 | W10 | PG:27 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `stale directories` | Repo and environment hygiene cleanup |

### Done When

- R-FLEET-W10-25 [backend]: Repo hygiene issues and environment inconsistencies that undermine trust are removed or documented with controls
- R-FLEET-W10-26 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-27 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 85 -- Pilot and production support model

**Phase Type**: module

<!-- Phase: G | G-14 | W10 | PG:27 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `support playbooks` | Pilot and production support model |

### Done When

- R-FLEET-W10-28 [backend]: Pilot fleets and production fleets have an explicit support and escalation operating model
- R-FLEET-W10-29 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-30 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 86 -- Operate-and-launch certification

**Phase Type**: module

<!-- Phase: G | G-15 | W10 | PG:27 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `runbook drills` | Operate-and-launch certification |

### Done When

- R-FLEET-W10-31 [backend]: The product can be operated, supported, rolled back, and truthfully launched without hidden manual heroics
- R-FLEET-W10-32 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W10-33 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/ --reporter=default
```

## Phase 87 -- Versioned public API implementation

**Phase Type**: module

<!-- Phase: H | H-01 | W11 | PG:28 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `server/routes/public-api/*` | Versioned public API implementation |

### Done When

- R-FLEET-W11-01 [backend]: A versioned API namespace exists with explicit resource contracts and deprecation policy
- R-FLEET-W11-02 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-03 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/routes/public-api.test.ts --reporter=default
```

## Phase 88 -- Tenant API keys, scopes, and rate limits

**Phase Type**: module

<!-- Phase: H | H-02 | W11 | PG:28 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `API key routes/services` | Tenant API keys, scopes, and rate limits |

### Done When

- R-FLEET-W11-04 [backend]: API keys can be issued, rotated, revoked, scoped, and rate-limited per tenant
- R-FLEET-W11-05 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-06 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/routes/api-keys.test.ts --reporter=default
```

## Phase 89 -- Outbound webhook platform

**Phase Type**: module

<!-- Phase: H | H-03 | W11 | PG:28 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| ADD | `server/routes/webhooks.ts, server/services/webhook.service.ts` | Outbound webhook platform |

### Done When

- R-FLEET-W11-07 [backend]: Tenants can subscribe to supported domain events and receive signed, retryable outbound webhooks
- R-FLEET-W11-08 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-09 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/routes/webhooks.test.ts --reporter=default
```

## Phase 90 -- Developer docs and sandbox path

**Phase Type**: module

<!-- Phase: H | H-04 | W11 | PG:28 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `docs/api/developer-guide.md` | Developer docs and sandbox path |

### Done When

- R-FLEET-W11-10 [docs]: External developers have documentation and a safe path to integrate without production guesswork
- R-FLEET-W11-11 [docs]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-12 [docs]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && test -f docs/api/developer-guide.md
```

## Phase 91 -- SSO / SAML identity path

**Phase Type**: module

<!-- Phase: H | H-05 | W11 | PG:29 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| ADD | `server/routes/sso.ts, server/services/sso.service.ts` | SSO / SAML identity path |

### Done When

- R-FLEET-W11-13 [backend]: Enterprise tenants can authenticate through supported SSO/SAML flows with correct tenant boundaries
- R-FLEET-W11-14 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-15 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/routes/sso.test.ts --reporter=default
```

## Phase 92 -- SCIM or bulk provisioning path

**Phase Type**: module

<!-- Phase: H | H-06 | W11 | PG:29 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `provisioning services` | SCIM or bulk provisioning path |

### Done When

- R-FLEET-W11-16 [backend]: Enterprise user provisioning can be automated or bulk-managed with auditability
- R-FLEET-W11-17 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-18 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/routes/provisioning.test.ts --reporter=default
```

## Phase 93 -- Customer onboarding and migration toolkit

**Phase Type**: module

<!-- Phase: H | H-07 | W11 | PG:29 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `components/DataImportWizard.tsx` | Customer onboarding and migration toolkit |

### Done When

- R-FLEET-W11-19 [backend]: Existing fleet data can be imported through guided mapping, validation, preview, and rollback-capable tooling
- R-FLEET-W11-20 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-21 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/services/data-import.test.ts --reporter=default
```

## Phase 94 -- Data export, portability, retention, and legal holds

**Phase Type**: module

<!-- Phase: H | H-08 | W11 | PG:29 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `export services` | Data export, portability, retention, and legal holds |

### Done When

- R-FLEET-W11-22 [backend]: Customers can export their data, retention rules are explicit, and legal-hold style requirements are supportable
- R-FLEET-W11-23 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-24 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/services/data-export.test.ts --reporter=default
```

## Phase 95 -- Data residency enforcement and multi-region routing implementation

**Phase Type**: module

<!-- Phase: H | H-09 | W11 | PG:30 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| ADD | `server/middleware/data-residency.ts` | Tenant region enforcement middleware |
| ADD | `server/lib/multi-region-router.ts` | Request routing by tenant region config |
| ADD | `server/__tests__/middleware/data-residency.test.ts` | Region enforcement tests |
| MODIFY | `docs/deployment/data-residency-config.md` | Deployment config for multi-region |

### Done When

- R-FLEET-W11-25 [backend]: Data residency middleware enforces tenant region config; multi-region routing implemented for at least one secondary region
- R-FLEET-W11-26 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-27 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/middleware/data-residency.test.ts --reporter=default
```

## Phase 96 -- Internationalization, multi-currency, and unit framework

**Phase Type**: module

<!-- Phase: H | H-10 | W11 | PG:30 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `shared formatting utilities` | Internationalization, multi-currency, and unit framework |

### Done When

- R-FLEET-W11-28 [backend]: Currency, unit, locale, and cross-border presentation rules are supported without ad hoc duplication
- R-FLEET-W11-29 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-30 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/services/i18n.test.ts --reporter=default
```

## Phase 97 -- Reporting scale and analytical workload separation

**Phase Type**: module

<!-- Phase: H | H-11 | W11 | PG:30 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `reporting services` | Reporting scale and analytical workload separation |

### Done When

- R-FLEET-W11-31 [backend]: Historical analytics and reporting no longer depend solely on the OLTP path and can scale separately
- R-FLEET-W11-32 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-33 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/services/reporting-warehouse.test.ts --reporter=default
```

## Phase 98 -- Enterprise financial controls and period governance

**Phase Type**: module

<!-- Phase: H | H-12 | W11 | PG:30 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `approval controls` | Enterprise financial controls and period governance |

### Done When

- R-FLEET-W11-34 [backend]: Enterprise-grade financial controls exist for approvals, period locks, retention, and adjustment governance
- R-FLEET-W11-35 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-36 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/middleware/financial-controls.test.ts --reporter=default
```

## Phase 99 -- Enterprise DR drill, SLA monitoring, and audit-evidence implementation

**Phase Type**: module

<!-- Phase: H | H-13 | W11 | PG:31 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `DR docs` | Enterprise DR drill, SLA monitoring, and audit-evidence implementation |

### Done When

- R-FLEET-W11-37 [backend]: Recovery targets, availability expectations, and audit evidence for enterprise customers are explicit and testable
- R-FLEET-W11-38 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-39 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/integration/enterprise-dr-drill.test.ts --reporter=default
```

## Phase 100 -- Enterprise-grade certification with implementation evidence

**Phase Type**: module

<!-- Phase: H | H-14 | W11 | PG:31 -->

### Changes

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `enterprise readiness checklist` | Enterprise-grade certification with implementation evidence |

### Done When

- R-FLEET-W11-40 [backend]: Enterprise claims are only enabled for capabilities that have evidence-backed completion, not roadmap intent
- R-FLEET-W11-41 [backend]: Tests verify implementation matches acceptance criterion
- R-FLEET-W11-42 [backend]: No regression in existing test suite for affected files

### Verification Command

```bash
cd server && npx tsc --noEmit && npx vitest run __tests__/integration/enterprise-certification.test.ts --reporter=default
```

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Later phases stale after Phase A migrations | Cross-phase replanning; re-baselining |
| Branch width (~100 commits) | Checkpoint commits per phase |
| Regression isolation | Phase-gate verification bundles |
| Integration partner delays | Partner stories deferrable |

## Dependencies

**Internal**: A -> B -> C/D/E -> F -> G -> H

**External**: Motive/Samsara API, QuickBooks sandbox, Stripe test, SMTP, Twilio, App Store access
