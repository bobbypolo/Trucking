import { Request, Response, NextFunction } from "express";

/**
 * In-memory metrics store for per-route request tracking.
 *
 * Tracks request count, error count, and latency samples per route key.
 * Designed for operational visibility — NOT a production APM replacement.
 *
 * PRODUCTION NOTE: Consider disabling or restricting to internal network.
 * This endpoint should never be exposed publicly.
 */

interface RouteMetrics {
  requestCount: number;
  errorCount: number;
  latencies: number[]; // milliseconds
}

/** In-memory store keyed by "METHOD /path" */
const routeStore = new Map<string, RouteMetrics>();

/** Timestamp when metrics collection started */
let collectedSince = new Date().toISOString();

/**
 * SLO baseline configuration.
 *
 * These are the target service level objectives for the LoadPilot API:
 * - Read endpoints (GET): p99 latency < 500ms
 * - Write endpoints (POST/PUT/PATCH/DELETE): p99 latency < 1000ms
 * - Error rate: < 1% across all endpoints
 */
export const SLO_BASELINES = {
  read_p99_ms: 500,
  write_p99_ms: 1000,
  error_rate_threshold: 0.01,
} as const;

/**
 * Computes percentile from a sorted array of numbers.
 * Uses nearest-rank method.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Normalizes a route path by replacing dynamic segments with :param placeholders.
 * e.g., /api/loads/abc-123/tracking -> /api/loads/:id/tracking
 */
function normalizeRoutePath(path: string): string {
  // Split path into segments and replace UUIDs / numeric IDs with :id
  return path
    .split("/")
    .map((segment) => {
      // UUID pattern
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          segment,
        )
      ) {
        return ":id";
      }
      // Numeric ID
      if (/^\d+$/.test(segment)) {
        return ":id";
      }
      // Alphanumeric ID patterns with digits (e.g., load-001, user-1a2b)
      // Must contain at least one digit to distinguish from static path segments
      if (
        /^[a-z]+-[a-z0-9]+$/i.test(segment) &&
        /\d/.test(segment) &&
        segment.length > 4
      ) {
        return ":id";
      }
      return segment;
    })
    .join("/");
}

/**
 * Express middleware that records per-route metrics.
 *
 * Captures:
 * - Request count per route
 * - Error count (status >= 400)
 * - Latency in milliseconds
 *
 * Must be mounted BEFORE route handlers to capture timing accurately.
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();

  // Hook into response finish event to record metrics
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6; // nanoseconds to ms

    const method = req.method.toUpperCase();
    const path = normalizeRoutePath(req.path);
    const key = `${method} ${path}`;

    let metrics = routeStore.get(key);
    if (!metrics) {
      metrics = { requestCount: 0, errorCount: 0, latencies: [] };
      routeStore.set(key, metrics);
    }

    metrics.requestCount++;
    metrics.latencies.push(durationMs);

    // Count errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      metrics.errorCount++;
    }
  });

  next();
}

/**
 * Returns a snapshot of current metrics data.
 * Does not reset counters.
 */
export function getMetricsSnapshot(): {
  routes: Array<{
    method: string;
    path: string;
    request_count: number;
    error_count: number;
    error_rate: number;
    latency_ms: { p50: number; p95: number; p99: number };
  }>;
  uptime_seconds: number;
  collected_since: string;
  slo_baselines: typeof SLO_BASELINES;
  production_note: string;
} {
  const routes = Array.from(routeStore.entries()).map(([key, metrics]) => {
    const [method, ...pathParts] = key.split(" ");
    const path = pathParts.join(" ");

    const sorted = [...metrics.latencies].sort((a, b) => a - b);

    return {
      method,
      path,
      request_count: metrics.requestCount,
      error_count: metrics.errorCount,
      error_rate:
        metrics.requestCount > 0
          ? Math.round((metrics.errorCount / metrics.requestCount) * 1000) /
            1000
          : 0,
      latency_ms: {
        p50: Math.round(percentile(sorted, 50) * 100) / 100,
        p95: Math.round(percentile(sorted, 95) * 100) / 100,
        p99: Math.round(percentile(sorted, 99) * 100) / 100,
      },
    };
  });

  const uptimeMs = Date.now() - new Date(collectedSince).getTime();

  return {
    routes,
    uptime_seconds: Math.round(uptimeMs / 1000),
    collected_since: collectedSince,
    slo_baselines: SLO_BASELINES,
    production_note:
      "In production, consider disabling this endpoint or restricting access to internal network only.",
  };
}

/**
 * Resets all collected metrics. Used for testing.
 */
export function resetMetrics(): void {
  routeStore.clear();
  collectedSince = new Date().toISOString();
}
