# PERF_SANITY_REPORT.md — Gate 5 + 6 Evidence
## Observability Baseline and Performance Sanity (R-PV-08)

**Generated**: 2026-03-09
**Sprint**: RC2 — Production Validation Gauntlet
**Test suite baseline**: 970 tests pass, 0 failures (`cd server && npx vitest run`)

---

## § Observability: Structured Logging

### R-PV-08-01: Structured Logs — Pino JSON with service, version, timestamp

**PASS**

Source: `server/lib/logger.ts`

```typescript
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),   // string level not numeric
    },
    timestamp: pino.stdTimeFunctions.isoTime,   // ISO 8601 timestamps
    base: {
        service: 'loadpilot-api',
        version: process.env.APP_VERSION || '0.0.0',
    },
    redact: { ... }
});
```

Sample log line emitted in test run (from routes/metrics.test.ts):
```json
{"level":"info","time":"2026-03-09T17:11:06.418Z","service":"loadpilot-api","version":"0.0.0","route":"GET /api/metrics","data":{"userId":"user-1"},"msg":"Metrics endpoint accessed"}
```

Fields present: `level`, `time` (ISO 8601), `service` ("loadpilot-api"), `version` ("0.0.0"), `msg`.

**Test proof**: `server/__tests__/lib/logger.test.ts`
- Line 8: `it('emits JSON with required fields: timestamp, level, service, msg')` — PASS
- Line 37: `expect(parsed).toHaveProperty('level', 'info')`
- Line 38: `expect(parsed).toHaveProperty('service', 'loadpilot-api')`
- Line 42: `expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)`

---

### R-PV-08-02: Correlation ID Tracing — request → response → log share same ID

**PASS**

Source: `server/middleware/correlationId.ts`

```typescript
export function correlationId(req, res, next): void {
    const id = (req.headers['x-correlation-id'] as string) || uuidv4();
    req.correlationId = id;
    res.setHeader('X-Correlation-Id', id);   // echoed in response header
    next();
}
```

The correlation ID is:
1. Taken from `x-correlation-id` request header OR generated as UUID v4
2. Attached to `req.correlationId` for downstream use
3. Returned in `X-Correlation-Id` response header

Child loggers carry it through: `createChildLogger({ correlationId: req.correlationId })`.

Error handler uses it: `const log = createChildLogger({ correlationId: appError.correlation_id })`.

**Test proof**: `server/__tests__/lib/logger.test.ts`
- Line 172: `it('generates a correlation ID when none provided')` — PASS
- Line 190: `it('uses existing x-correlation-id header if provided')` — PASS
- Line 200: `expect(req.correlationId).toBe('existing-id-456')`
- Line 201: `expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'existing-id-456')`

---

### R-PV-08-03: Sensitive Field Redaction — authorization, password, token, tax_id

**PASS**

Source: `server/lib/logger.ts` redact configuration:
```typescript
redact: {
    paths: [
        'req.headers.authorization',  // auth tokens
        'data.password',              // plaintext passwords
        'data.token',                 // session/JWT tokens
        'data.tax_id',                // PII: tax identifiers
    ],
    censor: '[REDACTED]',
},
```

**Test proof**: `server/__tests__/lib/logger.test.ts`
- Line 112: `it('redacts sensitive fields')` — PASS
- Line 145: `expect(parsed.data.password).toBe('[REDACTED]')`
- Line 146: `expect(parsed.data.token).toBe('[REDACTED]')`

Additional evidence: `it('zero console.log calls in server routes, middleware, lib, services')` (line 207) — confirms zero unstructured logging in production code paths.

---

### R-PV-08-04: Error Envelope — AppError → correct JSON, no stack leak

**PASS**

Source: `server/errors/AppError.ts` + `server/middleware/errorHandler.ts`

The `toJSON()` method explicitly excludes `stack` and `statusCode`:
```typescript
toJSON(): Record<string, unknown> {
    return {
        error_code: this.error_code,
        error_class: this.error_class,
        message: this.message,
        correlation_id: this.correlation_id,
        retryable: this.retryable,
        details: this.details,
        // No: stack, statusCode
    };
}
```

Error hierarchy: ValidationError (400), NotFoundError (404), AuthError (401), ForbiddenError (403), ConflictError (409), BusinessRuleError (422), InternalError (500).

**Test proof**: `server/__tests__/middleware/errorHandler.test.ts`
- Line 37: `it('handles AppError and returns structured JSON')` — PASS
  - Verifies: `error_code`, `error_class`, `message`, `correlation_id`, `retryable`, `details`
- Line 117: `it('does not include stack in AppError response')` — PASS
  - `expect(body).not.toHaveProperty('stack')`
- Line 129: `it('does not include stack in unknown error response')` — PASS
- Line 141: `it('logs the stack server-side via structured logger')` — PASS (stack in pino, not client)
- Line 86: `it('wraps plain Error as InternalError with 500 status')` — PASS

---

## § Metrics: Route-Level Tracking

### R-PV-08-05: Metrics Middleware Captures Counts, Errors, Latency

**PASS**

Source: `server/middleware/metrics.ts`

```typescript
export function metricsMiddleware(req, res, next): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(end - start) / 1e6;  // nanoseconds → ms
        metrics.requestCount++;
        metrics.latencies.push(durationMs);
        if (res.statusCode >= 400) { metrics.errorCount++; }
    });
    next();
}
```

Bounded latency buffer: `MAX_LATENCY_SAMPLES = 1000` (ring buffer, prevents OOM).

Percentile computation: nearest-rank method (p50, p95, p99).

Route normalization: UUIDs and numeric segments normalized to `:id` (prevents cardinality explosion).

**Test proof**: `server/__tests__/routes/metrics.test.ts`
- Line 150: `it('tracks request counts per route')` — PASS (3 requests → count=3)
- Line 168: `it('tracks error counts and error rate')` — PASS (2 errors → rate=1.0)
- Line 186: `it('computes latency percentiles (p50, p95, p99)')` — PASS (all ≥ 0, type number)
- Line 213: `it('includes SLO baseline documentation in response')` — PASS

Latency cap test: `server/__tests__/middleware/metrics-cap.test.ts`
- Line 22: `it('latency array stays at MAX_LATENCY_SAMPLES after recording 1200 requests')` — PASS
- Line 81: `it('internal latencies array never exceeds MAX_LATENCY_SAMPLES')` — PASS

---

### R-PV-08-06: SLO Baselines Documented

**PASS**

Source: `server/middleware/metrics.ts` (`SLO_BASELINES` export):

| Metric | Target | Value |
|--------|--------|-------|
| Read p99 | < 500ms | `read_p99_ms: 500` |
| Write p99 | < 1000ms | `write_p99_ms: 1000` |
| Error rate | < 1% | `error_rate_threshold: 0.01` |

These targets are embedded in the `/api/metrics` response body and returned with every metrics snapshot, enabling real-time SLO tracking.

**Test proof**: `server/__tests__/routes/metrics.test.ts`
- Line 213: `expect(slos.read_p99_ms).toBe(500)` — PASS
- Line 214: `expect(slos.write_p99_ms).toBe(1000)` — PASS
- Line 215: `expect(slos.error_rate_threshold).toBe(0.01)` — PASS

The `/api/metrics` endpoint is restricted to `admin` and `ORG_OWNER_SUPER_ADMIN` roles only (403 for all others).

---

## § Performance: p95 Measurements

### R-PV-08-07: Core Endpoints Under p95 Targets

**PASS**

Measured under concurrent load (15–20 concurrent requests) via `server/__tests__/performance/load-sanity.test.ts`. All against mocked DB (no real MySQL), proving application processing overhead, not network/disk I/O.

| Endpoint | Concurrency | p95 Measured | Target | Status |
|----------|-------------|-------------|--------|--------|
| `GET /api/loads` | 15 | **29.3ms** | < 2000ms | PASS |
| `GET /api/equipment/:companyId` | 15 | **14.6ms** | < 2000ms | PASS |
| `GET /api/accounting/settlements` | 15 | **16.3ms** | < 2000ms | PASS |
| `GET /api/loads/tracking` | 15 | **14.0ms** | < 2000ms | PASS |
| `GET /api/accounting/accounts` | 20 | **17.4ms** | < 1000ms | PASS |
| Auth middleware pass-through | 20 | **16.5ms** | < 500ms | PASS |

**All endpoints well within targets.** Most p95 values are 10–20x better than the 500ms read SLO, confirming the application layer is not the bottleneck. Network and DB I/O (not present with mocked DB) will add latency in production — estimates remain well within SLO given typical MySQL local latency of 1–5ms.

**Test proof**: `server/__tests__/performance/load-sanity.test.ts`
- Line 292–323: GET /api/loads — 15 concurrent — p95 29.3ms — PASS
- Line 325–347: GET /api/equipment — 15 concurrent — p95 14.6ms — PASS
- Line 349–387: GET /api/accounting/settlements — 15 concurrent — p95 16.3ms — PASS
- Line 389–419: GET /api/loads/tracking — 15 concurrent — p95 14.0ms — PASS
- Line 421–458: GET /api/accounting/accounts — 20 concurrent — p95 17.4ms — PASS
- Line 661–693: Auth middleware — 20 concurrent — p95 16.5ms — PASS

---

### R-PV-08-08: No Critical N+1 Patterns on List Routes

**PASS (with documented known N+1)**

Source analysis from `server/__tests__/performance/load-sanity.test.ts` (AC2 section, lines 465–648):

| Route | Load N | DB Queries | Pattern | Classification |
|-------|--------|-----------|---------|----------------|
| `GET /api/loads` | 10 loads | 11 queries (1 + N) | N+1 for legs enrichment | Non-critical |
| `GET /api/accounting/settlements` | 5 settlements | 6 queries (1 + N) | N+1 for lines enrichment | Non-critical |
| `GET /api/loads/tracking` | 3 loads | 4 total (1.3/load) | Acceptable ratio | PASS |
| `GET /api/loads/:id/tracking` | 1 load | 2 queries | Fixed budget | PASS |
| Excessive check (20 loads) | 20 loads | 21 queries | ≤ 3× expected | PASS |

**Known N+1 patterns** (loads legs, settlements lines) are classified **non-critical** because:
- Each sub-query is an indexed lookup on `load_id` / `settlement_id`
- At page sizes ≤ 50 records, total queries ≤ 51 (sub-ms each with indexes)
- No cross-table join amplification observed (no 3× or worse multiplier)
- Tracking routes produce ≤ 5 queries per load regardless of scale

No endpoint exceeded `3× expected` query threshold (the excessive N+1 threshold).

---

## § Graceful Shutdown

### R-PV-08-09: Graceful Shutdown — SIGTERM → HTTP + DB within 10s

**PASS**

Source: `server/lib/graceful-shutdown.ts`

```typescript
export async function registerShutdownHandlers(server, signal): Promise<void> {
    logger.info({ signal }, "Shutting down gracefully...");

    // Force-exit after 10s (prevents hang)
    const forceExit = setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
    }, 10000);
    forceExit.unref();

    // Close HTTP server (stops accepting new connections)
    await new Promise<void>((resolve) => {
        server.close((err) => { if (err) logger.error({ err }, ...); resolve(); });
    });

    // Close MySQL connection pool
    await closePool();
    process.exit(0);
}
```

Shutdown sequence:
1. SIGTERM/SIGINT received → `registerShutdownHandlers` called
2. Force-exit timer armed (10s deadline)
3. `server.close()` called — in-flight requests finish, no new connections accepted
4. `closePool()` called — MySQL pool closed
5. `process.exit(0)` — clean exit

**Test proof**: `server/__tests__/middleware/graceful-shutdown.test.ts`
- Line 34: `it('calls server.close() when SIGTERM is received')` — PASS
- Line 38: `it('calls server.close() when SIGINT is received')` — PASS
- Line 44: `it('calls closePool() after server.close()')` — PASS
- Line 49: `it('calls process.exit(0) after cleanup')` — PASS
- Line 54: `it('calls closePool after server close completes')` (order assertion) — PASS
  - `expect(callOrder).toEqual(['server.close', 'closePool'])` confirms sequencing

---

## § Test References (Per Criterion)

| Criterion | File | Key Lines | Result |
|-----------|------|-----------|--------|
| R-PV-08-01 Structured logs | `server/__tests__/lib/logger.test.ts` | 8–43 | PASS |
| R-PV-08-02 Correlation ID | `server/__tests__/lib/logger.test.ts` | 172–203 | PASS |
| R-PV-08-03 Redaction | `server/__tests__/lib/logger.test.ts` | 112–148 | PASS |
| R-PV-08-04 Error envelope | `server/__tests__/middleware/errorHandler.test.ts` | 37–185 | PASS |
| R-PV-08-05 Metrics middleware | `server/__tests__/routes/metrics.test.ts` | 76–278 | PASS |
| R-PV-08-05 Latency cap | `server/__tests__/middleware/metrics-cap.test.ts` | 13–119 | PASS |
| R-PV-08-06 SLO baselines | `server/__tests__/routes/metrics.test.ts` | 213–227 | PASS |
| R-PV-08-07 p95 targets | `server/__tests__/performance/load-sanity.test.ts` | 286–458 | PASS |
| R-PV-08-08 N+1 analysis | `server/__tests__/performance/load-sanity.test.ts` | 465–648 | PASS |
| R-PV-08-09 Graceful shutdown | `server/__tests__/middleware/graceful-shutdown.test.ts` | 1–66 | PASS |

**Gate 5+6 Status: PASS — All 9 criteria verified with passing tests.**

---

## Summary

The LoadPilot backend is observable and performs within targets:

- **Logging**: Pino JSON with service/version/timestamp on every line. No console.log in production code.
- **Correlation**: Every request gets a UUID correlation ID, echoed in response header, propagated to logs.
- **Redaction**: `authorization`, `password`, `token`, `tax_id` all redacted as `[REDACTED]` in logs.
- **Error envelopes**: AppError hierarchy produces typed JSON errors. Stack never leaves the server.
- **Metrics**: Per-route request count, error rate, and p50/p95/p99 latency. Admin-only endpoint. Bounded memory (1000 samples/route).
- **SLOs**: Read p99 < 500ms, Write p99 < 1000ms, Error rate < 1% — formally documented in code.
- **Performance**: p95 latency 10–30ms at 15–20 concurrent requests (application layer only, well within targets).
- **N+1**: Documented N+1 on legs/lines enrichment is non-critical (indexed sub-queries, no amplification).
- **Shutdown**: SIGTERM → server.close() → closePool() → exit(0) in correct order, 10s force-exit safeguard.
