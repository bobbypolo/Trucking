import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createAgreementSchema,
  signAgreementSchema,
} from "../schemas/agreement";
import { agreementRepository } from "../repositories/agreement.repository";

const router = Router();

// POST /api/agreements — create DRAFT agreement from rate confirmation
// R-P9-02: returns 201 { id, status: "DRAFT" }
// R-P9-07: validateBody rejects missing load_id with 400
router.post(
  "/api/agreements",
  requireAuth,
  requireTenant,
  validateBody(createAgreementSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    try {
      const agreement = await agreementRepository.create(
        {
          load_id: req.body.load_id,
          rate_con_data: req.body.rate_con_data,
        },
        companyId,
      );
      res.status(201).json(agreement);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/agreements/:id — read agreement
// R-P9-03: returns 200 with full record, or 404
router.get(
  "/api/agreements/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    try {
      const agreement = await agreementRepository.findById(req.params.id);
      if (!agreement || agreement.company_id !== companyId) {
        res.status(404).json({ error: "Agreement not found" });
        return;
      }
      res.json(agreement);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/agreements/:id/sign — transition DRAFT → SIGNED
// R-P9-04: returns 200 after updating status and storing signature_data
// R-P9-05: returns 409 when status is already SIGNED
// R-P9-08: validateBody rejects missing signature_data with 400
router.patch(
  "/api/agreements/:id/sign",
  requireAuth,
  requireTenant,
  validateBody(signAgreementSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    try {
      const existing = await agreementRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Agreement not found" });
        return;
      }
      if (existing.status === "SIGNED") {
        res.status(409).json({ error: "Agreement already signed" });
        return;
      }
      const updated = await agreementRepository.sign(
        req.params.id,
        req.body.signature_data,
        companyId,
      );
      if (!updated) {
        // Race: another request signed (or voided) the agreement between
        // our findById pre-check and our atomic UPDATE. The SQL guard
        // refused the transition, so report the same 409 as the fast path.
        res.status(409).json({ error: "Agreement already signed" });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
