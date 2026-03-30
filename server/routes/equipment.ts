import { Router, type NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { redactData, getVisibilitySettings } from "../helpers";
import { validateBody } from "../middleware/validate";
import {
  createEquipmentSchema,
  patchEquipmentSchema,
} from "../schemas/equipment";
import { createRequestLogger } from "../lib/logger";
import { buildSafeUpdate } from "../lib/safe-update";
import { equipmentRepository } from "../repositories/equipment.repository";

const router = Router();

// Tenant-scoped GET /api/equipment — extracts companyId from auth token (R-P2-12)
router.get(
  "/api/equipment",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    try {
      const companyId = req.user.tenantId;
      const [rows]: any = await pool.query(
        "SELECT * FROM equipment WHERE company_id = ?",
        [companyId],
      );
      const settings = await getVisibilitySettings(companyId);
      res.json(redactData(rows, req.user.role, settings));
    } catch (err) {
      next(err);
    }
  },
);

// Equipment — single definition (duplicate from original removed per AC3)
router.get(
  "/api/equipment/:companyId",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    try {
      const [rows]: any = await pool.query(
        "SELECT * FROM equipment WHERE company_id = ?",
        [req.params.companyId],
      );
      const settings = await getVisibilitySettings(req.params.companyId);
      res.json(redactData(rows, req.user.role, settings));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/api/equipment",
  requireAuth,
  requireTenant,
  validateBody(createEquipmentSchema),
  async (req: any, res) => {
    const {
      id,
      company_id,
      unit_number,
      type,
      status,
      ownership_type,
      provider_name,
      daily_cost,
      maintenance_history,
    } = req.body;
    try {
      await pool.query(
        "INSERT INTO equipment (id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost, maintenance_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          company_id,
          unit_number,
          type,
          status,
          ownership_type,
          provider_name,
          daily_cost,
          JSON.stringify(maintenance_history),
        ],
      );
      res.status(201).json({ message: "Equipment added" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/equipment");
      log.error({ err: error }, "SERVER ERROR [POST /api/equipment]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

const PATCH_ALLOWED_ROLES = ["admin", "dispatcher", "safety_manager"] as const;
const PATCH_ALLOWED_COLUMNS = [
  "status",
  "maintenance_date",
  "mileage",
  "notes",
] as const;

// PATCH /api/equipment/:id — partial update (status, maintenance_date, mileage, notes)
router.patch(
  "/api/equipment/:id",
  requireAuth,
  requireTenant,
  validateBody(patchEquipmentSchema),
  async (req: any, res) => {
    const { id } = req.params;
    const companyId: string = req.user.tenantId;
    const userRole: string = req.user.role;

    if (
      !PATCH_ALLOWED_ROLES.includes(
        userRole as (typeof PATCH_ALLOWED_ROLES)[number],
      )
    ) {
      res.status(403).json({ error: "Forbidden: insufficient role." });
      return;
    }

    try {
      const existing = await equipmentRepository.findById(id, companyId);
      if (!existing) {
        res.status(404).json({ error: "Equipment not found." });
        return;
      }

      const update = buildSafeUpdate(req.body, PATCH_ALLOWED_COLUMNS);
      if (!update) {
        res.status(400).json({ error: "No valid fields to update." });
        return;
      }

      await pool.query(
        `UPDATE equipment SET ${update.setClause} WHERE id = ? AND company_id = ?`,
        [...update.values, id, companyId],
      );

      const updated = await equipmentRepository.findById(id, companyId);
      res.json(updated);
    } catch (error) {
      const log = createRequestLogger(req, "PATCH /api/equipment/:id");
      log.error({ err: error }, "SERVER ERROR [PATCH /api/equipment/:id]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

export default router;
