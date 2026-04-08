import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import {
  LoadStatus,
  validateTransition,
  validateDispatchGuards,
} from "./load-state-machine";
import { ConflictError, NotFoundError } from "../errors/AppError";

/**
 * Load Service — orchestrates load operations including state transitions.
 *
 * All state transitions are atomic: status update, dispatch_event creation,
 * and version increment happen within a single transaction.
 * Optimistic locking via version column prevents concurrent modification.
 */
export const loadService = {
  /**
   * Transition a load to a new status.
   *
   * Steps:
   *   1. Fetch load (tenant-scoped) and stops
   *   2. Validate the transition (BusinessRuleError if invalid)
   *   3. Run dispatch guards if transitioning to 'dispatched'
   *   4. In a transaction:
   *      a. UPDATE status + increment version (WHERE version = old_version)
   *      b. INSERT dispatch_event audit record
   *   5. If UPDATE affected 0 rows, throw ConflictError (stale version)
   *
   * @param loadId - The load to transition
   * @param targetStatus - The desired new status
   * @param companyId - Tenant ID for isolation
   * @param userId - The user performing the transition (audit trail)
   * @returns The updated load data
   */
  async transitionLoad(
    loadId: string,
    targetStatus: LoadStatus,
    companyId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    // 1. Fetch load with tenant scoping
    const [loadRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM loads WHERE id = ? AND company_id = ?",
      [loadId, companyId],
    );

    if (loadRows.length === 0) {
      throw new NotFoundError(
        `Load '${loadId}' not found for tenant '${companyId}'`,
        { loadId, companyId },
      );
    }

    const load = loadRows[0];
    const currentStatus = load.status as LoadStatus;
    const currentVersion = load.version as number;

    // Fetch stops for guard validation
    const [stopRows] = await pool.query<RowDataPacket[]>(
      `SELECT ll.* FROM load_legs ll
            INNER JOIN loads l ON ll.load_id = l.id
            WHERE ll.load_id = ? AND l.company_id = ?
            ORDER BY ll.sequence_order ASC`,
      [loadId, companyId],
    );

    // 2. Validate the transition (throws BusinessRuleError if invalid)
    validateTransition(currentStatus, targetStatus);

    // 3. Run dispatch guards if transitioning to 'dispatched'
    if (targetStatus === LoadStatus.DISPATCHED) {
      // For dispatch, we need to validate prerequisites
      // The load must have driver_id and we need to check tenant isolation
      let driverCompanyId: string | null = null;
      let equipmentCompanyId: string | null = null;

      if (load.driver_id) {
        const [driverRows] = await pool.query<RowDataPacket[]>(
          "SELECT company_id FROM users WHERE id = ?",
          [load.driver_id],
        );
        driverCompanyId =
          driverRows.length > 0 ? driverRows[0].company_id : null;
      }

      // Equipment check: prefer persisted equipment_id, fall back to legacy
      // chassis_number/container_number for loads that pre-date migration 049.
      const equipmentId =
        load.equipment_id ||
        load.chassis_number ||
        load.container_number ||
        null;
      if (equipmentId) {
        // Look up equipment by identifier — search across ALL tenants to detect
        // cross-tenant references (not scoped to companyId)
        const [equipRows] = await pool.query<RowDataPacket[]>(
          "SELECT company_id FROM equipment WHERE unit_number = ? OR id = ?",
          [equipmentId, equipmentId],
        );
        // If equipment exists in the DB, use its actual company_id for tenant check.
        // If not found (unregistered equipment), leave null so the guard skips
        // the tenant check rather than silently assuming same-tenant.
        equipmentCompanyId =
          equipRows.length > 0 ? equipRows[0].company_id : null;
      }

      validateDispatchGuards({
        loadId,
        companyId,
        driverId: load.driver_id || null,
        equipmentId: equipmentId,
        stops: stopRows.map((s: RowDataPacket) => ({
          type: s.type as string,
          completed: s.completed as boolean,
        })),
        driverCompanyId,
        equipmentCompanyId,
      });
    }

    // 4. Execute transition atomically in a transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const newVersion = currentVersion + 1;

      // 4a. UPDATE status + version with optimistic lock
      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE loads
                SET status = ?, version = ?
                WHERE id = ? AND company_id = ? AND version = ?`,
        [targetStatus, newVersion, loadId, companyId, currentVersion],
      );

      if (updateResult.affectedRows === 0) {
        throw new ConflictError(
          `Load '${loadId}' was modified by another process (version conflict)`,
          { loadId, expectedVersion: currentVersion, currentStatus },
        );
      }

      // 4b. INSERT dispatch_event audit record with formal audit columns
      const eventId = uuidv4();
      const correlationId = uuidv4();
      const payload = JSON.stringify({
        version: newVersion,
      });

      await connection.execute(
        `INSERT INTO dispatch_events
          (id, load_id, dispatcher_id, actor_id, event_type, prior_state, next_state, correlation_id, message, payload)
         VALUES (?, ?, ?, ?, 'StatusChange', ?, ?, ?, ?, ?)`,
        [
          eventId,
          loadId,
          userId,
          userId,
          currentStatus,
          targetStatus,
          correlationId,
          `Status changed from ${currentStatus} to ${targetStatus}`,
          payload,
        ],
      );

      await connection.commit();

      return {
        id: loadId,
        status: targetStatus,
        version: newVersion,
        previous_status: currentStatus,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};
