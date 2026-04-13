import { Router, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import type { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createDriverExceptionSchema } from "../schemas/driver-exceptions";
import pool from "../db";
import { messageRepository } from "../repositories/message.repository";
import { deliverNotification } from "../services/notification-delivery.service";
import { NotFoundError } from "../errors/AppError";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ service: "driver-exceptions" });
const router = Router();

/**
 * POST /api/driver/exceptions
 *
 * Creates a driver-reported exception linked to a load.
 * - Validates issue_type against allowed enum
 * - Inserts into exceptions table with tenant_id, status OPEN, entity_type LOAD
 * - Creates exception_events with action 'Driver Reported'
 * - Auto-creates escalation message in load's message thread
 * - Triggers push notification to assigned dispatcher
 */
router.post(
  "/api/driver/exceptions",
  requireAuth,
  requireTenant,
  validateBody(createDriverExceptionSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { issue_type, load_id, description, photo_urls, location } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    try {
      // Verify load exists and belongs to tenant
      const [loadRows] = await pool.query<RowDataPacket[]>(
        "SELECT id, dispatcher_id FROM loads WHERE id = ? AND company_id = ?",
        [load_id, tenantId],
      );

      if (loadRows.length === 0) {
        return next(new NotFoundError("Load not found"));
      }

      const load = loadRows[0];
      const exceptionId = uuidv4();

      // Insert exception
      await pool.query(
        "INSERT INTO exceptions (id, tenant_id, type, status, severity, entity_type, entity_id, owner_user_id, description, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          exceptionId,
          tenantId,
          issue_type,
          "OPEN",
          2,
          "LOAD",
          load_id,
          userId,
          description,
          JSON.stringify({
            photo_urls: photo_urls || [],
            location: location || null,
          }),
        ],
      );

      // Create exception event
      await pool.query(
        "INSERT INTO exception_events (id, exception_id, action, notes, actor_name) VALUES (?, ?, ?, ?, ?)",
        [uuidv4(), exceptionId, "Driver Reported", description, userId],
      );

      // Auto-create escalation message in load thread
      try {
        const escalationText = `[Exception] Driver reported: ${issue_type} - ${description}`;
        await messageRepository.create(
          {
            load_id,
            sender_id: userId,
            sender_name: "Driver (Auto)",
            text: escalationText,
          },
          tenantId,
        );
      } catch (err) {
        log.warn(
          { err, exceptionId, load_id },
          "Failed to create escalation message",
        );
      }

      // Trigger push notification to dispatcher
      if (load.dispatcher_id) {
        try {
          await deliverNotification({
            channel: "push",
            message: `Driver reported ${issue_type} on load ${load_id}: ${description}`,
            subject: "Driver Exception Reported",
            recipients: [{ id: load.dispatcher_id }],
          });
        } catch (err) {
          log.warn(
            { err, issue_type, load_id },
            "Failed to deliver exception push notification",
          );
        }
      }

      res.status(201).json({ id: exceptionId });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/driver/exceptions
 *
 * Returns exceptions created by the authenticated user,
 * optionally filtered by loadId query parameter.
 */
router.get(
  "/api/driver/exceptions",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const loadId = req.query.loadId as string | undefined;

    try {
      let query =
        "SELECT * FROM exceptions WHERE tenant_id = ? AND owner_user_id = ?";
      const params: string[] = [tenantId, userId];

      if (loadId) {
        query += " AND entity_id = ?";
        params.push(loadId);
      }

      query += " ORDER BY created_at DESC";

      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      res.json({ exceptions: rows });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
