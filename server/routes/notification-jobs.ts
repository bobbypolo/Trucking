import { Router } from "express";
import type { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";
import { deliverNotification } from "../services/notification-delivery.service";

const router = Router();

// GET /api/notification-jobs — list notification jobs for tenant
router.get(
  "/api/notification-jobs",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const log = createRequestLogger(req, "GET /api/notification-jobs");
    try {
      const [rows]: any = await pool.query(
        "SELECT * FROM notification_jobs WHERE company_id = ? ORDER BY sent_at DESC",
        [companyId],
      );
      const jobs = (rows as any[]).map((row) => ({
        ...row,
        recipients:
          typeof row.recipients === "string"
            ? JSON.parse(row.recipients)
            : row.recipients,
      }));
      res.json(jobs);
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/notification-jobs]");
      res.status(500).json({ error: "Failed to fetch notification jobs" });
    }
  },
);

// GET /api/notification-jobs/:id — get single notification job (tenant-scoped)
router.get(
  "/api/notification-jobs/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const jobId = req.params.id;
    const log = createRequestLogger(req, "GET /api/notification-jobs/:id");
    try {
      const [rows]: any = await pool.query(
        "SELECT * FROM notification_jobs WHERE id = ?",
        [jobId],
      );
      const row = (rows as any[])[0];
      if (!row || row.company_id !== companyId) {
        return res.status(404).json({ error: "Notification job not found" });
      }
      const job = {
        ...row,
        recipients:
          typeof row.recipients === "string"
            ? JSON.parse(row.recipients)
            : row.recipients,
      };
      res.json(job);
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/notification-jobs/:id]",
      );
      res.status(500).json({ error: "Failed to fetch notification job" });
    }
  },
);

// POST /api/notification-jobs — create notification job
router.post(
  "/api/notification-jobs",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const log = createRequestLogger(req, "POST /api/notification-jobs");
    const {
      id: providedId,
      loadId,
      incidentId,
      message,
      channel,
      status,
      sentBy,
      sentAt,
      recipients,
      sync_error,
    } = req.body;

    // Validate required fields
    if (!message || !channel) {
      return res
        .status(400)
        .json({ error: "message and channel are required" });
    }

    const id = providedId || uuidv4();
    const jobStatus = status || "PENDING";
    const jobSentBy = sentBy || req.user!.uid;
    const jobSentAt = sentAt || new Date().toISOString();
    const jobRecipients = recipients || [];

    try {
      await pool.query(
        `INSERT INTO notification_jobs
           (id, company_id, load_id, incident_id, message, channel, status,
            sent_by, sent_at, recipients, sync_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          companyId,
          loadId || null,
          incidentId || null,
          message,
          channel,
          jobStatus,
          jobSentBy,
          jobSentAt,
          JSON.stringify(jobRecipients),
          sync_error ? 1 : 0,
        ],
      );
      log.info({ jobId: id }, "Notification job created");

      // Attempt delivery via notification-delivery service
      const deliveryResult = await deliverNotification({
        channel,
        message,
        recipients: jobRecipients,
        subject: "LoadPilot Notification",
      });

      // Update job status based on delivery result
      const finalStatus = deliveryResult.status;
      const finalSentAt = deliveryResult.sent_at || jobSentAt;
      const finalSyncError = deliveryResult.sync_error || null;

      await pool.query(
        `UPDATE notification_jobs
           SET status = ?, sent_at = ?, sync_error = ?
         WHERE id = ?`,
        [finalStatus, finalSentAt, finalSyncError ? 1 : 0, id],
      );

      res.status(201).json({
        id,
        company_id: companyId,
        load_id: loadId || null,
        incident_id: incidentId || null,
        message,
        channel,
        status: finalStatus,
        sent_by: jobSentBy,
        sent_at: finalSentAt,
        recipients: jobRecipients,
        sync_error: finalSyncError || false,
      });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [POST /api/notification-jobs]");
      res.status(500).json({ error: "Failed to create notification job" });
    }
  },
);

// PATCH /api/notification-jobs/:id — update job status
router.patch(
  "/api/notification-jobs/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res) => {
    const companyId = req.user!.tenantId;
    const jobId = req.params.id;
    const log = createRequestLogger(req, "PATCH /api/notification-jobs/:id");

    const { status, sync_error } = req.body;

    if (!status || !["SENT", "FAILED", "PENDING"].includes(status)) {
      return res
        .status(400)
        .json({ error: "status must be SENT, FAILED, or PENDING" });
    }

    try {
      const [rows]: any = await pool.query(
        "SELECT * FROM notification_jobs WHERE id = ?",
        [jobId],
      );
      const row = (rows as any[])[0];
      if (!row || row.company_id !== companyId) {
        return res.status(404).json({ error: "Notification job not found" });
      }

      const sentAt =
        status === "SENT" ? new Date().toISOString() : row.sent_at;

      await pool.query(
        `UPDATE notification_jobs
           SET status = ?, sent_at = ?, sync_error = ?
         WHERE id = ?`,
        [status, sentAt, sync_error ? 1 : 0, jobId],
      );

      res.json({
        ...row,
        status,
        sent_at: sentAt,
        sync_error: sync_error || false,
        recipients:
          typeof row.recipients === "string"
            ? JSON.parse(row.recipients)
            : row.recipients,
      });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [PATCH /api/notification-jobs/:id]",
      );
      res.status(500).json({ error: "Failed to update notification job" });
    }
  },
);

export default router;
