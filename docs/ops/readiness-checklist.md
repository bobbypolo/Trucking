# LoadPilot Deploy Readiness Checklist

Use this checklist before every production deployment to confirm all prerequisites are met.

## 1. Environment Configuration

- [ ] `.env` file is complete — all keys in `.env.example` are set in the production environment
- [ ] `VITE_FIREBASE_*` keys are set and point to the production Firebase project
- [ ] `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` are set for the production MySQL instance
- [ ] `VITE_GOOGLE_MAPS_API_KEY` is set (required for fleet map)
- [ ] `GEMINI_API_KEY` is set (required for BOL/Rate-Con AI parsing)
- [ ] `JWT_SECRET` is set to a cryptographically random value (min 32 chars)
- [ ] `AZURE_MAPS_KEY` is set (required for weather widget)
- [ ] `NODE_ENV=production` is set on the server

## 2. Database

- [ ] MySQL instance is running and reachable from the server host
- [ ] All 23 migrations have been applied (`server/migrations/001_baseline.sql` through `023_add_loads_deleted_at.sql`)
- [ ] A recent database backup exists before deploying
- [ ] Database user has the minimum required privileges (SELECT, INSERT, UPDATE, DELETE on the app schema)

## 3. Firebase

- [ ] Firebase project exists and is on the Blaze (pay-as-you-go) plan (required for Cloud Functions and external requests)
- [ ] Firebase Authentication is enabled with Email/Password provider
- [ ] Firebase Firestore is initialized in production mode with security rules deployed
- [ ] Firebase Hosting is configured (`firebase.json` points to `dist/`)
- [ ] Service account key is available for the server (or Application Default Credentials are configured)
- [ ] At least one admin user is created in Firebase Auth console

## 4. Build Verification

- [ ] `npx tsc --noEmit` returns 0 errors (frontend)
- [ ] `cd server && npx tsc --noEmit` returns 0 errors (backend)
- [ ] `npm run build` succeeds with no warnings
- [ ] All bundle chunks are within acceptable size limits (see `vite.config.ts` manualChunks)
- [ ] `npx vitest run` passes all frontend tests (baseline: 3,070+)
- [ ] `cd server && npx vitest run` passes all server tests (baseline: 1,792+)

## 5. Health Check

- [ ] `GET /api/health` returns `{ "status": "ok", "mysql": "connected", "firebase": "ready" }` on the target environment
- [ ] Server process starts cleanly with no uncaught exceptions at startup
- [ ] Server binds to the expected port (default: 3001)

## 6. Security

- [ ] No secrets are committed to the repository (`.env` is in `.gitignore`)
- [ ] CORS origin is restricted to the production domain in `server/index.ts`
- [ ] `DEMO_MODE` is `false` in production (check `services/firebase.ts`)
- [ ] Rate limiting is enabled on the server
- [ ] HTTPS is enforced on all production endpoints (Firebase Hosting enforces HTTPS automatically)

## 7. Feature Flags / Data

- [ ] Mock/seed data is not auto-loaded in production (`DEMO_MODE=false`)
- [ ] Firebase Firestore security rules reviewed and deployed
- [ ] Any required reference data (e.g., fuel surcharge tables) has been seeded

## 8. Monitoring

- [ ] Health endpoint URL is configured in your uptime monitor
- [ ] Server logs are being forwarded to a log aggregation service (or reviewed manually)
- [ ] An on-call contact is assigned and aware of the deployment

## 9. Rollback Readiness

- [ ] The previous stable git tag is recorded: `______________________`
- [ ] Rollback procedure has been reviewed: see `docs/ops/rollback-procedure.md`
- [ ] Database backup location is recorded: `______________________`
- [ ] Estimated rollback time has been communicated to stakeholders

## 10. Sign-off

| Role         | Name | Date | Signature |
| ------------ | ---- | ---- | --------- |
| Engineer     |      |      |           |
| QA           |      |      |           |
| Ops / DevOps |      |      |           |

**Deployment approved**: [ ] YES — all items above checked and signed off.
