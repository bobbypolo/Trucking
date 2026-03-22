/**
 * stripe.ts — Stripe payment routes for LoadPilot SaaS billing.
 *
 * Routes:
 * - POST /api/stripe/create-checkout-session  (requireAuth, requireTenant)
 * - POST /api/stripe/create-billing-portal    (requireAuth, requireTenant)
 * - POST /api/stripe/webhook                  (NO auth, express.raw() body)
 *
 * CRITICAL: The webhook route uses express.raw() for raw body access
 * (needed for Stripe signature verification). It must be registered
 * BEFORE express.json() in the middleware stack.
 *
 * @see .claude/docs/PLAN.md S-301
 */

import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import {
  isStripeConfigured,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
} from "../services/stripe.service";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ route: "stripe" });
const router = Router();

// ─── Webhook (NO auth, raw body) ─────────────────────────────────
// This route MUST be registered before express.json() middleware
// so that the raw body is available for Stripe signature verification.

router.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, _next: NextFunction) => {
    const signature = req.headers["stripe-signature"] as string | undefined;

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    try {
      const result = await handleWebhookEvent(req.body, signature);

      if (result.received) {
        res.status(200).json({ received: true });
      } else {
        log.warn({ error: result.error }, "Webhook event rejected");
        res.status(400).json({ error: result.error });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "Webhook handler threw unexpected error");
      res.status(500).json({ error: "Internal webhook processing error" });
    }
  },
);

// ─── Checkout Session (requireAuth + requireTenant) ──────────────

router.post(
  "/api/stripe/create-checkout-session",
  requireAuth as any,
  requireTenant as any,
  express.json(),
  async (req: Request, res: Response, _next: NextFunction) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const { tier, email, successUrl, cancelUrl } = req.body;

    const result = await createCheckoutSession(
      authReq.user.companyId,
      tier || "",
      email || authReq.user.email,
      successUrl || `${req.protocol}://${req.get("host")}/billing/success`,
      cancelUrl || `${req.protocol}://${req.get("host")}/billing/cancel`,
    );

    if ("sessionId" in result) {
      res.status(200).json({
        sessionId: result.sessionId,
        url: result.url,
      });
    } else {
      const statusCode = result.reason === "invalid_tier" ? 400 : 502;
      res.status(statusCode).json({
        error: result.reason === "invalid_tier"
          ? `Invalid subscription tier: ${tier}`
          : result.error || "Stripe error",
      });
    }
  },
);

// ─── Billing Portal (requireAuth + requireTenant) ────────────────

router.post(
  "/api/stripe/create-billing-portal",
  requireAuth as any,
  requireTenant as any,
  express.json(),
  async (req: Request, res: Response, _next: NextFunction) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }

    const { stripeCustomerId, returnUrl } = req.body;

    if (!stripeCustomerId) {
      res.status(400).json({ error: "stripeCustomerId is required" });
      return;
    }

    const result = await createBillingPortalSession(
      stripeCustomerId,
      returnUrl || `${req.protocol}://${req.get("host")}/settings`,
    );

    if ("url" in result && !("available" in result)) {
      res.status(200).json({ url: result.url });
    } else {
      res.status(502).json({
        error: ("error" in result ? result.error : null) || "Stripe billing portal error",
      });
    }
  },
);

export default router;
