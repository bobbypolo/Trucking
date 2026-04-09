/**
 * IFTA Audit Packets routes — generate, list, retrieve, and verify
 * deterministic IFTA audit packets for a given quarter and tax year.
 *
 * Mounted under /api/accounting/ifta-audit-packets in server/index.ts.
 */
import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { NotFoundError } from "../errors/AppError";
import { createRequestLogger } from "../lib/logger";
import db from "../db";
import {
  bundleAuditPacket,
  computePacketHash,
  type AuditPacketInput,
  type JurisdictionRow,
  type FuelLedgerRow,
} from "../services/ifta-audit-packet.service";

const router = Router();

/**
 * Request schema for POST /api/accounting/ifta-audit-packets.
 *
 * The error message intentionally uses the literal field name "quarter"
 * so callers can detect which field failed validation (R-P1-05).
 */
const generatePacketSchema = z.object({
  quarter: z
    .number({ message: 'invalid "quarter" — must be a number 1..4' })
    .int('invalid "quarter" — must be an integer between 1 and 4')
    .min(1, 'invalid "quarter" — must be between 1 and 4')
    .max(4, 'invalid "quarter" — must be between 1 and 4'),
  taxYear: z
    .number({ message: '"taxYear" must be a number' })
    .int('"taxYear" must be an integer')
    .min(2000, '"taxYear" must be 2000 or later')
    .max(2100, '"taxYear" must be 2100 or earlier'),
  includeDocuments: z.boolean().optional().default(true),
});

interface PacketRow {
  id: string;
  company_id: string;
  quarter: number;
  tax_year: number;
  status: string;
  packet_hash: string;
  download_url: string;
  created_by: string;
  created_at: string | Date;
  packet_bytes?: Buffer | null;
}

function rowToApiShape(row: PacketRow) {
  return {
    packetId: row.id,
    companyId: row.company_id,
    quarter: row.quarter,
    taxYear: row.tax_year,
    status: row.status,
    packetHash: row.packet_hash,
    downloadUrl: row.download_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ── POST /api/accounting/ifta-audit-packets ──────────────────────────
router.post(
  "/api/accounting/ifta-audit-packets",
  requireAuth,
  requireTenant,
  validateBody(generatePacketSchema),
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const log = createRequestLogger(
      req,
      "POST /api/accounting/ifta-audit-packets",
    );
    try {
      const { quarter, taxYear } = req.body as {
        quarter: number;
        taxYear: number;
        includeDocuments: boolean;
      };
      const companyId = req.user!.companyId;

      // Look up company name for the cover letter.
      const [companyRows] = (await db.query(
        "SELECT name FROM companies WHERE id = ? LIMIT 1",
        [companyId],
      )) as [Array<{ name?: string }>, unknown];
      const companyName = companyRows?.[0]?.name ?? companyId;

      // Pull jurisdiction rows for the quarter (mileage_jurisdiction).
      const [mileageRows] = (await db.query(
        "SELECT state_code, total_miles, total_gallons FROM mileage_jurisdiction WHERE company_id = ? AND tax_year = ? AND quarter = ?",
        [companyId, taxYear, quarter],
      )) as [
        Array<{
          state_code: string;
          total_miles: number;
          total_gallons: number;
        }>,
        unknown,
      ];
      const jurisdictionRows: JurisdictionRow[] = (mileageRows || []).map(
        (r) => ({
          stateCode: r.state_code,
          totalMiles: Number(r.total_miles) || 0,
          totalGallons: Number(r.total_gallons) || 0,
          taxRate: 0.2,
          taxDue: (Number(r.total_gallons) || 0) * 0.2,
        }),
      );

      // Pull fuel ledger rows for the quarter.
      const [fuelRows] = (await db.query(
        "SELECT vendor_name, transaction_date, state_code, gallons, price_per_gallon, total_cost FROM fuel_ledger WHERE company_id = ? AND tax_year = ? AND quarter = ?",
        [companyId, taxYear, quarter],
      )) as [
        Array<{
          vendor_name: string;
          transaction_date: string;
          state_code: string;
          gallons: number;
          price_per_gallon: number;
          total_cost: number;
        }>,
        unknown,
      ];
      const fuelLedgerRows: FuelLedgerRow[] = (fuelRows || []).map((r) => ({
        vendorName: r.vendor_name,
        transactionDate: String(r.transaction_date),
        stateCode: r.state_code,
        gallons: Number(r.gallons) || 0,
        pricePerGallon: Number(r.price_per_gallon) || 0,
        totalCost: Number(r.total_cost) || 0,
      }));

      const packetInput: AuditPacketInput = {
        companyId,
        companyName,
        quarter,
        taxYear,
        jurisdictionRows,
        fuelLedgerRows,
        // Use a deterministic timestamp seed based on the quarter/year so
        // re-running the same generation produces identical packet bytes.
        generatedAt: new Date(`${taxYear}-12-31T00:00:00.000Z`).toISOString(),
      };

      const packetBytes = await bundleAuditPacket(packetInput);
      const packetHash = computePacketHash(packetBytes);
      const packetId = randomUUID();
      const downloadUrl = `/api/accounting/ifta-audit-packets/${packetId}/download`;

      await db.query(
        `INSERT INTO ifta_audit_packets
         (id, company_id, quarter, tax_year, status, packet_hash, download_url, created_by, packet_bytes)
         VALUES (?, ?, ?, ?, 'generated', ?, ?, ?, ?)`,
        [
          packetId,
          companyId,
          quarter,
          taxYear,
          packetHash,
          downloadUrl,
          req.user!.id,
          packetBytes,
        ],
      );

      res.status(201).json({
        packetId,
        companyId,
        quarter,
        taxYear,
        status: "generated",
        packetHash,
        downloadUrl,
      });
    } catch (error) {
      log.error({ err: error }, "ifta-audit-packets generate failed");
      next(error);
    }
  },
);

// ── GET /api/accounting/ifta-audit-packets ───────────────────────────
router.get(
  "/api/accounting/ifta-audit-packets",
  requireAuth,
  requireTenant,
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const log = createRequestLogger(
      req,
      "GET /api/accounting/ifta-audit-packets",
    );
    try {
      const companyId = req.user!.companyId;
      const [rows] = (await db.query(
        `SELECT id, company_id, quarter, tax_year, status, packet_hash, download_url, created_by, created_at
         FROM ifta_audit_packets
         WHERE company_id = ?
         ORDER BY created_at DESC`,
        [companyId],
      )) as [PacketRow[], unknown];
      res.status(200).json({ packets: (rows || []).map(rowToApiShape) });
    } catch (error) {
      log.error({ err: error }, "ifta-audit-packets list failed");
      next(error);
    }
  },
);

// ── GET /api/accounting/ifta-audit-packets/:packetId ─────────────────
router.get(
  "/api/accounting/ifta-audit-packets/:packetId",
  requireAuth,
  requireTenant,
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const log = createRequestLogger(
      req,
      "GET /api/accounting/ifta-audit-packets/:packetId",
    );
    try {
      const companyId = req.user!.companyId;
      const [rows] = (await db.query(
        `SELECT id, company_id, quarter, tax_year, status, packet_hash, download_url, created_by, created_at
         FROM ifta_audit_packets
         WHERE id = ? AND company_id = ?
         LIMIT 1`,
        [req.params.packetId, companyId],
      )) as [PacketRow[], unknown];

      if (!rows || rows.length === 0) {
        throw new NotFoundError(
          `IFTA audit packet ${req.params.packetId} not found`,
        );
      }
      res.status(200).json(rowToApiShape(rows[0]));
    } catch (error) {
      log.error({ err: error }, "ifta-audit-packets get failed");
      next(error);
    }
  },
);

// ── POST /api/accounting/ifta-audit-packets/:packetId/verify ─────────
router.post(
  "/api/accounting/ifta-audit-packets/:packetId/verify",
  requireAuth,
  requireTenant,
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const log = createRequestLogger(
      req,
      "POST /api/accounting/ifta-audit-packets/:packetId/verify",
    );
    try {
      const companyId = req.user!.companyId;
      const [rows] = (await db.query(
        `SELECT id, company_id, packet_hash, packet_bytes
         FROM ifta_audit_packets
         WHERE id = ? AND company_id = ?
         LIMIT 1`,
        [req.params.packetId, companyId],
      )) as [PacketRow[], unknown];

      if (!rows || rows.length === 0) {
        throw new NotFoundError(
          `IFTA audit packet ${req.params.packetId} not found`,
        );
      }

      const row = rows[0];
      const storedBytes = row.packet_bytes;
      if (!storedBytes) {
        throw new NotFoundError(
          `IFTA audit packet ${req.params.packetId} has no stored bytes`,
        );
      }

      const computed = computePacketHash(Buffer.from(storedBytes));
      if (computed !== row.packet_hash) {
        // Fail-closed on hash mismatch (Hard Rule 5).
        res.status(409).json({
          error: "HASH_MISMATCH",
          packetId: row.id,
          expectedHash: row.packet_hash,
          actualHash: computed,
        });
        return;
      }

      res.status(200).json({
        verified: true,
        packetId: row.id,
        packetHash: row.packet_hash,
      });
    } catch (error) {
      log.error({ err: error }, "ifta-audit-packets verify failed");
      next(error);
    }
  },
);

export default router;
