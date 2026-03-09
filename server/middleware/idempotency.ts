import { Request, Response, NextFunction } from "express";
import { createHash, randomUUID } from "crypto";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Idempotency key TTL: 24 hours in milliseconds.
 */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Parsed idempotency key components.
 * Format: {actor_id}:{endpoint}:{entity_id}:{nonce}
 */
export interface ParsedIdempotencyKey {
  actorId: string;
  endpoint: string;
  entityId: string;
  nonce: string;
}

/**
 * Parse an idempotency key string into its components.
 * Returns null if the key does not have exactly 4 colon-separated parts.
 */
export function parseIdempotencyKey(key: string): ParsedIdempotencyKey | null {
  if (!key) return null;
  const parts = key.split(":");
  if (parts.length < 4) return null;

  // The endpoint may contain colons (e.g., /api/loads/load-001/status),
  // so we take the first part as actorId, second as endpoint,
  // third as entityId, and the rest as nonce.
  // However, the canonical format is exactly 4 parts separated by colons.
  return {
    actorId: parts[0],
    endpoint: parts[1],
    entityId: parts[2],
    nonce: parts.slice(3).join(":"),
  };
}

/**
 * Compute a SHA-256 hash of the request body for idempotency comparison.
 * Uses JSON.stringify with sorted keys for deterministic output.
 */
export function computeRequestHash(body: unknown): string {
  const serialized = JSON.stringify(body, Object.keys(body as object).sort());
  return createHash("sha256").update(serialized).digest("hex");
}

/**
 * Row shape for the idempotency_keys table.
 */
interface IdempotencyRow extends RowDataPacket {
  id: string;
  idempotency_key: string;
  request_hash: string;
  response_status: number;
  response_body: string;
  created_at: string;
  expires_at: Date;
}

/**
 * Idempotency middleware factory.
 *
 * When applied to a route, this middleware:
 *   1. Checks for an `Idempotency-Key` header.
 *   2. If no header: passes through to the handler (no idempotency enforcement).
 *   3. If header present:
 *      a. Looks up the key in the `idempotency_keys` table.
 *      b. If found and NOT expired:
 *         - Same request_hash: replays the stored response (200 + stored body).
 *         - Different request_hash: returns 422 (hash mismatch).
 *      c. If found but expired: deletes the old record and treats as new.
 *      d. If not found: lets the handler run, then stores the response.
 *
 * Usage:
 *   router.patch('/api/loads/:id/status', idempotencyMiddleware(), handler);
 */
export function idempotencyMiddleware() {
  return async function idempotency(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    // No header — pass through
    if (!idempotencyKey) {
      next();
      return;
    }

    const requestHash = computeRequestHash(req.body);

    try {
      // Look up existing record
      const [rows] = await pool.query<IdempotencyRow[]>(
        "SELECT * FROM idempotency_keys WHERE idempotency_key = ?",
        [idempotencyKey],
      );

      if (rows.length > 0) {
        const record = rows[0];
        const now = new Date();
        const expiresAt = new Date(record.expires_at);

        // Check if expired
        if (expiresAt <= now) {
          // Expired — delete and treat as new
          await pool.execute("DELETE FROM idempotency_keys WHERE id = ?", [
            record.id,
          ]);
          // Fall through to handle as new request
        } else if (record.request_hash === requestHash) {
          // Same key + same hash: replay stored response
          const storedBody = JSON.parse(record.response_body);
          res.status(record.response_status).json(storedBody);
          return;
        } else {
          // Same key + different hash: 422
          res.status(422).json({
            error_code: "IDEMPOTENCY_HASH_MISMATCH",
            error_class: "BUSINESS_RULE",
            message:
              "Idempotency key already used with a different request body",
            correlation_id: randomUUID(),
            retryable: false,
            details: { idempotency_key: idempotencyKey },
          });
          return;
        }
      }

      // New request — intercept the response to capture it
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);

      let capturedStatus = 200;
      let capturedBody: unknown = null;

      res.status = function (code: number) {
        capturedStatus = code;
        return originalStatus(code);
      } as typeof res.status;

      res.json = function (body: unknown) {
        capturedBody = body;

        // Store the response asynchronously (fire and forget for perf)
        const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
        pool
          .execute(
            `INSERT INTO idempotency_keys (id, idempotency_key, request_hash, response_status, response_body, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE request_hash = VALUES(request_hash), response_status = VALUES(response_status), response_body = VALUES(response_body), expires_at = VALUES(expires_at)`,
            [
              randomUUID(),
              idempotencyKey,
              requestHash,
              capturedStatus,
              JSON.stringify(body),
              expiresAt,
            ],
          )
          .catch(() => {
            // Silently swallow — idempotency record storage failure
            // should not break the original request
          });

        return originalJson(body);
      } as typeof res.json;

      next();
    } catch {
      // If idempotency lookup fails, let the request through
      next();
    }
  };
}
