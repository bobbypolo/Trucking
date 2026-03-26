# Database Migrations

## Runner

The migration runner lives at `server/lib/migrator.ts`. Key behaviors:

- **Pattern**: Only files matching `/^\d{3}_.*\.sql$/` are picked up
- **Ordering**: Files are sorted **alphabetically by filename** (not numerically)
- **Tracking**: Applied migrations are recorded in the `_migrations` table with SHA-256 checksums
- **Delimiters**: Each file uses `-- UP` / `-- DOWN` section markers
- **Transactions**: Each migration runs inside a transaction; failures trigger rollback

## Known Duplicate Numbering (002, 003)

Early migrations were authored by different agents on parallel branches and merged
with duplicate numeric prefixes. Because the runner sorts **alphabetically**, the
execution order is deterministic and correct:

| #   | Filename (alphabetical sort order)        | Description                                                               |
| --- | ----------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `001_baseline.sql`                        | Core schema: companies, users, loads, equipment, etc.                     |
| 2   | `002_add_version_columns.sql`             | Optimistic locking columns on loads, equipment, users                     |
| 3   | `002_load_status_normalization.sql`       | Normalize loads.status from PascalCase to lowercase ENUM                  |
| 4   | `003_enhance_dispatch_events.sql`         | Add actor_id, prior/next_state, correlation_id to dispatch_events         |
| 5   | `003_operational_entities.sql`            | Add company_id to incidents; create call_sessions table                   |
| 6   | `004_idempotency_keys.sql`                | Idempotency key tracking                                                  |
| 7+  | `005_*` through `037_*`                   | See individual file headers                                               |
| 38  | `038_accounting_tenant_to_company_id.sql` | Reconcile tenant_id to company_id on all accounting/IFTA/exception tables |
| 39  | `039_companies_subscription_tier.sql`      | Restore companies.subscription_tier and seed supported dev tenants      |

The duplicate prefixes (two `002_*` and two `003_*`) are harmless because:

1. Alphabetical sort produces a stable, unambiguous order
2. The `_migrations` table tracks by **full filename**, not by prefix number
3. There are no data dependencies between files sharing a prefix

**Do not renumber** existing files. Renaming would cause checksum mismatches on
any database that has already applied them.

## Retired Migrations

The `_retired/` subdirectory contains migration files that have been removed from
the active chain. They are preserved for reference only and are **not** picked up
by the runner (they do not live in the scanned directory).

| File                                                  | Reason                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_retired/002_load_status_normalization_rollback.sql` | Dev-only rollback script for `002_load_status_normalization.sql`. Contains only a `-- DOWN` section (no `-- UP`), so the runner would execute an empty UP and track it as applied, corrupting the migration state. The rollback logic is already included in `002_load_status_normalization.sql`'s own `-- DOWN` section. |

## tenant_id vs company_id Reconciliation

Migrations 011-013 and 016 were authored using `tenant_id` as the multi-tenant
column name. All other tables in the system use `company_id` (referencing
`companies.id`). Migration `038_accounting_tenant_to_company_id.sql` renames
`tenant_id` to `company_id` on all affected tables:

**From 011 (accounting_financial_ledger):**

- `gl_accounts`, `journal_entries`, `ar_invoices`, `ap_bills`, `fuel_ledger`, `driver_settlements`

**From 012 (accounting_v3_extensions):**

- `mileage_jurisdiction`, `document_vault`, `sync_qb_log`, `adjustment_entries`

**From 013 (ifta_intelligence):**

- `ifta_trip_evidence`, `ifta_trips_audit`

**From 016 (exception_management):**

- `exceptions` (also narrows from VARCHAR(64) to VARCHAR(36) to match companies.id)

**Already fixed by 037:**

- `rate_rows`, `constraint_sets` (from 032_parties_subsystem)

After migration 038, all multi-tenant tables consistently use `company_id`.
Migration 039 restores the subscription tier gate expected by requireTier and
seeds the supported dev tenants used by Team 1 and Team 3 validation.

## Adding New Migrations

1. Use the next available 3-digit prefix (currently `040`)
2. Include both `-- UP` and `-- DOWN` sections
3. Use `company_id` (not `tenant_id`) for multi-tenant columns
4. Keep `companies.subscription_tier` present for tier-gated features
5. Test with `npx ts-node server/scripts/migrate.ts status` before applying
