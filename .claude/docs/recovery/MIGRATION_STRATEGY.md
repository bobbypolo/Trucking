# Migration Strategy

> Generated: 2026-03-07 | Story: R-P0-04
> Applies to: LoadPilot Recovery Program (Phases 1-6)

## 1. Current State: Ad-Hoc Scripts

### Inventory of Existing Migration/Upgrade Scripts

| # | File | Type | What It Does | Credentials | Idempotent? | Rollback? |
|---|------|------|-------------|-------------|-------------|-----------|
| 1 | `server/upgrade_financial_ledger.js` | CJS | Creates gl_accounts, journal_entries, journal_lines, ar_invoices, ar_invoice_lines, ap_bills, ap_bill_lines, driver_settlements, settlement_lines, document_vault tables | Hardcoded: `localhost`, `root`, empty password | Yes (CREATE IF NOT EXISTS) | No |
| 2 | `server/upgrade_accounting_v3.js` | CJS | Creates ar_invoice_lines, ap_bill_lines, adjustment_entries, fuel_ledger, mileage_jurisdiction tables + adds gl_account_id columns | .env via dotenv | Yes (CREATE IF NOT EXISTS) | No |
| 3 | `server/upgrade_ifta_intelligence.js` | ESM | Creates ifta_trip_evidence, ifta_trips_audit tables | .env via dotenv | Yes (CREATE IF NOT EXISTS) | No |
| 4 | `server/upgrade_onboarding.js` | CJS | Alters parties table (adds is_customer, is_vendor columns); creates equipment_types table | .env via dotenv | No (ALTER TABLE fails if column exists) | No |
| 5 | `server/upgrade_redaction.js` | CJS | Alters companies table (adds driver_visibility_settings column) | .env via dotenv | Partial (catches ER_DUP_COLUMN_NAME) | No |
| 6 | `server/upgrade_unified_network.js` | CJS | Creates catalog_categories, catalog_items, parties, party_contacts, rate_rows, rate_tiers, constraint_sets, constraint_rules, party_catalog_links, sync_qb_log tables | Hardcoded: `localhost`, `root`, empty password | Yes (CREATE IF NOT EXISTS) | No |
| 7 | `server/migrate_exceptions.js` | CJS | Reads and executes `migrations/exception_management.sql` | Hardcoded: `localhost`, `root`, empty password | Depends on SQL content | No |
| 8 | `server/migrate_exceptions.cjs` | CJS | Duplicate of #7 | Hardcoded: `localhost`, `root`, empty password | Same | No |

### Problems with Current Approach

1. **No version tracking**: No way to know which upgrades have been applied to a given database
2. **No ordering**: Scripts can be run in any order; dependencies between them are implicit
3. **No rollback**: None of the scripts support undo/down migrations
4. **Hardcoded credentials**: 4 of 8 scripts hardcode `localhost`/`root`/empty password
5. **Duplicate scripts**: `migrate_exceptions.js` and `migrate_exceptions.cjs` are duplicates
6. **Mixed module systems**: Mix of CJS (`require`) and ESM (`import`) with no consistency
7. **No CI integration**: Scripts must be run manually; no automated migration on deploy
8. **Partial idempotency**: Some use `CREATE IF NOT EXISTS` but ALTER TABLE scripts fail on re-run

### Seed Scripts (Development Only -- Not Migrations)

| # | File | Purpose |
|---|------|---------|
| 1 | `seed_cjs.cjs` | Generic seed runner |
| 2 | `seed_local_db.cjs` | Seeds local SQLite database |
| 3 | `seed_server_db.ts` | Seeds server MySQL database |
| 4 | `seed_accounting_exceptions.js` | Seeds exception reference data |
| 5 | `server/seed_breakdown_flow.cjs` | Seeds breakdown incident test data |
| 6 | `server/seed_comprehensive_flow.cjs` | Seeds comprehensive test scenario |
| 7 | `server/seed_firebase_auth.cjs` | Seeds Firebase Auth users |
| 8 | `server/seed_firestore.cjs` | Seeds Firestore documents |
| 9 | `server/seed_firestore_run.cjs` | Runner for Firestore seeding |
| 10 | `server/seed_full_flow.cjs` | Seeds full workflow test data |
| 11 | `server/seed_ifta.js` | Seeds IFTA test data |
| 12 | `server/seed_realistic_profiles.cjs` | Seeds realistic user profiles |
| 13 | `server/seed_rtdb.cjs` | Seeds Firebase Realtime Database |
| 14 | `server/seed_unified_master.cjs` | Master seed script |

---

## 2. Target State: Versioned Migrations

### Framework Choice: Custom Lightweight Runner

Given the project constraints (small team, MySQL only, TypeScript), a custom migration runner is preferred over heavy frameworks (Knex, TypeORM, Prisma Migrate). The runner will:

1. Track applied migrations in a `_migrations` table
2. Run migrations in filename order (timestamp-prefixed)
3. Support up/down (apply/rollback) operations
4. Use .env for credentials (never hardcode)
5. Run in CI pipeline as part of deploy

### Migration File Format

```
server/migrations/
  001_base_schema.sql              # Initial schema (from schema.sql)
  002_exception_management.sql     # From existing migrations/exception_management.sql
  003_financial_ledger.sql         # Extracted from upgrade_financial_ledger.js
  004_accounting_v3.sql            # Extracted from upgrade_accounting_v3.js
  005_ifta_intelligence.sql        # Extracted from upgrade_ifta_intelligence.js
  006_unified_network.sql          # Extracted from upgrade_unified_network.js
  007_onboarding_parties.sql       # Extracted from upgrade_onboarding.js
  008_redaction_settings.sql       # Extracted from upgrade_redaction.js
  009_load_status_reconcile.sql    # New: reconcile LoadStatus ENUM (STATE_MACHINES.md)
  010_add_version_columns.sql      # New: optimistic locking for loads
  011_settlement_status.sql        # New: settlement state machine ENUM
  012_journal_immutability.sql     # New: journal entry immutability trigger
```

### Migration Version Table

```sql
CREATE TABLE IF NOT EXISTS _migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(100) DEFAULT 'migration-runner',
    execution_time_ms INT,
    INDEX idx_filename (filename)
);
```

### Migration Runner (server/migrate.ts)

```typescript
// Pseudocode for the migration runner
interface Migration {
  filename: string;
  sql: string;
  checksum: string;  // SHA-256 of file content
}

async function migrate(direction: 'up' | 'down' = 'up') {
  const pool = createPool(process.env);  // From .env, never hardcoded
  const applied = await getAppliedMigrations(pool);
  const available = await scanMigrationFiles('./server/migrations/');

  if (direction === 'up') {
    const pending = available.filter(m => !applied.has(m.filename));
    for (const migration of pending) {
      await applyMigration(pool, migration);
    }
  } else {
    // Rollback: apply the most recent migration's down script
    const last = applied[applied.length - 1];
    await rollbackMigration(pool, last);
  }
}
```

### npm Scripts

```json
{
  "scripts": {
    "migrate": "ts-node server/migrate.ts up",
    "migrate:down": "ts-node server/migrate.ts down",
    "migrate:status": "ts-node server/migrate.ts status",
    "migrate:create": "ts-node server/migrate.ts create"
  }
}
```

---

## 3. Retirement Plan for Ad-Hoc Scripts

### Phase 1 (Foundation) -- R-P1-01

**Step 1: Create migration runner**
- Implement `server/migrate.ts` with up/down/status/create commands
- Create `_migrations` table
- Add npm scripts

**Step 2: Extract SQL from upgrade scripts**
- Read each `upgrade_*.js` and `migrate_*.js` script
- Extract the SQL DDL statements
- Create numbered `.sql` migration files in `server/migrations/`
- Verify each migration file produces the same schema as the original script

**Step 3: Baseline existing database**
- Run `migrate:status` against production database
- Mark all extracted migrations as "already applied" (baseline mode)
- This prevents re-running CREATE TABLE IF NOT EXISTS on production

**Step 4: Archive and deprecate**
- Move all `upgrade_*.js` and `migrate_*.js` scripts to `server/_archived_migrations/`
- Add deprecation notice to each file: `// DEPRECATED: Replaced by server/migrations/NNN_*.sql`
- Update README.md with new migration instructions
- Remove from any deployment scripts or documentation

### Phase 2+ -- New Migrations Only

All schema changes from Phase 2 onward use the versioned system:

```bash
# Create a new migration
npm run migrate:create -- "add_load_version_column"
# Edit the generated file: server/migrations/010_add_load_version_column.sql
# Apply
npm run migrate
```

---

## 4. Rollback Procedures

### Migration Rollback

Each migration file must include a `-- DOWN` section:

```sql
-- UP
ALTER TABLE loads ADD COLUMN version INT DEFAULT 1;
CREATE INDEX idx_loads_version ON loads (id, version);

-- DOWN
DROP INDEX idx_loads_version ON loads;
ALTER TABLE loads DROP COLUMN version;
```

The migration runner parses the `-- UP` and `-- DOWN` markers to split the file.

### Application Rollback

| Scenario | Procedure |
|----------|-----------|
| Bad migration applied | `npm run migrate:down` (reverts last migration) |
| Multiple bad migrations | `npm run migrate:down` repeated N times |
| Migration runner failure mid-execution | Transaction per migration; partial failure rolls back that migration only |
| Need full schema reset (dev only) | `npm run migrate:reset` (drops all tables, re-runs all migrations) |
| Production emergency | Deploy previous git tag; run `migrate:down` to target version |

### Safety Rules

1. **Never edit an applied migration**: Once a migration is in `_migrations`, its SQL must not change. Create a new migration to fix issues.
2. **Always test down migrations**: CI must run up then down then up to verify reversibility.
3. **Transaction wrapping**: Each migration runs inside a transaction. If any statement fails, the entire migration rolls back.
4. **Checksum verification**: The runner stores SHA-256 of each migration file. If a file changes after being applied, the runner warns and refuses to proceed.
5. **Backup before migrate**: Production deploys must snapshot the database before running migrations.

---

## 5. Seed Script Retirement

### Seed scripts serve two purposes:

1. **Development data**: Populate a local database with test data for development
2. **Reference data**: Seed lookup tables (exception_status, exception_type, dashboard_card, gl_accounts)

### Plan:

**Reference data seeds** (keep, move to migrations):
- Exception status/type/dashboard seeds from `seed_accounting_exceptions.js` -> merge into `002_exception_management.sql` as INSERT statements
- GL account chart of accounts -> create `003_financial_ledger.sql` with INSERT after CREATE TABLE

**Development data seeds** (keep as dev tools, consolidate):
- Consolidate 14 seed scripts into a single `server/seed.ts` with sub-commands
- All seed scripts must use .env credentials (no hardcoded values)
- Add `npm run seed` and `npm run seed:reset` commands

**Mock data seeds** (delete):
- `services/mockDataService.ts` -- delete entirely (Phase 2)
- `App.tsx` seed calls -- remove (Phase 2)
- `authService.seedDatabase()` -- remove (Phase 2)
- `storageService.seedDemoLoads()` / `seedIncidents()` -- remove (Phase 2)
- `safetyService.seedSafetyData()` -- remove (Phase 2)

---

## 6. Data Migration Plan (Runtime Data)

Beyond schema migrations, the recovery program requires runtime data transformations:

### Load Status Reconciliation (Phase 2)

```sql
-- Migration 009_load_status_reconcile.sql
-- UP
UPDATE loads SET status = CASE status
  WHEN 'Planned' THEN 'planned'
  WHEN 'Booked' THEN 'booked'
  WHEN 'Active' THEN 'dispatched'
  WHEN 'Departed' THEN 'in_transit'
  WHEN 'Arrived' THEN 'delivered'
  WHEN 'Docked' THEN 'delivered'
  WHEN 'Unloaded' THEN 'delivered'
  WHEN 'Delivered' THEN 'delivered'
  WHEN 'Invoiced' THEN 'invoiced'
  WHEN 'Settled' THEN 'settled'
  WHEN 'Cancelled' THEN 'cancelled'
  WHEN 'CorrectionRequested' THEN status
  ELSE status
END;

ALTER TABLE loads MODIFY COLUMN status
  ENUM('planned','booked','dispatched','in_transit','delivered','invoiced','settled','completed','cancelled')
  DEFAULT 'planned';

-- DOWN
ALTER TABLE loads MODIFY COLUMN status
  ENUM('Planned','Booked','Active','Departed','Arrived','Docked','Unloaded','Delivered','Invoiced','Settled','Cancelled','CorrectionRequested')
  DEFAULT 'Planned';

UPDATE loads SET status = CASE status
  WHEN 'planned' THEN 'Planned'
  WHEN 'booked' THEN 'Booked'
  WHEN 'dispatched' THEN 'Active'
  WHEN 'in_transit' THEN 'Departed'
  WHEN 'delivered' THEN 'Delivered'
  WHEN 'invoiced' THEN 'Invoiced'
  WHEN 'settled' THEN 'Settled'
  WHEN 'cancelled' THEN 'Cancelled'
  ELSE status
END;
```

### Settlement Status Reconciliation (Phase 2)

```sql
-- Migration 011_settlement_status.sql
-- UP
ALTER TABLE driver_settlements MODIFY COLUMN status
  ENUM('pending_generation','generated','reviewed','posted','adjusted')
  DEFAULT 'pending_generation';

UPDATE driver_settlements SET status = CASE status
  WHEN 'Draft' THEN 'pending_generation'
  WHEN 'Calculated' THEN 'generated'
  WHEN 'Approved' THEN 'reviewed'
  WHEN 'Paid' THEN 'posted'
  ELSE status
END;

-- DOWN
ALTER TABLE driver_settlements MODIFY COLUMN status
  ENUM('Draft','Calculated','Approved','Paid')
  DEFAULT 'Draft';

UPDATE driver_settlements SET status = CASE status
  WHEN 'pending_generation' THEN 'Draft'
  WHEN 'generated' THEN 'Calculated'
  WHEN 'reviewed' THEN 'Approved'
  WHEN 'posted' THEN 'Paid'
  ELSE status
END;
```

### SOR Consolidation (Phase 1-2)

| Entity | Current SOR | Target SOR | Migration Approach |
|--------|-------------|------------|-------------------|
| users | Firestore (primary) + MySQL (secondary) | MySQL (primary) + Firebase Auth (identity only) | Phase 1: Write to MySQL first, Firestore second. Phase 2: Remove Firestore profile reads from client. |
| companies | MySQL + Firestore (dual-write) | MySQL only | Phase 2: Stop Firestore dual-write. Verify MySQL has all company data. |
| loads | MySQL + localStorage (shadow) | MySQL only | Phase 2: Remove storageService localStorage. API client reads from server only. |
| incidents | MySQL + localStorage (shadow) | MySQL only | Same as loads. |
| messages | MySQL + localStorage (shadow) | MySQL only | Same as loads. |
| quotes/bookings/leads | MySQL + localStorage (shadow) | MySQL only | Same as loads. |

---

## 7. Migration Testing

### Pre-Production Checklist

1. **Fresh install test**: Run all migrations on empty database, verify schema matches expected state
2. **Upgrade test**: Run new migrations on copy of production database, verify no errors
3. **Rollback test**: Apply then rollback each new migration, verify clean state
4. **Data preservation test**: Verify existing data survives migration (no truncation, no corruption)
5. **Performance test**: Measure migration execution time on production-sized dataset
6. **Idempotency test**: Run migration runner twice, verify second run is no-op

### CI Integration

```yaml
# In CI pipeline (conceptual)
steps:
  - name: Migration Test
    run: |
      # Start test MySQL
      # Run all migrations up
      npm run migrate
      # Verify schema
      npm run migrate:status
      # Run all migrations down
      for i in $(seq 1 12); do npm run migrate:down; done
      # Run all migrations up again
      npm run migrate
      # Run application tests
      npm test
```
