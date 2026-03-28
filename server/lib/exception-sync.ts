import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { createChildLogger } from "./logger";

/**
 * Maps a domain-record status to the corresponding exception status.
 * Domain "Resolved"/"Closed"/"Completed" -> exception "RESOLVED".
 */
function mapDomainStatusToException(domainStatus: string): string | null {
  const normalized = domainStatus.toLowerCase();
  if (
    normalized === "resolved" ||
    normalized === "closed" ||
    normalized === "completed"
  ) {
    return "RESOLVED";
  }
  return null;
}

/**
 * Reverse sync: when a domain record changes status, find and update
 * the linked exception in the canonical queue.
 *
 * @param linkField - The JSON key in the exception's `links` column (e.g. "incidentId")
 * @param linkValue - The ID of the domain record
 * @param tenantId - Tenant ID for isolation
 * @param newDomainStatus - The new status of the domain record
 * @param correlationId - Optional correlation ID for logging
 */
export async function syncDomainToException(
  linkField: string,
  linkValue: string,
  tenantId: string,
  newDomainStatus: string,
  correlationId?: string,
): Promise<void> {
  const log = createChildLogger({
    correlationId: correlationId ?? "unknown",
    route: "syncDomainToException",
  });

  const exceptionStatus = mapDomainStatusToException(newDomainStatus);
  if (!exceptionStatus) {
    // Only sync terminal statuses to avoid circular updates
    return;
  }

  try {
    // Find exceptions linked to this domain record via JSON_EXTRACT
    const [rows]: any = await pool.query(
      `SELECT id, status FROM exceptions
       WHERE tenant_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(links, ?)) = ?
         AND status NOT IN ('RESOLVED', 'CLOSED')
       LIMIT 1`,
      [tenantId, `$.${linkField}`, linkValue],
    );

    if (rows.length === 0) {
      return;
    }

    const exception = rows[0];

    await pool.query(
      "UPDATE exceptions SET status = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?",
      [exceptionStatus, exception.id, tenantId],
    );

    // Log the sync event
    await pool.query(
      `INSERT INTO exception_events (id, exception_id, action, notes, actor_name)
       VALUES (?, ?, 'Status Synced', ?, 'System')`,
      [
        uuidv4(),
        exception.id,
        `Auto-synced from domain record ${linkField}=${linkValue} status=${newDomainStatus}`,
      ],
    );

    log.info(
      { exceptionId: exception.id, linkField, linkValue, exceptionStatus },
      "Synced domain status to exception",
    );
  } catch (err) {
    log.warn(
      { err, linkField, linkValue },
      "syncDomainToException failed (non-blocking)",
    );
  }
}
