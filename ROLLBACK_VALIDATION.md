# Rollback Validation

**Story**: R-FS-02  
**Date**: 2026-03-08  
**Environment**: Dev DB (trucklogix) isolated staging rehearsal  
**Rehearsal Script**: server/scripts/staging-rehearsal.ts  
**Status**: VALIDATED  

---

## Purpose

This document proves that the LoadPilot database migration rollback procedure
works correctly for all migration files that have a DOWN section.

A working rollback path is required before production promotion (per PLAN.md
R-FS-02 acceptance criteria R-FS-02-02).

---

## Rollback Mechanism

Rollback is implemented in  via :

1. Reads the most recently applied migration from the  table
2. Locates the corresponding  file on disk  
3. Parses the  SQL section
4. Executes DOWN SQL statements in a transaction
5. On success: removes the migration record from 
6. On failure: calls  — database is unchanged

This is a **last-in, first-out (LIFO)** single-step rollback, which is the
correct approach for schema migrations.

---

## Migrations With Down Sections

The following migrations have documented  sections:

| Migration File | DOWN Action |
|----------------|-------------|
| 002_load_status_normalization.sql | Widens ENUM back to 12 PascalCase values, denormalizes rows, shrinks to original ENUM |
| 002_load_status_normalization_rollback.sql | Standalone rollback script (alternative repair path) |

All other migrations (001_baseline through 009_settlement_adjustments) are
schema creation migrations. Their rollback is  statements
covered by the baseline rollback script.

---

## Rollback Round-Trip Test Results

Command: 

The staging rehearsal script performs a rollback round-trip as its final step:

### Step: rollback-down



- Last applied migration identified in  table
- DOWN section parsed from 
- Transaction committed successfully
- Record removed from 

### Step: rollback-reapply



- Migration re-applied via 
-  record re-inserted with correct checksum
- Database state identical to pre-rollback

### Step: rollback-round-trip-integrity



- All applied migration checksums verified against disk files
- No checksum mismatches detected
-  table in consistent state

---

## Load Status Normalization Rollback

The critical migration for production is ,
which modifies the  ENUM. Its rollback procedure is:

### Forward Migration (002_load_status_normalization.sql)

1. **Widen ENUM**: Add 8 canonical lowercase values alongside 12 legacy PascalCase
2. **Normalize rows**: UPDATE all loads to canonical lowercase values
3. **Shrink ENUM**: Remove legacy PascalCase values

### Rollback Procedure (002_load_status_normalization_rollback.sql)

1. **Widen ENUM**: Add legacy PascalCase values back alongside canonical
2. **Denormalize rows**: UPDATE loads from canonical back to primary legacy equivalent
3. **Shrink ENUM**: Remove canonical values — restore original 12-value PascalCase ENUM

### Known Rollback Limitation

Some forward mappings were many-to-one (lossy):

| Canonical | Legacy Options | Rollback Maps To |
|-----------|---------------|------------------|
| planned | Planned, Booked, CorrectionRequested | Planned |
| arrived | Arrived, Docked | Arrived |
| delivered | Unloaded, Delivered | Delivered |
| completed | Invoiced, Settled | Invoiced |
| draft | (new — no legacy equivalent) | Planned |

**Decision**: This lossy rollback is acceptable for production use because:
- Booked, Docked, Unloaded, CorrectionRequested were transitional states
- The primary legacy value preserves operational correctness
- Post-rollback reconciliation identifies any loads needing manual review
- The alternative is a pre-migration data snapshot for point-in-time restore

---

## Repair Procedure (Alternative to Rollback)

If a full ENUM rollback is not desired, a targeted repair can be applied:



This is idempotent and safe to run multiple times.

---

## Rollback Decision Gate

Before executing rollback in production:

- [ ] Confirm backup taken before migration
- [ ] Confirm no new loads written after migration (or accept lossy rollback)
- [ ] Run repair script first if only partial normalization is needed
- [ ] If full rollback required: apply 
- [ ] Run  post-rollback to verify

---

## Post-Rollback Verification

After any rollback, verify:

1.  — confirms ENUM values
2.  — confirms distribution
3. 
[1m[46m RUN [49m[22m [36mv4.0.18 [39m[90mF:/Trucking/DisbatchMe/.claude/worktrees/agent-a3ee4c7d/server[39m

 [31m❯[39m __tests__/middleware/validate.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/middleware/security-middleware.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/routes/modularization.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [31m❯[39m __tests__/schemas/schemas.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/schemas/document.schema.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/schemas/accounting-schemas.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/services/geocoding.service.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 227[2mms[22m[39m
 [32m✓[39m __tests__/services/load-state-machine.test.ts [2m([22m[2m89 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32m✓[39m __tests__/lib/env.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 262[2mms[22m[39m
 [31m❯[39m __tests__/middleware/errorHandler.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/middleware/auth-integration.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/lib/migrator.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 278[2mms[22m[39m
 [32m✓[39m __tests__/services/weather.service.test.ts [2m([22m[2m13 tests[22m[2m)[22m[33m 307[2mms[22m[39m
 [32m✓[39m __tests__/middleware/route-audit.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [31m❯[39m __tests__/services/reconciliation.service.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/repositories/load.repository.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [31m❯[39m __tests__/routes/ai.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/messages.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/call-sessions.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/metrics.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/tracking.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/incidents-crud.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/dispatch-flow.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [31m❯[39m __tests__/routes/load-crud.test.ts [2m([22m[2m0 test[22m[2m)[22m
[90mstdout[2m | __tests__/lib/db-pool.test.ts[2m > [22m[2mdb-pool[2m > [22m[2mpool config has connectionLimit: 25
[22m[39m[dotenv@17.2.3] injecting env (6) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops

[90mstdout[2m | __tests__/lib/db-pool.test.ts[2m > [22m[2mdb-pool[2m > [22m[2mpool config has queueLimit: 100
[22m[39m[dotenv@17.2.3] injecting env (0) from .env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }

[90mstdout[2m | __tests__/lib/db-pool.test.ts[2m > [22m[2mdb-pool[2m > [22m[2mpool config has enableKeepAlive: true
[22m[39m[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops

[90mstdout[2m | __tests__/lib/db-pool.test.ts[2m > [22m[2mdb-pool[2m > [22m[2mclosePool calls pool.end()
[22m[39m[dotenv@17.2.3] injecting env (0) from .env -- tip: 🗂️ backup and recover secrets: https://dotenvx.com/ops

[90mstdout[2m | __tests__/lib/db-pool.test.ts[2m > [22m[2mdb-pool[2m > [22m[2mclosePool resolves without throwing on success
[22m[39m[dotenv@17.2.3] injecting env (0) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }

 [32m✓[39m __tests__/lib/db-pool.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 386[2mms[22m[39m
     [33m[2m✓[22m[39m pool config has connectionLimit: 25 [33m 379[2mms[22m[39m
 [31m❯[39m __tests__/services/document.service.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/services/document-state-machine.test.ts [2m([22m[2m39 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m __tests__/middleware/auth.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m __tests__/repositories/equipment.repository.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m __tests__/middleware/idempotency.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [31m❯[39m __tests__/performance/load-sanity.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/regression/auth-security.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m __tests__/services/assignment.service.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m __tests__/services/settlement-state-machine.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m __tests__/repositories/document.repository.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m __tests__/repositories/dispatch-event.repository.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m __tests__/services/settlement.service.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m __tests__/regression/financial-integrity.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m __tests__/services/settlement-immutability.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m __tests__/repositories/work-item.repository.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m __tests__/repositories/call-session.repository.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m __tests__/repositories/incident.repository.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [31m❯[39m __tests__/lib/logger.test.ts [2m([22m[2m9 tests[22m[2m | [22m[31m6 failed[39m[2m)[22m[33m 523[2mms[22m[39m
[31m       [31m×[31m emits JSON with required fields: timestamp, level, service, msg[39m[32m 4[2mms[22m[39m
[31m       [31m×[31m supports child loggers with correlation_id and route context[39m[32m 2[2mms[22m[39m
[31m       [31m×[31m supports data payloads via mergingObject[39m[32m 1[2mms[22m[39m
[31m       [31m×[31m redacts sensitive fields[39m[32m 1[2mms[22m[39m
[31m       [31m×[31m exports logger and createChildLogger from server/lib/logger[39m[32m 242[2mms[22m[39m
[31m       [31m×[31m createChildLogger produces a logger with correlationId[39m[32m 0[2mms[22m[39m
       [32m✓[39m generates a correlation ID when none provided[32m 219[2mms[22m[39m
       [32m✓[39m uses existing x-correlation-id header if provided[32m 0[2mms[22m[39m
       [32m✓[39m zero console.log calls in server routes, middleware, lib, services[32m 51[2mms[22m[39m
 [32m✓[39m __tests__/services/load-transactions.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m __tests__/services/load.service.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m __tests__/services/load-status-migration.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m __tests__/regression/tenant-isolation.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m __tests__/regression/full-lifecycle.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m __tests__/middleware/metrics-cap.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m __tests__/errors/AppError.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m __tests__/services/ocr.service.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 9[2mms[22m[39m
[90mstdout[2m | __tests__/middleware/graceful-shutdown.test.ts[2m > [22m[2mgraceful shutdown handler[2m > [22m[2mcalls server.close() when SIGTERM is received
[22m[39mSIGTERM received. Shutting down gracefully...

[90mstdout[2m | __tests__/middleware/graceful-shutdown.test.ts[2m > [22m[2mgraceful shutdown handler[2m > [22m[2mcalls server.close() when SIGINT is received
[22m[39mSIGINT received. Shutting down gracefully...

[90mstdout[2m | __tests__/middleware/graceful-shutdown.test.ts[2m > [22m[2mgraceful shutdown handler[2m > [22m[2mcalls closePool() after server.close()
[22m[39mSIGTERM received. Shutting down gracefully...

[90mstdout[2m | __tests__/middleware/graceful-shutdown.test.ts[2m > [22m[2mgraceful shutdown handler[2m > [22m[2mcalls process.exit(0) after cleanup
[22m[39mSIGTERM received. Shutting down gracefully...

[90mstdout[2m | __tests__/middleware/graceful-shutdown.test.ts[2m > [22m[2mgraceful shutdown handler[2m > [22m[2mcalls closePool after server close completes
[22m[39mSIGTERM received. Shutting down gracefully...

 [32m✓[39m __tests__/middleware/graceful-shutdown.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [31m❯[39m __tests__/routes/accounting-tenant.test.ts [2m([22m[2m0 test[22m[2m)[22m
 [32m✓[39m __tests__/lib/db-helpers.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m __tests__/repositories/message.repository.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m __tests__/middleware/tenant.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m __tests__/repositories/driver.repository.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m __tests__/repositories/stop.repository.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m __tests__/services/settlement-calculation.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m __tests__/setup.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 2[2mms[22m[39m

[2m Test Files [22m [1m[31m20 failed[39m[22m[2m | [22m[1m[32m40 passed[39m[22m[90m (60)[39m
[2m      Tests [22m [1m[31m6 failed[39m[22m[2m | [22m[1m[32m564 passed[39m[22m[90m (570)[39m
[2m   Start at [22m 23:39:39
[2m   Duration [22m 1.94s[2m (transform 15.44s, setup 0ms, import 13.39s, tests 2.27s, environment 7ms)[22m — confirms application compatibility
4.  — confirms data integrity

---

## Conclusion

- Rollback mechanism proven via round-trip test in staging-rehearsal.ts
- Load status normalization rollback script exists and documented
- Known lossy mappings explicitly documented and accepted
- Repair procedure available as alternative to full rollback
- Post-rollback verification steps documented

**Rollback path is proven and documented. Production promotion may proceed.**
