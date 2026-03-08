# Observability Baseline

> Generated: 2026-03-07 | Story: R-P0-05
> Applies to: LoadPilot Recovery Program (Phases 1-6)
> References: RISK_REGISTER.md (RISK-008, RISK-010), TEST_STRATEGY.md, SYSTEM_OF_RECORD_MATRIX.md, API_CONTRACT_CATALOG.md

## 1. Structured Logging Format

### Log Entry Schema (JSON)

All application logs must emit structured JSON. Console.log statements and unstructured text output must be replaced during Phase 1 (R-P1-02) as part of server modularization.

```json
{
  "timestamp": "2026-03-07T14:32:01.456Z",
  "level": "info",
  "service": "loadpilot-api",
  "version": "1.0.0",
  "correlationId": "req-a1b2c3d4-e5f6-7890",
  "traceId": "trace-abc123",
  "spanId": "span-def456",
  "message": "Load status transition completed",
  "context": {
    "route": "PATCH /api/loads/:id/status",
    "method": "PATCH",
    "path": "/api/loads/LD-1001/status",
    "statusCode": 200,
    "durationMs": 42,
    "userId": "usr-001",
    "companyId": "comp-001",
    "tenantId": "comp-001"
  },
  "data": {
    "loadId": "LD-1001",
    "fromStatus": "dispatched",
    "toStatus": "in_transit",
    "transitionId": "T3"
  },
  "error": null
}
```

### Log Levels

| Level | When to Use | Examples |
|-------|-------------|---------|
| **fatal** | Process must exit; unrecoverable state | Database connection pool exhausted and cannot reconnect; uncaught exception in event loop |
| **error** | Operation failed; requires attention | State machine transition rejected with 422; database query timeout; Firebase Auth verification failure |
| **warn** | Degraded but functional; potential issue | Dual-write divergence detected (Firestore succeeded, MySQL failed); deprecated endpoint called; slow query > 2s |
| **info** | Normal operation milestones | Load status transition completed; user login; invoice created; settlement posted to GL |
| **debug** | Developer diagnostic detail | SQL query text and parameters; request/response bodies; state machine guard evaluation results |
| **trace** | Fine-grained execution flow | Middleware chain entry/exit; individual guard condition checks; localStorage fallback triggered (pre-removal) |

### Correlation ID Strategy

Every inbound HTTP request receives a `correlationId` (UUID v4) at the Express middleware layer. This ID propagates through:

1. **Request middleware** -> sets `req.correlationId`
2. **Logger context** -> automatically attached to every log line within the request
3. **Database queries** -> included as comment in SQL (for slow query log correlation)
4. **Outbound API calls** -> forwarded as `X-Correlation-Id` header (Gemini AI, Google Maps, Azure Maps)
5. **Error responses** -> returned to client in response body for support ticket reference

```typescript
// Middleware pattern (to be implemented in Phase 1)
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
});
```

### Logger Implementation

Framework: **pino** (recommended for Node.js structured JSON logging with minimal overhead)

```typescript
// server/lib/logger.ts (to be created in Phase 1)
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'loadpilot-api',
    version: process.env.APP_VERSION || '0.0.0',
  },
  redact: {
    paths: ['req.headers.authorization', 'data.password', 'data.token', 'data.tax_id'],
    censor: '[REDACTED]',
  },
});
```

### Sensitive Data Redaction

The following fields must NEVER appear in logs in cleartext:

| Field | Source | Redaction |
|-------|--------|-----------|
| `password` | User registration/login | Hash only (bcrypt output OK) |
| `authorization` header | All requests | `[REDACTED]` |
| `token` | JWT tokens | Last 8 chars only |
| `tax_id` | Company profile | `[REDACTED]` |
| `serviceAccount` credentials | Firebase Admin | Never log; loaded from file |
| Database connection strings | db.ts pool config | Host and port only; no password |

---

## 2. Metric Categories

### 2.1 Request Metrics (RED Method)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | method, route, status_code | Request latency distribution |
| `http_requests_total` | Counter | method, route, status_code | Total request count |
| `http_request_errors_total` | Counter | method, route, error_type | Requests returning 4xx/5xx |
| `http_active_connections` | Gauge | -- | Current open HTTP connections |

**Route cardinality control**: Use parameterized route patterns (e.g., `/api/loads/:id/status`) not actual URLs (e.g., `/api/loads/LD-1001/status`) to prevent metric explosion.

### 2.2 Database Metrics (USE Method)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `db_query_duration_seconds` | Histogram | query_type (SELECT/INSERT/UPDATE/DELETE), table | Query latency distribution |
| `db_pool_connections_active` | Gauge | -- | Active connections in MySQL pool |
| `db_pool_connections_idle` | Gauge | -- | Idle connections in MySQL pool |
| `db_pool_connections_waiting` | Gauge | -- | Queries waiting for a connection |
| `db_query_errors_total` | Counter | error_code, table | Failed database queries |
| `db_migration_version` | Gauge | -- | Current migration version number (from _migrations table) |

### 2.3 Authentication and Security Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `auth_login_total` | Counter | result (success/failure), method | Login attempts |
| `auth_token_verification_total` | Counter | result (valid/expired/invalid) | Firebase token verifications |
| `auth_tenant_violation_total` | Counter | route | Cross-tenant access attempts blocked by middleware |
| `auth_rbac_denial_total` | Counter | route, required_role | RBAC permission denials |

### 2.4 Business Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `loads_created_total` | Counter | company_id | New loads created |
| `load_status_transitions_total` | Counter | from_status, to_status, result (success/rejected) | State machine transition attempts |
| `load_status_transition_rejected_total` | Counter | from_status, to_status, reason | Rejected transitions (forbidden or guard failed) |
| `invoices_created_total` | Counter | company_id | AR invoices generated |
| `settlements_posted_total` | Counter | company_id | Driver settlements posted to GL |
| `journal_entries_total` | Counter | entry_type (invoice/settlement/adjustment) | GL journal entries created |
| `journal_balance_violations_total` | Counter | -- | Debits != credits (should always be 0) |
| `dual_write_divergence_total` | Counter | entity (company/user), store (firestore/mysql) | Firestore+MySQL write failures |
| `localStorage_fallback_total` | Counter | entity | Client localStorage fallback triggers (Phase 2: should drop to 0) |
| `mock_seed_invocations_total` | Counter | function_name | Mock data seed calls (Phase 2: should drop to 0) |
| `ocr_extraction_total` | Counter | result (success/failure/mock) | Document OCR attempts |

### 2.5 Infrastructure Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `process_cpu_seconds_total` | Counter | -- | Node.js process CPU usage |
| `process_memory_bytes` | Gauge | type (rss/heapUsed/heapTotal) | Node.js memory usage |
| `process_event_loop_lag_seconds` | Histogram | -- | Event loop delay |
| `firebase_api_calls_total` | Counter | service (auth/firestore), method | Firebase API call count |
| `external_api_duration_seconds` | Histogram | service (gemini/google_maps/azure_maps) | External API latency |

---

## 3. Alert Rules

### 3.1 Severity Levels

| Severity | Response Time | Notification Channel | Examples |
|----------|--------------|---------------------|----------|
| **P1 - Critical** | Immediate (< 5 min) | PagerDuty/SMS + Slack #alerts | Service down; data loss risk; security breach |
| **P2 - High** | < 30 min | Slack #alerts | Error rate spike; database degradation; auth failures |
| **P3 - Medium** | < 4 hours | Slack #ops | Elevated latency; connection pool pressure; slow queries |
| **P4 - Low** | Next business day | Email digest | Coverage drop; deprecated endpoint usage; mock data detected |

### 3.2 Alert Definitions

#### P1 Alerts (Critical)

| Alert Name | Condition | Duration | Action |
|-----------|-----------|----------|--------|
| **ServiceDown** | `http_requests_total` rate = 0 for all routes | 2 min | Page on-call; check process health; restart if needed |
| **DatabaseUnreachable** | `db_pool_connections_active` = 0 AND `db_pool_connections_waiting` > 0 | 1 min | Page on-call; check MySQL status; failover if available |
| **ErrorRateSpike** | `http_request_errors_total` (5xx) rate > 10% of total requests | 3 min | Page on-call; check recent deploy; consider rollback |
| **TenantViolationDetected** | `auth_tenant_violation_total` increase > 0 in 5 min window | Instant | Security review; check for attack pattern; block IP if malicious |
| **JournalBalanceViolation** | `journal_balance_violations_total` increase > 0 | Instant | Halt financial operations; investigate data integrity; page finance lead |

#### P2 Alerts (High)

| Alert Name | Condition | Duration | Action |
|-----------|-----------|----------|--------|
| **HighErrorRate** | `http_request_errors_total` (5xx) rate > 5% of total | 5 min | Investigate error logs; check database health; review recent changes |
| **AuthFailureSpike** | `auth_login_total{result=failure}` > 20 in 5 min | 5 min | Check for brute force; review auth logs; consider rate limiting |
| **DatabaseSlowQueries** | `db_query_duration_seconds` p99 > 5s | 5 min | Review slow query log; check for missing indexes; optimize queries |
| **ConnectionPoolExhaustion** | `db_pool_connections_waiting` > 10 | 3 min | Increase pool size or investigate connection leaks |
| **DualWriteDivergence** | `dual_write_divergence_total` increase > 0 in 15 min | 15 min | Reconcile Firestore and MySQL; investigate root cause |
| **HighMemoryUsage** | `process_memory_bytes{type=heapUsed}` > 80% of available | 5 min | Check for memory leaks; restart if approaching OOM |

#### P3 Alerts (Medium)

| Alert Name | Condition | Duration | Action |
|-----------|-----------|----------|--------|
| **ElevatedLatency** | `http_request_duration_seconds` p95 > 2s | 10 min | Profile slow endpoints; check database load |
| **EventLoopLag** | `process_event_loop_lag_seconds` p99 > 500ms | 5 min | Identify blocking operations; check for sync I/O |
| **ExternalAPILatency** | `external_api_duration_seconds` p95 > 10s | 10 min | Check Gemini/Maps/Azure status; consider circuit breaker |
| **StateTransitionRejectionSpike** | `load_status_transition_rejected_total` > 50 in 1 hour | 1 hour | UX issue or client bug; review rejection reasons |

#### P4 Alerts (Low)

| Alert Name | Condition | Duration | Action |
|-----------|-----------|----------|--------|
| **MockDataDetected** | `mock_seed_invocations_total` increase > 0 | Any | Phase 2 regression; mock code not fully removed |
| **LocalStorageFallback** | `localStorage_fallback_total` increase > 0 | Any | Phase 2 regression; API client not fully migrated |
| **DeprecatedEndpointUsed** | Request to deprecated route pattern | Any | Track client migration progress; plan removal |

---

## 4. SLO Targets

### 4.1 Availability SLOs

| Service | SLO Target | Error Budget (30 days) | Measurement |
|---------|-----------|----------------------|-------------|
| **API Server** (all /api/* routes) | 99.5% | 3.6 hours downtime/month | `1 - (5xx responses / total responses)` |
| **Authentication** (/api/auth/login) | 99.9% | 43 min downtime/month | `1 - (login failures due to infra / total login attempts)` |
| **Database** (MySQL pool) | 99.9% | 43 min downtime/month | `1 - (connection failures / total connection attempts)` |
| **Financial Operations** (GL posting) | 99.95% | 22 min downtime/month | `1 - (failed GL posts / total GL post attempts)` |

### 4.2 Latency SLOs

| Endpoint Category | p50 Target | p95 Target | p99 Target | Measurement |
|-------------------|-----------|-----------|-----------|-------------|
| **Read endpoints** (GET /api/*) | < 100ms | < 500ms | < 2s | `http_request_duration_seconds` histogram |
| **Write endpoints** (POST/PUT/PATCH) | < 200ms | < 1s | < 3s | `http_request_duration_seconds` histogram |
| **Load status transitions** (PATCH /api/loads/:id/status) | < 150ms | < 500ms | < 1s | Includes state machine validation + DB write + dispatch_event insert |
| **Financial postings** (invoice/settlement GL) | < 500ms | < 2s | < 5s | Includes journal_entry + journal_lines insert in transaction |
| **Search** (GET /api/global-search) | < 300ms | < 1s | < 3s | Full-text search across tenant-scoped tables |
| **Document OCR** (POST /api/scanner/extract) | < 5s | < 15s | < 30s | Gemini AI round-trip (external API dependency) |

### 4.3 Data Integrity SLOs

| Invariant | SLO Target | Measurement | Action if Violated |
|-----------|-----------|-------------|-------------------|
| **Journal balance** (debits = credits per entry) | 100% (zero tolerance) | `journal_balance_violations_total` = 0 | P1 alert; halt financial operations; manual reconciliation |
| **State machine enforcement** (no invalid transitions) | 100% | No load or settlement in invalid state per nightly audit query | P1 alert; investigate bypass; patch immediately |
| **Tenant isolation** (no cross-tenant data access) | 100% | `auth_tenant_violation_total` correlation with actual data leaks = 0 | P1 alert; security incident response |
| **Single SOR consistency** (MySQL = Firestore for dual-write entities) | 99.9% | Nightly reconciliation job comparing MySQL and Firestore records | P2 alert; run reconciliation repair script |

### 4.4 Error Budget Policy

| Error Budget Remaining | Policy |
|----------------------|--------|
| > 50% | Normal development velocity; deploy at will |
| 25-50% | Increased monitoring; deploy with explicit rollback plan ready |
| 10-25% | Feature freeze; focus on reliability improvements only |
| < 10% | Full reliability freeze; no new features until budget recovers; all engineering on SLO restoration |
| 0% (budget exhausted) | Incident review required; reliability sprint before any new work |

---

## 5. Health Check Endpoints

### Current State

The existing `/api/health` endpoint (route 1 in API_CONTRACT_CATALOG.md) returns a simple response with no dependency checks.

### Target Health Check Design

```typescript
// GET /api/health (public, no auth)
{
  "status": "healthy",           // healthy | degraded | unhealthy
  "timestamp": "2026-03-07T14:32:01.456Z",
  "version": "1.0.0",
  "uptime_seconds": 86400,
  "checks": {
    "mysql": {
      "status": "healthy",
      "latency_ms": 2,
      "pool_active": 5,
      "pool_idle": 15,
      "pool_waiting": 0,
      "migration_version": 12
    },
    "firebase_auth": {
      "status": "healthy",
      "latency_ms": 45
    },
    "firestore": {
      "status": "healthy",
      "latency_ms": 38
    }
  }
}
```

### Readiness vs Liveness

| Endpoint | Purpose | Auth | Checks |
|----------|---------|------|--------|
| `GET /api/health/live` | Process is running | No | Returns 200 if Express is handling requests |
| `GET /api/health/ready` | Process can serve traffic | No | MySQL pool reachable, Firebase Admin initialized, migrations current |
| `GET /api/health` | Full status (backward-compatible) | No | All dependency checks with latency measurements |

---

## 6. Dashboard Panels (Recommended)

### Operational Dashboard

| Panel | Metrics | Visualization |
|-------|---------|---------------|
| **Request Rate** | `http_requests_total` by route | Time series (stacked area) |
| **Error Rate** | `http_request_errors_total` / `http_requests_total` | Time series (percentage line) |
| **Latency Distribution** | `http_request_duration_seconds` p50/p95/p99 | Time series (multi-line) |
| **Database Health** | Pool connections (active/idle/waiting) | Gauge panel |
| **Active Loads** | Count of loads by status | Stacked bar chart |
| **Auth Activity** | Login success/failure rate | Time series |

### Business Dashboard

| Panel | Metrics | Visualization |
|-------|---------|---------------|
| **Load Throughput** | `loads_created_total` by company | Counter per day |
| **Status Flow** | `load_status_transitions_total` by from/to | Sankey diagram |
| **Financial Pipeline** | Invoice and settlement creation rate | Time series |
| **Data Quality** | Mock invocations, localStorage fallbacks | Counter (should be 0 post-Phase 2) |
| **Recovery Progress** | Risks mitigated, test coverage trend | Scorecard |

---

## 7. Implementation Phases

| Phase | Observability Work | Deliverables |
|-------|-------------------|-------------|
| Phase 1 (Foundation) | Install pino logger; add correlation ID middleware; replace console.log in new route modules; add health check dependencies | `server/lib/logger.ts`, updated `/api/health`, request logging middleware |
| Phase 2 (Core Slice) | Add state machine transition metrics; add localStorage fallback detection; instrument load and settlement lifecycle | Business metrics counters, dashboard panels |
| Phase 3 (Integration) | Add external API latency tracking (Gemini, Maps); add OCR metrics | External service monitoring |
| Phase 4 (Financial) | Add journal balance validation metric; GL posting tracking; settlement lifecycle metrics | Financial integrity dashboard |
| Phase 5 (Stabilize) | SLO tracking dashboard; error budget automation; alert tuning based on baseline data | SLO burn-rate alerts, error budget policy enforcement |
| Phase 6 (Deploy) | Production readiness review; alert routing to PagerDuty/Slack; runbook links in alert descriptions | Go-live monitoring configuration |
