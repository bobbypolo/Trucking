# LoadPilot Ops Readiness Checklist

> **Purpose**: Gate checklist before promoting to production traffic.
> **Owner**: Lead Engineer + SRE
> **Last reviewed**: 2026-03-17

Complete every item before flipping traffic. Items marked **[BLOCKING]** must be verified before any production traffic flows.

---

## 1. Database

- [ ] **[BLOCKING]** All migrations applied (`npx ts-node scripts/migrate.ts status` shows no pending)
- [ ] **[BLOCKING]** PITR (Point-In-Time Recovery) enabled on Cloud SQL instance
- [ ] Connection pool size configured for expected concurrency (default: 25)
- [ ] Cloud SQL Auth Proxy configured and running (production only)
- [ ] DB credentials stored in Secret Manager (not in environment directly)

## 2. Health Endpoint

- [ ] **[BLOCKING]** `GET /api/health` returns `{ "status": "ok" }` on the production URL
- [ ] `dependencies.db.status` is `"connected"` in health response
- [ ] `dependencies.firebase.status` is `"available"` in health response
- [ ] Health endpoint is reachable from load balancer health check path without auth headers
- [ ] Health check configured in Cloud Run with path `/api/health`, interval 30s, threshold 3

## 3. Rate Limiting

- [ ] **[BLOCKING]** `RATE_LIMIT_MAX` environment variable set (recommended: 100 req/15min per IP)
- [ ] Rate limit responses return HTTP 429 (verified via load test)
- [ ] Health endpoint excluded from rate limiter budget (registered before `app.use("/api", apiLimiter)`)

## 4. Authentication & Security

- [ ] Firebase service account credentials deployed to Cloud Run as a Secret
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` or `serviceAccount.json` available to server at runtime
- [ ] Helmet middleware active (CSP, HSTS headers verified)
- [ ] CORS origin restricted to `app.loadpilot.com` (not `*`)
- [ ] JWT expiry <= 1 hour (Firebase default: 1 hour — no action needed)

## 5. Monitoring & Alerting

- [ ] **[BLOCKING]** Cloud Monitoring alerting policy on `/api/health` HTTP 5xx > 1% over 5 min
- [ ] **[BLOCKING]** Cloud SQL CPU > 80% alert configured
- [ ] Error budget policy created in Cloud Monitoring
- [ ] Log-based alert on `"CRITICAL"` level log entries in `loadpilot-api` logs
- [ ] Uptime check configured for `https://api.loadpilot.com/api/health`

## 6. Backup & Recovery

- [ ] **[BLOCKING]** PITR enabled and retention set to 7 days
- [ ] Automated daily Cloud SQL backups enabled
- [ ] Rollback procedure reviewed by on-call engineer (see `docs/remediation/ROLLBACK.md`)
- [ ] Rollback drill performed in staging within the last 30 days

## 7. Build & Test Gate

- [ ] **[BLOCKING]** Server test suite passes (`cd server && npx vitest run`, >= 1,268 tests)
- [ ] **[BLOCKING]** Frontend test suite passes (`npx vitest run`, >= 549 tests)
- [ ] **[BLOCKING]** TypeScript: 0 errors (`npx tsc --noEmit` in both root and server/)
- [ ] Forbidden pattern scan passes (no localStorage SoR, no DEMO_MODE, no browser dialogs)
- [ ] E2E smoke suite passes (login, create load, dispatch flow)

## 8. Traffic Rollout

- [ ] Canary revision deployed at 5% traffic
- [ ] Canary monitored for 2 hours (Gate A) — error rate, latency, DB connections
- [ ] Promote to 50% after Gate A passes
- [ ] Monitor for 24 hours at 50% (Gate B)
- [ ] Promote to 100% after Gate B passes
- [ ] Monitor for 24 hours at 100% (Gate C)

## 9. Go/No-Go Sign-off

| Role          | Name | Date | Signed |
| ------------- | ---- | ---- | ------ |
| Lead Engineer |      |      | [ ]    |
| SRE / On-Call |      |      | [ ]    |
| Product Owner |      |      | [ ]    |

> All [BLOCKING] items must be checked before sign-off. Non-blocking items should be resolved within 48 hours of go-live.

---

## Quick Commands Reference

```bash
# Verify all migrations applied
cd server && npx ts-node scripts/migrate.ts status

# Check health endpoint (replace with prod URL after deploy)
curl https://api.loadpilot.com/api/health | jq .

# Run full test suite
cd server && npx vitest run
npx vitest run

# TypeScript check
npx tsc --noEmit
cd server && npx tsc --noEmit

# E2E smoke
npx playwright test --grep "@smoke"
```
