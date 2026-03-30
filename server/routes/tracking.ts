import { Router } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { requireTier } from "../middleware/requireTier";
import { validateBody } from "../middleware/validate";
import { validateParams } from "../middleware/validateParams";
import { idParam } from "../schemas/params";
import {
  trackingWebhookSchema,
  createProviderConfigSchema,
  createVehicleMappingSchema,
} from "../schemas/tracking";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";
import { getGpsProvider, getGpsProviderForTenant } from "../services/gps";
import type { GpsPosition, TrackingState } from "../services/gps";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
} from "../services/secret-encryption";

const router = Router();

interface TrackingLeg {
  id: string;
  load_id: string;
  type: string;
  facility_name: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  completed: boolean;
  sequence_order: number;
}

interface TrackingPosition {
  latitude: number;
  longitude: number;
}

interface TrackingLoad {
  id: string;
  loadNumber: string;
  status: string;
  driverId: string | null;
  legs: TrackingLeg[];
  currentPosition: TrackingPosition | null;
}

type SupportedProviderName = "samsara" | "webhook";

/**
 * Simple in-memory metrics counter for webhook rejection tracking.
 * Keyed by rejection reason (e.g., "missing_company_id", "unknown_company_id").
 */
const webhookRejectionMetrics = new Map<string, number>();

/** Increment a webhook rejection counter by reason. */
function incrementWebhookRejection(reason: string): void {
  webhookRejectionMetrics.set(
    reason,
    (webhookRejectionMetrics.get(reason) ?? 0) + 1,
  );
}

/** Get the current rejection count for a given reason (exposed for testing). */
export function getWebhookRejectionCount(reason: string): number {
  return webhookRejectionMetrics.get(reason) ?? 0;
}

/** Reset all rejection counters (exposed for testing). */
export function resetWebhookRejectionMetrics(): void {
  webhookRejectionMetrics.clear();
}

/**
 * Truncate a GPS coordinate to 2 decimal places for privacy.
 * Full precision (~1m) is never logged; 2 decimals (~1km) is sufficient for debugging.
 */
function redactCoordinate(coord: number | null | undefined): string {
  if (coord == null) return "null";
  return Number(coord).toFixed(2);
}

function normalizeSupportedProviderName(
  name: unknown,
): SupportedProviderName | null {
  if (typeof name !== "string") return null;
  const normalized = name.toLowerCase().replace(/\s+/g, "_").trim();
  if (normalized === "samsara") return "samsara";
  if (normalized === "webhook" || normalized === "generic_webhook")
    return "webhook";
  return null;
}

function formatProviderDisplayName(name?: string | null): string | null {
  if (!name) return null;
  if (name === "samsara") return "Samsara";
  if (name === "webhook") return "Generic Webhook";
  return name;
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE" &&
    "message" in error &&
    String((error as { message?: string }).message ?? "").includes(tableName)
  );
}

/**
 * Derive the current position from DB-stored stop coordinates.
 * Uses the last completed stop that has coordinates.
 */
function deriveCurrentPosition(legs: TrackingLeg[]): TrackingPosition | null {
  const completedWithCoords = legs
    .filter(
      (leg) => leg.completed && leg.latitude != null && leg.longitude != null,
    )
    .sort((a, b) => b.sequence_order - a.sequence_order);

  if (completedWithCoords.length === 0) {
    return null;
  }

  const lastCompleted = completedWithCoords[0];
  return {
    latitude: lastCompleted.latitude!,
    longitude: lastCompleted.longitude!,
  };
}

/**
 * GET /api/loads/tracking
 * Returns tracking positions for all active loads belonging to the tenant.
 * Coordinates come from stored lat/lng in load_legs (DB-backed, not mock).
 */
router.get(
  "/api/loads/tracking",
  requireAuth,
  requireTenant,
  requireTier("Fleet Core", "Fleet Command"),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    try {
      const [loads]: any = await pool.query(
        `SELECT id, load_number, status, driver_id
             FROM loads
             WHERE company_id = ? AND status IN ('in_transit', 'dispatched', 'planned', 'arrived')
             ORDER BY created_at DESC`,
        [companyId],
      );

      if (loads.length === 0) {
        return res.json([]);
      }

      // Single query for all load legs (avoids N+1)
      const loadIds = loads.map((l: any) => l.id);
      const placeholders = loadIds.map(() => "?").join(", ");
      const [allLegs]: any = await pool.query(
        `SELECT id, load_id, type, facility_name, city, state,
                latitude, longitude, completed, sequence_order
         FROM load_legs
         WHERE load_id IN (${placeholders})
         ORDER BY sequence_order ASC`,
        loadIds,
      );

      // Group legs by load_id
      const legsByLoad = new Map<string, any[]>();
      for (const leg of allLegs) {
        const arr = legsByLoad.get(leg.load_id) || [];
        arr.push(leg);
        legsByLoad.set(leg.load_id, arr);
      }

      const result: TrackingLoad[] = loads.map((load: any) => {
        const legs = legsByLoad.get(load.id) || [];
        return {
          id: load.id,
          loadNumber: load.load_number,
          status: load.status,
          driverId: load.driver_id,
          legs,
          currentPosition: deriveCurrentPosition(legs),
        };
      });

      res.json(result);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/loads/tracking");
      log.error({ err: error }, "SERVER ERROR [GET /api/loads/tracking]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * GET /api/loads/:id/tracking
 * Returns tracking data for a specific load.
 */
router.get(
  "/api/loads/:id/tracking",
  requireAuth,
  requireTenant,
  requireTier("Fleet Core", "Fleet Command"),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const loadId = req.params.id;

    try {
      const [loads]: any = await pool.query(
        "SELECT id, load_number, status, driver_id FROM loads WHERE id = ? AND company_id = ?",
        [loadId, companyId],
      );

      if (loads.length === 0) {
        return res.status(404).json({ error: "Load not found" });
      }

      const load = loads[0];
      const [legs]: any = await pool.query(
        `SELECT id, load_id, type, facility_name, city, state,
                    latitude, longitude, completed, sequence_order
             FROM load_legs
             WHERE load_id = ?
             ORDER BY sequence_order ASC`,
        [load.id],
      );

      res.json({
        id: load.id,
        loadNumber: load.load_number,
        status: load.status,
        driverId: load.driver_id,
        legs,
        currentPosition: deriveCurrentPosition(legs),
      });
    } catch (error) {
      const log = createRequestLogger(
        req,
        `GET /api/loads/${req.params.id}/tracking`,
      );
      log.error(
        { err: error },
        `SERVER ERROR [GET /api/loads/${req.params.id}/tracking]`,
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * Store GPS positions in the gps_positions table.
 * Best-effort — errors are logged but do not fail the request.
 */
async function storePositions(
  companyId: string,
  positions: GpsPosition[],
  log: ReturnType<typeof createRequestLogger>,
): Promise<void> {
  // Filter out mock positions — never persist simulated data
  const realPositions = positions.filter((p) => !p.isMock);
  if (realPositions.length === 0) return;

  try {
    const values = realPositions.map((p) => [
      randomUUID(),
      companyId,
      p.vehicleId,
      p.driverId || null,
      p.latitude,
      p.longitude,
      p.speed ?? null,
      p.heading ?? null,
      p.recordedAt || new Date(),
      p.provider || null,
      p.providerVehicleId || null,
    ]);

    const placeholders = values
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    await pool.query(
      `INSERT INTO gps_positions
         (id, company_id, vehicle_id, driver_id, latitude, longitude,
          speed, heading, recorded_at, provider, provider_vehicle_id)
       VALUES ${placeholders}`,
      values.flat(),
    );
  } catch (err) {
    log.error({ err }, "Failed to store GPS positions");
  }
}

/**
 * GET /api/tracking/live
 * Returns live GPS positions from the configured GPS provider.
 * Uses DB-backed provider config when available; falls back to env-based provider.
 * Returns trackingState to surface configuration status to the frontend.
 * Stores received positions in gps_positions table.
 * Requires Firebase auth + tenant.
 */
router.get(
  "/api/tracking/live",
  requireAuth,
  requireTenant,
  requireTier("Fleet Core", "Fleet Command"),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const log = createRequestLogger(req, "GET /api/tracking/live");

    try {
      // Try DB-backed provider config first
      let positions: GpsPosition[] = [];
      let trackingState: TrackingState;
      let providerName: string | undefined;

      try {
        const result = await getGpsProviderForTenant(companyId, pool);
        providerName = result.providerName;

        if (result.state === "configured-no-credentials") {
          // Provider configured but missing credentials
          trackingState = "configured-no-credentials";
        } else if (!result.provider && result.state === "not-configured") {
          // No DB config at all — check env-based provider as fallback
          const gps = getGpsProvider();
          positions = await gps.getVehicleLocations(companyId);
          // env-based adapter returns empty when no token (no mock data)
          trackingState =
            positions.length > 0 ? "configured-live" : "not-configured";
        } else if (result.provider) {
          // DB-backed provider with credentials — fetch real positions
          positions = await result.provider.getVehicleLocations(companyId);
          trackingState =
            positions.length > 0 ? "configured-live" : "configured-idle";
        } else {
          // Webhook or other null-provider configured state
          trackingState = result.state;
        }
      } catch (providerErr) {
        log.error({ err: providerErr }, "GPS provider lookup failed");
        trackingState = "provider-error";
      }

      // Store positions in DB (best-effort)
      await storePositions(companyId, positions, log);

      res.json({
        positions,
        trackingState,
        providerName,
        providerDisplayName: formatProviderDisplayName(providerName),
      });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/tracking/live]");
      res.status(500).json({ error: "GPS tracking error" });
    }
  },
);

/**
 * In-memory rate limiter for GPS webhook.
 * Tracks request counts per API key within a sliding window.
 */
const webhookRateLimit = new Map<string, { count: number; resetAt: number }>();
const WEBHOOK_RATE_LIMIT = 1000; // max requests per minute per API key
const WEBHOOK_RATE_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60_000; // evict stale entries every 5 min

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of webhookRateLimit) {
    if (now >= entry.resetAt) webhookRateLimit.delete(key);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL).unref();

/**
 * POST /api/tracking/webhook
 * Accepts GPS position pings from ELD/GPS providers.
 * Auth: X-GPS-API-Key header validated against GPS_WEBHOOK_SECRET env var.
 * Not Firebase auth — ELD providers can't do Firebase.
 */
router.post("/api/tracking/webhook", async (req: any, res) => {
  const log = createRequestLogger(req, "POST /api/tracking/webhook");

  // Validate X-GPS-API-Key header
  const apiKey = req.headers["x-gps-api-key"];
  const expectedKey = process.env.GPS_WEBHOOK_SECRET;

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key" });
  }

  if (!expectedKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Rate limit per API key
  const now = Date.now();
  const rateKey = apiKey as string;
  const entry = webhookRateLimit.get(rateKey);
  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count > WEBHOOK_RATE_LIMIT) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
  } else {
    webhookRateLimit.set(rateKey, {
      count: 1,
      resetAt: now + WEBHOOK_RATE_WINDOW,
    });
  }

  // Validate body shape via Zod (API key auth is header-based, handled above)
  const parseResult = trackingWebhookSchema.safeParse(req.body);
  if (!parseResult.success) {
    const failedFields = parseResult.error.issues.map((i: any) =>
      i.path.join(".") || "(root)",
    );

    // Non-companyId field failures reported first (matches original validation order)
    const nonCompanyFailures = failedFields.filter((f: string) => f !== "companyId");
    if (nonCompanyFailures.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing required fields: ${nonCompanyFailures.join(", ")}` });
    }

    // Only companyId failed — preserve missing_company_id metric and logging
    incrementWebhookRejection("missing_company_id");
    log.warn(
      {
        vehicleId: req.body.vehicleId,
        lat: redactCoordinate(req.body.latitude),
        lng: redactCoordinate(req.body.longitude),
        provider: "webhook",
      },
      "GPS webhook rejected: missing company_id",
    );
    return res.status(400).json({ error: "company_id required" });
  }
  req.body = parseResult.data;

  const {
    vehicleId,
    latitude,
    longitude,
    speed,
    heading,
    driverId,
    companyId,
  } = req.body;

  let resolvedCompanyId: string;
  try {
    const [companies]: any = await pool.query(
      `SELECT id FROM companies WHERE id = ? LIMIT 1`,
      [companyId],
    );
    if (companies.length === 0) {
      incrementWebhookRejection("unknown_company_id");
      log.warn(
        {
          vehicleId,
          companyId,
          lat: redactCoordinate(latitude),
          lng: redactCoordinate(longitude),
          provider: "webhook",
        },
        "GPS webhook rejected: unknown company_id",
      );
      return res.status(400).json({ error: "unknown company_id" });
    }
    resolvedCompanyId = companyId;
  } catch {
    incrementWebhookRejection("unknown_company_id");
    log.warn(
      {
        vehicleId,
        companyId,
        lat: redactCoordinate(latitude),
        lng: redactCoordinate(longitude),
        provider: "webhook",
      },
      "GPS webhook rejected: company_id validation failed",
    );
    return res.status(400).json({ error: "unknown company_id" });
  }

  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO gps_positions
         (id, company_id, vehicle_id, driver_id, latitude, longitude,
          speed, heading, recorded_at, provider, provider_vehicle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        resolvedCompanyId,
        vehicleId,
        driverId || null,
        latitude,
        longitude,
        speed ?? null,
        heading ?? null,
        new Date(),
        "webhook",
        vehicleId,
      ],
    );

    res.status(201).json({ stored: true, id });
  } catch (error) {
    log.error({ err: error }, "SERVER ERROR [POST /api/tracking/webhook]");
    res.status(500).json({ error: "Failed to store position" });
  }
});

// ---------------------------------------------------------------------------
// Provider Config API
// ---------------------------------------------------------------------------

const WRITE_ROLES = ["admin", "owner", "dispatcher"];
const ADMIN_ROLES = ["admin", "owner"];

/**
 * POST /api/tracking/providers
 * Create or update a GPS provider config for the tenant.
 * Secrets (apiToken, webhookSecret) are stored but never returned.
 */
router.post(
  "/api/tracking/providers",
  requireAuth,
  requireTenant,
  validateBody(createProviderConfigSchema),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const userRole = req.user.role;

    if (!WRITE_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }

    const {
      providerName: rawName,
      apiToken,
      webhookUrl,
      webhookSecret,
      isActive,
    } = req.body;

    const providerName = normalizeSupportedProviderName(rawName);

    if (!providerName) {
      return res.status(400).json({
        error:
          "Unsupported providerName. Supported values are Samsara and Generic Webhook.",
      });
    }

    const id = randomUUID();
    const log = createRequestLogger(req, "POST /api/tracking/providers");

    try {
      // Encrypt secrets before storage — never store plaintext credentials
      const encryptedApiToken = apiToken ? encryptSecret(apiToken) : null;
      const encryptedWebhookSecret = webhookSecret
        ? encryptSecret(webhookSecret)
        : null;

      // Upsert: insert or replace existing config for this company+provider
      await pool.query(
        `INSERT INTO tracking_provider_configs
           (id, company_id, provider_name, api_token, webhook_url, webhook_secret, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           api_token = VALUES(api_token),
           webhook_url = VALUES(webhook_url),
           webhook_secret = VALUES(webhook_secret),
           is_active = VALUES(is_active),
           updated_at = CURRENT_TIMESTAMP`,
        [
          id,
          companyId,
          providerName,
          encryptedApiToken,
          webhookUrl || null,
          encryptedWebhookSecret,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
        ],
      );

      // Fetch the record to return its canonical id and createdAt
      const [rows]: any = await pool.query(
        `SELECT id, provider_name, is_active, created_at
         FROM tracking_provider_configs
         WHERE company_id = ? AND provider_name = ?`,
        [companyId, providerName],
      );

      log.info({ companyId, providerName }, "Provider config upserted");

      res.status(201).json({
        id: rows[0].id,
        providerName: rows[0].provider_name,
        providerDisplayName: formatProviderDisplayName(rows[0].provider_name),
        isActive: Boolean(rows[0].is_active),
        createdAt: rows[0].created_at,
      });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [POST /api/tracking/providers]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * GET /api/tracking/providers
 * List all provider configs for the tenant. Never returns secrets.
 */
router.get(
  "/api/tracking/providers",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const log = createRequestLogger(req, "GET /api/tracking/providers");

    try {
      const [rows]: any = await pool.query(
        `SELECT id, provider_name, api_token, webhook_secret, webhook_url, is_active, created_at
         FROM tracking_provider_configs
         WHERE company_id = ?
         ORDER BY created_at DESC`,
        [companyId],
      );

      res.json(
        rows.map((r: any) => {
          // Mask secrets for display — decrypt first to get last 4 chars of original
          let maskedApiToken: string | null = null;
          let maskedWebhookSecret: string | null = null;

          if (r.api_token) {
            try {
              const plainToken = decryptSecret(r.api_token);
              maskedApiToken = maskSecret(plainToken);
            } catch {
              // If decryption fails (e.g., legacy plaintext), mask the raw value
              maskedApiToken = maskSecret(r.api_token);
            }
          }

          if (r.webhook_secret) {
            try {
              const plainSecret = decryptSecret(r.webhook_secret);
              maskedWebhookSecret = maskSecret(plainSecret);
            } catch {
              maskedWebhookSecret = maskSecret(r.webhook_secret);
            }
          }

          return {
            id: r.id,
            providerName: r.provider_name,
            providerDisplayName: formatProviderDisplayName(r.provider_name),
            isActive: Boolean(r.is_active),
            createdAt: r.created_at,
            hasApiToken: Boolean(r.api_token),
            hasWebhookUrl: Boolean(r.webhook_url),
            apiToken: maskedApiToken,
            webhookSecret: maskedWebhookSecret,
          };
        }),
      );
    } catch (error) {
      if (isMissingTableError(error, "tracking_provider_configs")) {
        log.warn(
          { companyId, table: "tracking_provider_configs" },
          "Provider config table missing — returning empty list for unconfigured tenant",
        );
        return res.json([]);
      }
      log.error({ err: error }, "SERVER ERROR [GET /api/tracking/providers]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * DELETE /api/tracking/providers/:id
 * Delete a provider config and its associated vehicle mappings.
 * Cascades via FK — vehicle mappings are deleted automatically.
 */
router.delete(
  "/api/tracking/providers/:id",
  requireAuth,
  requireTenant,
  validateParams(idParam),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const userRole = req.user.role;

    if (!ADMIN_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }

    const configId = req.params.id;
    const log = createRequestLogger(req, "DELETE /api/tracking/providers/:id");

    try {
      // Verify ownership before delete
      const [rows]: any = await pool.query(
        "SELECT id FROM tracking_provider_configs WHERE id = ? AND company_id = ?",
        [configId, companyId],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Provider config not found" });
      }

      await pool.query(
        "DELETE FROM tracking_provider_configs WHERE id = ? AND company_id = ?",
        [configId, companyId],
      );

      log.info({ companyId, configId }, "Provider config deleted");
      res.json({ message: "Provider config deleted" });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [DELETE /api/tracking/providers/:id]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * POST /api/tracking/providers/:id/test
 * Test the connection for a provider config using its stored credentials.
 * Returns status, message, and latency.
 */
router.post(
  "/api/tracking/providers/:id/test",
  requireAuth,
  requireTenant,
  validateParams(idParam),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const userRole = req.user.role;

    if (!WRITE_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }

    const configId = req.params.id;
    const log = createRequestLogger(
      req,
      "POST /api/tracking/providers/:id/test",
    );

    try {
      const [rows]: any = await pool.query(
        `SELECT id, provider_name, api_token, webhook_url, webhook_secret
         FROM tracking_provider_configs
         WHERE id = ? AND company_id = ?`,
        [configId, companyId],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Provider config not found" });
      }

      const config = rows[0];
      const startMs = Date.now();

      // Decrypt secrets at point of use — never hold plaintext longer than needed
      let plainApiToken: string | null = null;
      let plainWebhookSecret: string | null = null;

      if (config.api_token) {
        try {
          plainApiToken = decryptSecret(config.api_token);
        } catch {
          // Legacy plaintext value — use as-is during migration transition
          plainApiToken = config.api_token;
        }
      }

      if (config.webhook_secret) {
        try {
          plainWebhookSecret = decryptSecret(config.webhook_secret);
        } catch {
          plainWebhookSecret = config.webhook_secret;
        }
      }

      // Test Samsara provider — call the real API with stored token
      if (config.provider_name === "samsara") {
        if (!plainApiToken) {
          return res.json({
            status: "no_credentials",
            message: "No API token configured for this provider",
          });
        }

        try {
          const response = await fetch(
            "https://api.samsara.com/fleet/vehicles/locations",
            {
              headers: {
                Authorization: `Bearer ${plainApiToken}`,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(8000),
            },
          );

          const latencyMs = Date.now() - startMs;

          if (response.ok) {
            log.info(
              { companyId, configId, latencyMs },
              "Provider test succeeded",
            );
            return res.json({
              status: "success",
              message: "Connection successful",
              latencyMs,
            });
          } else {
            log.warn(
              { companyId, configId, httpStatus: response.status, latencyMs },
              "Provider test returned non-OK status",
            );
            return res.json({
              status: "failed",
              message: `Provider returned HTTP ${response.status}`,
              latencyMs,
            });
          }
        } catch (err: unknown) {
          const latencyMs = Date.now() - startMs;
          const isTimeout =
            err instanceof DOMException &&
            (err.name === "AbortError" || err.name === "TimeoutError");
          const errMessage = err instanceof Error ? err.message : String(err);

          log.warn(
            { companyId, configId, latencyMs, err: errMessage },
            "Provider test failed",
          );

          return res.json({
            status: "failed",
            message: isTimeout
              ? "Connection timed out after 8 seconds"
              : `Connection failed: ${errMessage}`,
            latencyMs,
          });
        }
      }

      // Webhook provider — validate actual connectivity to the configured webhook URL
      if (config.provider_name === "webhook") {
        if (!config.webhook_url) {
          return res.json({
            status: "no_credentials",
            message:
              "No webhook URL configured. Set a webhook URL to enable GPS data ingestion.",
            latencyMs: Date.now() - startMs,
          });
        }

        if (!plainWebhookSecret) {
          return res.json({
            status: "no_credentials",
            message:
              "No webhook secret configured. Set a secret to authenticate inbound GPS data.",
            latencyMs: Date.now() - startMs,
          });
        }

        // Perform actual HTTP POST to the webhook URL with a test payload
        try {
          const testPayload = {
            type: "connectivity_test",
            timestamp: new Date().toISOString(),
            source: "loadpilot",
          };

          const response = await fetch(config.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-GPS-API-Key": plainWebhookSecret,
            },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(8000),
          });

          const latencyMs = Date.now() - startMs;

          if (response.ok || response.status === 201) {
            log.info(
              { companyId, configId, latencyMs },
              "Webhook connectivity test succeeded",
            );
            return res.json({
              status: "success",
              message: `Webhook endpoint reachable (HTTP ${response.status})`,
              latencyMs,
            });
          } else {
            log.warn(
              { companyId, configId, httpStatus: response.status, latencyMs },
              "Webhook connectivity test returned non-OK status",
            );
            return res.json({
              status: "failed",
              message: `Webhook endpoint returned HTTP ${response.status}`,
              latencyMs,
            });
          }
        } catch (err: unknown) {
          const latencyMs = Date.now() - startMs;
          const isTimeout =
            err instanceof DOMException &&
            (err.name === "AbortError" || err.name === "TimeoutError");
          const errMessage = err instanceof Error ? err.message : String(err);

          log.warn(
            { companyId, configId, latencyMs, err: errMessage },
            "Webhook connectivity test failed",
          );

          return res.json({
            status: "failed",
            message: isTimeout
              ? "Webhook endpoint timed out after 8 seconds"
              : `Webhook endpoint unreachable: ${errMessage}`,
            latencyMs,
          });
        }
      }

      // Unsupported provider
      return res.json({
        status: "failed",
        message: `Provider "${config.provider_name}" is not yet supported`,
      });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [POST /api/tracking/providers/:id/test]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

// ---------------------------------------------------------------------------
// Vehicle Mapping API
// ---------------------------------------------------------------------------

/**
 * POST /api/tracking/vehicles/mapping
 * Map a company truck to a GPS provider vehicle ID.
 */
router.post(
  "/api/tracking/vehicles/mapping",
  requireAuth,
  requireTenant,
  validateBody(createVehicleMappingSchema),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const userRole = req.user.role;

    if (!WRITE_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }

    const { vehicleId, providerConfigId, providerVehicleId } = req.body;

    const log = createRequestLogger(req, "POST /api/tracking/vehicles/mapping");

    try {
      // Verify the provider config belongs to this tenant
      const [configRows]: any = await pool.query(
        "SELECT id FROM tracking_provider_configs WHERE id = ? AND company_id = ?",
        [providerConfigId, companyId],
      );

      if (configRows.length === 0) {
        return res
          .status(404)
          .json({ error: "Provider config not found or not accessible" });
      }

      const id = randomUUID();
      await pool.query(
        `INSERT INTO tracking_vehicle_mappings
           (id, company_id, vehicle_id, provider_config_id, provider_vehicle_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           provider_vehicle_id = VALUES(provider_vehicle_id)`,
        [id, companyId, vehicleId, providerConfigId, providerVehicleId],
      );

      // Fetch canonical row to return the actual id (may differ on UPDATE)
      const [rows]: any = await pool.query(
        `SELECT id, vehicle_id, provider_config_id, provider_vehicle_id
         FROM tracking_vehicle_mappings
         WHERE company_id = ? AND vehicle_id = ? AND provider_config_id = ?`,
        [companyId, vehicleId, providerConfigId],
      );

      log.info(
        { companyId, vehicleId, providerConfigId },
        "Vehicle mapping upserted",
      );

      res.status(201).json({
        id: rows[0].id,
        vehicleId: rows[0].vehicle_id,
        providerConfigId: rows[0].provider_config_id,
        providerVehicleId: rows[0].provider_vehicle_id,
      });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [POST /api/tracking/vehicles/mapping]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * GET /api/tracking/vehicles/mapping
 * List all vehicle mappings for the tenant, joined with provider name.
 */
router.get(
  "/api/tracking/vehicles/mapping",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const log = createRequestLogger(req, "GET /api/tracking/vehicles/mapping");

    try {
      const [rows]: any = await pool.query(
        `SELECT m.id, m.vehicle_id, m.provider_config_id,
                m.provider_vehicle_id, c.provider_name
         FROM tracking_vehicle_mappings m
         JOIN tracking_provider_configs c ON c.id = m.provider_config_id
         WHERE m.company_id = ?
         ORDER BY m.created_at DESC`,
        [companyId],
      );

      res.json(
        rows.map((r: any) => ({
          id: r.id,
          vehicleId: r.vehicle_id,
          providerConfigId: r.provider_config_id,
          providerVehicleId: r.provider_vehicle_id,
          providerName: r.provider_name,
          providerDisplayName: formatProviderDisplayName(r.provider_name),
        })),
      );
    } catch (error) {
      if (isMissingTableError(error, "tracking_vehicle_mappings")) {
        log.warn(
          { companyId, table: "tracking_vehicle_mappings" },
          "Vehicle mapping table missing — returning empty list for unconfigured tenant",
        );
        return res.json([]);
      }
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/tracking/vehicles/mapping]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

/**
 * DELETE /api/tracking/vehicles/mapping/:id
 * Delete a vehicle mapping. Verifies tenant ownership.
 */
router.delete(
  "/api/tracking/vehicles/mapping/:id",
  requireAuth,
  requireTenant,
  validateParams(idParam),
  async (req: any, res) => {
    const companyId = req.user.tenantId;
    const userRole = req.user.role;

    if (!ADMIN_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }

    const mappingId = req.params.id;
    const log = createRequestLogger(
      req,
      "DELETE /api/tracking/vehicles/mapping/:id",
    );

    try {
      const [rows]: any = await pool.query(
        "SELECT id FROM tracking_vehicle_mappings WHERE id = ? AND company_id = ?",
        [mappingId, companyId],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Vehicle mapping not found" });
      }

      await pool.query(
        "DELETE FROM tracking_vehicle_mappings WHERE id = ? AND company_id = ?",
        [mappingId, companyId],
      );

      log.info({ companyId, mappingId }, "Vehicle mapping deleted");
      res.json({ message: "Vehicle mapping deleted" });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [DELETE /api/tracking/vehicles/mapping/:id]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;

/*
-- SQL DDL for tables used by this module.
-- Executed via migrations (NOT run here directly).
-- See server/migrations/ for the migration files.

CREATE TABLE IF NOT EXISTS tracking_provider_configs (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(255) NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  api_token TEXT,
  webhook_url VARCHAR(500),
  webhook_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tpc_company (company_id),
  UNIQUE KEY uq_tpc_company_provider (company_id, provider_name)
);

CREATE TABLE IF NOT EXISTS tracking_vehicle_mappings (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(255) NOT NULL,
  vehicle_id VARCHAR(255) NOT NULL,
  provider_config_id VARCHAR(36) NOT NULL,
  provider_vehicle_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tvm_company (company_id),
  UNIQUE KEY uq_tvm_vehicle_provider (company_id, vehicle_id, provider_config_id),
  FOREIGN KEY (provider_config_id) REFERENCES tracking_provider_configs(id) ON DELETE CASCADE
);
*/
