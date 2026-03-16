# Server Development Scripts

These scripts are for local development and database seeding only.
They should NOT be run in production environments.

## Server Dev Scripts (scripts/dev/server/)

| Script | Purpose |
|--------|---------|
| check_billing.cjs | Check billing records |
| check_db.js | Check DB connectivity |
| migrate_exceptions.cjs / .js | Run exception migrations |
| repair_identity_sync.cjs | Repair identity sync issues |
| seed_breakdown_flow.cjs | Seed breakdown test data |
| seed_comprehensive_flow.cjs | Seed comprehensive flow data |
| seed_firebase_auth.cjs | Seed Firebase Auth users |
| seed_firestore.cjs / seed_firestore_run.cjs | Seed Firestore collections |
| seed_full_flow.cjs | Seed full workflow data |
| seed_ifta.js | Seed IFTA test data |
| seed_realistic_profiles.cjs | Seed realistic driver profiles |
| seed_rtdb.cjs | Seed Realtime DB |
| seed_unified_master.cjs | Seed unified master data |
| test_db.js / test_db.ts | Test DB connection |
| upgrade_accounting_v3.js | Upgrade accounting schema |
| upgrade_financial_ledger.js | Upgrade financial ledger |
| upgrade_ifta_intelligence.js | Upgrade IFTA data |
| upgrade_onboarding.js | Upgrade onboarding data |
| upgrade_redaction.js | Upgrade redaction settings |
| upgrade_unified_network.js | Upgrade network data |

## Usage

These scripts require .env credentials. Never run against production.
