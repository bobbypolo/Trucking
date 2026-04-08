import { Router, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createContractSchema } from "../schemas/contract";
import pool from "../db";
import { createRequestLogger } from "../lib/logger";

const router = Router();

// Contracts
router.get(
  "/api/contracts/:customerId",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [rows] = await pool.query(
        "SELECT cc.* FROM customer_contracts cc INNER JOIN customers c ON cc.customer_id = c.id WHERE cc.customer_id = ? AND c.company_id = ?",
        [req.params.customerId, req.user!.tenantId],
      );
      res.json(rows);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/contracts");
      log.error({ err: error }, "SERVER ERROR [GET /api/contracts]");
      next(error);
    }
  },
);

router.post(
  "/api/contracts",
  requireAuth,
  requireTenant,
  validateBody(createContractSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const {
      id,
      customer_id,
      contract_name,
      terms,
      start_date,
      expiry_date,
      equipment_preferences,
      status,
    } = req.body;
    try {
      // Verify the customer belongs to the authenticated user's tenant before inserting
      const [customer] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM customers WHERE id = ? AND company_id = ?",
        [customer_id, req.user!.tenantId],
      );
      if (!customer || customer.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }
      await pool.query(
        "REPLACE INTO customer_contracts (id, customer_id, contract_name, terms, start_date, expiry_date, equipment_preferences, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          customer_id,
          contract_name,
          terms,
          start_date,
          expiry_date,
          JSON.stringify(equipment_preferences),
          status,
        ],
      );
      res.status(201).json({ message: "Contract saved" });
    } catch (error) {
      const log = createRequestLogger(req, "POST /api/contracts");
      log.error({ err: error }, "SERVER ERROR [POST /api/contracts]");
      next(error);
    }
  },
);

export default router;
