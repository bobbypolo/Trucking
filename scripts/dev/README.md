# Development Scripts

These scripts are for local development and database seeding only.
They should NOT be run in production environments.

## Root Dev Scripts (scripts/dev/)

| Script | Purpose |
|--------|---------|
| check_core_schema.cjs | Verify core DB schema |
| check_db_schema.cjs | Verify full DB schema |
| debug_tags.cjs / v2 / v3 | Debug Firebase tags |
| list.js / list_tables.js | List DB tables |
| probe_db.cjs | Probe DB connection |
| seed_accounting_exceptions.js | Seed accounting test data |
| seed_cjs.cjs / seed_local_db.cjs | Seed local DB |
| seed_server_db.ts | Seed server DB (TypeScript) |
| update_dispatcher_capabilities.cjs | Update dispatcher roles |
| update_roles.cjs | Update user roles |
| verify_apis.cjs | Verify API endpoints |

## Usage

These scripts require .env credentials. Never run against production.
