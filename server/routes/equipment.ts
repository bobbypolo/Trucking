import { Router, Response, type NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import pool from "../db";
import { redactData, getVisibilitySettings } from "../helpers";
import { validateBody } from "../middleware/validate";
import {
  createEquipmentSchema,
  patchEquipmentSchema,
} from "../schemas/equipment";

import { buildSafeUpdate } from "../lib/safe-update";
import { equipmentRepository } from "../repositories/equipment.repository";

const router = Router();

// Tenant-scoped GET /api/equipment — extracts companyId from auth token (R-P2-12)
router.get(
  "/api/equipment",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user!.tenantId;
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM equipment WHERE company_id = ?",
        [companyId],
      );
      const settings = await getVisibilitySettings(companyId);
      res.json(redactData(rows, req.user!.role, settings));
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM equipment WHERE company_id = ?",
        [req.params.companyId],
      );
      const settings = await getVisibilitySettings(req.params.companyId);
      res.json(redactData(rows, req.user!.role, settings));
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    } catch (err) {
      next(err);
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const companyId: string = req.user!.tenantId;
    const userRole: string = req.user!.role;

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
    } catch (err) {
      next(err);
    }
  },
);

export default router;
