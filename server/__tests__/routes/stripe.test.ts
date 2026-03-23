import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04

/**
 * Stripe Route Tests — S-301
 *
 * Verifies:
 *   - R-P3-01: POST /api/stripe/create-checkout-session returns 200 with sessionId and url when Stripe configured
 *   - R-P3-02: POST /api/stripe/create-checkout-session returns 401 without auth token
 *   - R-P3-03: POST /api/stripe/webhook returns 200 on valid event, 400 on invalid signature
 *   - R-P3-04: Webhook endpoint accessible without auth token (public)
 */

// --- Stripe service mock ---
const {
  mockIsStripeConfigured,
  mockCreateCheckoutSession,
  mockCreateBillingPortalSession,
  mockHandleWebhookEvent,
  mockQuery,
} = vi.hoisted(() => {
  return {
    mockIsStripeConfigured: vi.fn(),
    mockCreateCheckoutSession: vi.fn(),
    mockCreateBillingPortalSession: vi.fn(),
    mockHandleWebhookEvent: vi.fn(),
    mockQuery: vi.fn(),
  };
});

vi.mock("../../services/stripe.service", () => ({
  isStripeConfigured: mockIsStripeConfigured,
  createCheckoutSession: mockCreateCheckoutSession,
  createBillingPortalSession: mockCreateBillingPortalSession,
  handleWebhookEvent: mockHandleWebhookEvent,
}));

// --- requireAuth mock ---
const { mockRequireAuth } = vi.hoisted(() => {
  const mockRequireAuth = vi.fn();
  return { mockRequireAuth };
});

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: mockRequireAuth,
  AuthenticatedRequest: {},
}));

// --- requireTenant mock ---
const { mockRequireTenant } = vi.hoisted(() => {
  const mockRequireTenant = vi.fn();
  return { mockRequireTenant };
});

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: mockRequireTenant,
}));

// --- DB pool mock ---
vi.mock("../../db", () => ({
  default: { query: mockQuery },
}));

// --- Logger mock ---
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import stripeRouter from "../../routes/stripe";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  // Register webhook route BEFORE json parser (just like production)
  // The stripe router handles this internally with express.raw()
  app.use(stripeRouter);
  app.use(express.json());
  app.use(errorHandler);
  return app;
}

function setupAuthPass() {
  mockRequireAuth.mockImplementation((req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      uid: "user-1",
      tenantId: "tenant-1",
      companyId: "company-1",
      role: "admin",
      email: "test@example.com",
      firebaseUid: "fb-uid-1",
    };
    next();
  });
  mockRequireTenant.mockImplementation((_req: any, _res: any, next: any) =>
    next(),
  );
}

function setupAuthFail() {
  mockRequireAuth.mockImplementation((_req: any, res: any, _next: any) => {
    res
      .status(401)
      .json({ error: "Authentication required. Bearer token missing." });
  });
}

describe("Stripe Routes — S-301", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P3-01: POST /api/stripe/create-checkout-session returns 200 with sessionId and url when Stripe configured
  describe("POST /api/stripe/create-checkout-session", () => {
    it("R-P3-01: returns 200 with sessionId and url when Stripe configured", async () => {
      setupAuthPass();
      mockIsStripeConfigured.mockReturnValue(true);
      mockCreateCheckoutSession.mockResolvedValue({
        sessionId: "cs_test_abc123",
        url: "https://checkout.stripe.com/pay/cs_test_abc123",
      });

      const res = await request(buildApp())
        .post("/api/stripe/create-checkout-session")
        .send({
          tier: "Automation Pro",
          email: "test@example.com",
          successUrl: "https://app.example.com/success",
          cancelUrl: "https://app.example.com/cancel",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("sessionId", "cs_test_abc123");
      expect(res.body).toHaveProperty("url");
      expect(res.body.url).toContain("stripe.com");
    });

    it("returns 503 when Stripe is not configured", async () => {
      setupAuthPass();
      mockIsStripeConfigured.mockReturnValue(false);

      const res = await request(buildApp())
        .post("/api/stripe/create-checkout-session")
        .send({
          tier: "Automation Pro",
          email: "test@example.com",
        });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error", "Stripe not configured");
    });

    // R-P3-02: POST /api/stripe/create-checkout-session returns 401 without auth token
    it("R-P3-02: returns 401 without auth token", async () => {
      setupAuthFail();

      const res = await request(buildApp())
        .post("/api/stripe/create-checkout-session")
        .send({
          tier: "Automation Pro",
          email: "test@example.com",
        });

      expect(res.status).toBe(401);
    });

    it("returns 400 when Stripe returns invalid_tier error", async () => {
      setupAuthPass();
      mockIsStripeConfigured.mockReturnValue(true);
      mockCreateCheckoutSession.mockResolvedValue({
        available: false,
        reason: "invalid_tier",
      });

      const res = await request(buildApp())
        .post("/api/stripe/create-checkout-session")
        .send({
          tier: "Invalid Tier",
          email: "test@example.com",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("POST /api/stripe/create-billing-portal", () => {
    it("returns 200 with url when Stripe configured", async () => {
      setupAuthPass();
      mockIsStripeConfigured.mockReturnValue(true);
      // Mock DB lookup for stripe_customer_id from the authenticated user's company
      mockQuery.mockResolvedValue([[{ stripe_customer_id: "cus_abc123" }]]);
      mockCreateBillingPortalSession.mockResolvedValue({
        url: "https://billing.stripe.com/session/portal_abc",
      });

      const res = await request(buildApp())
        .post("/api/stripe/create-billing-portal")
        .send({
          returnUrl: "https://app.example.com/settings",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("url");
      expect(res.body.url).toContain("stripe.com");
    });

    it("returns 401 without auth token", async () => {
      setupAuthFail();

      const res = await request(buildApp())
        .post("/api/stripe/create-billing-portal")
        .send({
          stripeCustomerId: "cus_abc123",
          returnUrl: "https://app.example.com/settings",
        });

      expect(res.status).toBe(401);
    });

    it("returns 503 when Stripe is not configured", async () => {
      setupAuthPass();
      mockIsStripeConfigured.mockReturnValue(false);

      const res = await request(buildApp())
        .post("/api/stripe/create-billing-portal")
        .send({
          stripeCustomerId: "cus_abc123",
          returnUrl: "https://app.example.com/settings",
        });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("error", "Stripe not configured");
    });
  });

  describe("POST /api/stripe/webhook", () => {
    // R-P3-03: returns 200 on valid event, 400 on invalid signature
    it("R-P3-03: returns 200 on valid webhook event", async () => {
      mockHandleWebhookEvent.mockResolvedValue({ received: true });

      const res = await request(buildApp())
        .post("/api/stripe/webhook")
        .set("stripe-signature", "t=123,v1=abc")
        .set("content-type", "application/json")
        .send(JSON.stringify({ type: "checkout.session.completed" }));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("received", true);
    });

    it("R-P3-03: returns 400 on invalid signature", async () => {
      mockHandleWebhookEvent.mockResolvedValue({
        received: false,
        error:
          "No signatures found matching the expected signature for payload",
      });

      const res = await request(buildApp())
        .post("/api/stripe/webhook")
        .set("stripe-signature", "invalid-sig")
        .set("content-type", "application/json")
        .send(JSON.stringify({ type: "checkout.session.completed" }));

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    // R-P3-04: Webhook endpoint accessible without auth token (public)
    it("R-P3-04: webhook accessible without auth token", async () => {
      mockHandleWebhookEvent.mockResolvedValue({ received: true });

      // No Authorization header — should still process
      const res = await request(buildApp())
        .post("/api/stripe/webhook")
        .set("stripe-signature", "t=123,v1=abc")
        .set("content-type", "application/json")
        .send(JSON.stringify({ type: "invoice.payment_failed" }));

      expect(res.status).toBe(200);
      // Verify requireAuth was NOT called for webhook route
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });

    it("returns 400 when stripe-signature header is missing", async () => {
      const res = await request(buildApp())
        .post("/api/stripe/webhook")
        .set("content-type", "application/json")
        .send(JSON.stringify({ type: "checkout.session.completed" }));

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });
});
