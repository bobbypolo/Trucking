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
| start-customer-tunnel.ps1 | Boot DB/backend/frontend and create a verified Cloudflare quick tunnel |
| update_dispatcher_capabilities.cjs | Update dispatcher roles |
| update_roles.cjs | Update user roles |
| verify_apis.cjs | Verify API endpoints |

## Usage

These scripts require .env credentials. Never run against production.

### Customer tunnel quick start (Windows PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev/start-customer-tunnel.ps1
```

This script verifies:
- MySQL reachable on `127.0.0.1:3306` (tries `docker start loadpilot-mysql`)
- Backend health on `http://127.0.0.1:5000/api/health`
- Frontend reachability on `http://127.0.0.1:3101`
- External tunnel URL and external `/api/health` through Cloudflare
