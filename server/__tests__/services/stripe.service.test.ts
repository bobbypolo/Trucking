import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05

// Mock pool for DB operations
const mockQuery = vi.fn();
vi.mock("../../db", () => ({
  default: { query: mockQuery },
}));

// Mock logger
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock stripe SDK
const mockCheckoutCreate = vi.fn();
const mockBillingPortalCreate = vi.fn();
const mockWebhookConstructEvent = vi.fn();

function MockStripe() {
  return {
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: mockBillingPortalCreate,
      },
    },
    webhooks: {
      constructEvent: mockWebhookConstructEvent,
    },
  };
}

vi.mock("stripe", () => {
  return { default: MockStripe };
});

const originalEnv = { ...process.env };

describe("S-201: Stripe Payment Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Default: Stripe configured
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
    process.env.STRIPE_PRICE_RECORDS_VAULT = "price_rv_123";
    process.env.STRIPE_PRICE_AUTOMATION_PRO = "price_ap_456";
    process.env.STRIPE_PRICE_FLEET_CORE = "price_fc_789";
    process.env.STRIPE_PRICE_FLEET_COMMAND = "price_fcd_012";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-04: Missing STRIPE_SECRET_KEY returns { available: false, reason: no_api_key }
  // ───────────────────────────────────────────────────────────
  describe("R-P2-04: Missing STRIPE_SECRET_KEY graceful fallback", () => {
    it("isStripeConfigured returns false when key is missing", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { isStripeConfigured } = await import(
        "../../services/stripe.service"
      );
      expect(isStripeConfigured()).toBe(false);
    });

    it("createCheckoutSession returns { available: false, reason: no_api_key } when key is missing", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { createCheckoutSession } = await import(
        "../../services/stripe.service"
      );
      const result = await createCheckoutSession(
        "comp-1",
        "Fleet Core",
        "test@test.com",
        "https://app.example.com/success",
        "https://app.example.com/cancel",
      );
      expect(result).toEqual({ available: false, reason: "no_api_key" });
    });

    it("createBillingPortalSession returns { available: false, reason: no_api_key } when key is missing", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { createBillingPortalSession } = await import(
        "../../services/stripe.service"
      );
      const result = await createBillingPortalSession(
        "cus_fake123",
        "https://app.example.com/billing",
      );
      expect(result).toEqual({ available: false, reason: "no_api_key" });
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-01: createCheckoutSession returns valid session URL with correct price ID for each of 4 tiers
  // ───────────────────────────────────────────────────────────
  describe("R-P2-01: createCheckoutSession tier-to-price mapping", () => {
    const tierPricePairs = [
      { tier: "Records Vault", envVar: "STRIPE_PRICE_RECORDS_VAULT", priceId: "price_rv_123" },
      { tier: "Automation Pro", envVar: "STRIPE_PRICE_AUTOMATION_PRO", priceId: "price_ap_456" },
      { tier: "Fleet Core", envVar: "STRIPE_PRICE_FLEET_CORE", priceId: "price_fc_789" },
      { tier: "Fleet Command", envVar: "STRIPE_PRICE_FLEET_COMMAND", priceId: "price_fcd_012" },
    ];

    for (const { tier, priceId } of tierPricePairs) {
      it(`maps tier "${tier}" to price ID ${priceId}`, async () => {
        mockCheckoutCreate.mockResolvedValueOnce({
          id: "cs_test_session",
          url: "https://checkout.stripe.com/c/pay/cs_test_session",
        });

        const { createCheckoutSession } = await import(
          "../../services/stripe.service"
        );
        const result = await createCheckoutSession(
          "comp-1",
          tier,
          "user@example.com",
          "https://app.example.com/success",
          "https://app.example.com/cancel",
        );

        expect(result).toEqual({
          sessionId: "cs_test_session",
          url: "https://checkout.stripe.com/c/pay/cs_test_session",
        });

        expect(mockCheckoutCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            line_items: [{ price: priceId, quantity: 1 }],
            customer_email: "user@example.com",
            mode: "subscription",
            metadata: expect.objectContaining({
              companyId: "comp-1",
              tier,
            }),
          }),
        );
      });
    }

    it("returns error for unknown tier", async () => {
      const { createCheckoutSession } = await import(
        "../../services/stripe.service"
      );
      const result = await createCheckoutSession(
        "comp-1",
        "Nonexistent Tier",
        "user@example.com",
        "https://app.example.com/success",
        "https://app.example.com/cancel",
      );
      expect(result).toEqual({
        available: false,
        reason: "invalid_tier",
      });
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-01 continued: createBillingPortalSession returns URL
  // ───────────────────────────────────────────────────────────
  describe("createBillingPortalSession", () => {
    it("returns portal URL on success", async () => {
      mockBillingPortalCreate.mockResolvedValueOnce({
        url: "https://billing.stripe.com/p/session/test_portal",
      });

      const { createBillingPortalSession } = await import(
        "../../services/stripe.service"
      );
      const result = await createBillingPortalSession(
        "cus_123",
        "https://app.example.com/billing",
      );

      expect(result).toEqual({
        url: "https://billing.stripe.com/p/session/test_portal",
      });

      expect(mockBillingPortalCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: "https://app.example.com/billing",
      });
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-02: handleWebhookEvent updates companies table on checkout.session.completed,
  //          invoice.payment_failed, customer.subscription.deleted
  // ───────────────────────────────────────────────────────────
  describe("R-P2-02: handleWebhookEvent DB updates", () => {
    it("updates company on checkout.session.completed", async () => {
      const event = {
        id: "evt_completed_1",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_stripe_abc",
            subscription: "sub_stripe_xyz",
            metadata: {
              companyId: "comp-42",
              tier: "Automation Pro",
            },
          },
        },
      };

      mockWebhookConstructEvent.mockReturnValueOnce(event);
      // First query: check idempotency (no existing event)
      mockQuery.mockResolvedValueOnce([[]]); // SELECT for idempotency
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE companies
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT processed event

      const { handleWebhookEvent } = await import(
        "../../services/stripe.service"
      );
      const result = await handleWebhookEvent(
        Buffer.from("raw-body"),
        "sig_header_value",
      );

      expect(result).toEqual({ received: true });

      // Verify DB update was called with correct params
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE companies");
      expect(updateCall[0]).toContain("stripe_customer_id");
      expect(updateCall[0]).toContain("subscription_status");
      expect(updateCall[0]).toContain("subscription_tier");
      expect(updateCall[1]).toContain("cus_stripe_abc");
      expect(updateCall[1]).toContain("active");
      expect(updateCall[1]).toContain("Automation Pro");
      expect(updateCall[1]).toContain("comp-42");
    });

    it("sets subscription_status to past_due on invoice.payment_failed", async () => {
      const event = {
        id: "evt_failed_1",
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_stripe_abc",
            subscription: "sub_xyz",
          },
        },
      };

      mockWebhookConstructEvent.mockReturnValueOnce(event);
      mockQuery.mockResolvedValueOnce([[]]); // idempotency check
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT event

      const { handleWebhookEvent } = await import(
        "../../services/stripe.service"
      );
      const result = await handleWebhookEvent(
        Buffer.from("raw-body"),
        "sig_header",
      );

      expect(result).toEqual({ received: true });

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE companies");
      expect(updateCall[0]).toContain("subscription_status");
      expect(updateCall[1]).toContain("past_due");
      expect(updateCall[1]).toContain("cus_stripe_abc");
    });

    it("clears subscription_status on customer.subscription.deleted", async () => {
      const event = {
        id: "evt_deleted_1",
        type: "customer.subscription.deleted",
        data: {
          object: {
            customer: "cus_stripe_abc",
            id: "sub_xyz",
          },
        },
      };

      mockWebhookConstructEvent.mockReturnValueOnce(event);
      mockQuery.mockResolvedValueOnce([[]]); // idempotency check
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT event

      const { handleWebhookEvent } = await import(
        "../../services/stripe.service"
      );
      const result = await handleWebhookEvent(
        Buffer.from("raw-body"),
        "sig_header",
      );

      expect(result).toEqual({ received: true });

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE companies");
      expect(updateCall[1]).toContain(null); // subscription_status set to NULL
      expect(updateCall[1]).toContain("cus_stripe_abc");
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-03: Webhook is idempotent — same event.id processed twice does not duplicate DB updates
  // ───────────────────────────────────────────────────────────
  describe("R-P2-03: Webhook idempotency", () => {
    it("skips processing when event.id was already processed", async () => {
      const event = {
        id: "evt_already_processed",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_456",
            metadata: { companyId: "comp-1", tier: "Fleet Core" },
          },
        },
      };

      mockWebhookConstructEvent.mockReturnValueOnce(event);
      // Return existing row — event already processed
      mockQuery.mockResolvedValueOnce([[{ event_id: "evt_already_processed" }]]);

      const { handleWebhookEvent } = await import(
        "../../services/stripe.service"
      );
      const result = await handleWebhookEvent(
        Buffer.from("raw-body"),
        "sig_header",
      );

      expect(result).toEqual({ received: true, duplicate: true });

      // Only the idempotency check query should have been called, no UPDATE
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-05: Invalid webhook signature returns error without crash
  // ───────────────────────────────────────────────────────────
  describe("R-P2-05: Invalid webhook signature handling", () => {
    it("returns error object when signature verification fails", async () => {
      mockWebhookConstructEvent.mockImplementationOnce(() => {
        throw new Error(
          "No signatures found matching the expected signature for payload",
        );
      });

      const { handleWebhookEvent } = await import(
        "../../services/stripe.service"
      );
      const result = await handleWebhookEvent(
        Buffer.from("tampered-body"),
        "invalid_sig",
      );

      expect(result).toEqual({
        received: false,
        error: expect.stringContaining("signature"),
      });

      // No DB queries should have been made
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("does not throw — returns structured error instead", async () => {
      mockWebhookConstructEvent.mockImplementationOnce(() => {
        throw new Error("Webhook signature verification failed");
      });

      const { handleWebhookEvent } = await import(
        "../../services/stripe.service"
      );

      // Should NOT throw
      await expect(
        handleWebhookEvent(Buffer.from("bad-body"), "bad-sig"),
      ).resolves.toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Additional: Stripe SDK error handling
  // ───────────────────────────────────────────────────────────
  describe("Stripe SDK error handling", () => {
    it("createCheckoutSession handles Stripe API error gracefully", async () => {
      mockCheckoutCreate.mockRejectedValueOnce(
        new Error("Stripe API: card_declined"),
      );

      const { createCheckoutSession } = await import(
        "../../services/stripe.service"
      );
      const result = await createCheckoutSession(
        "comp-1",
        "Fleet Core",
        "user@example.com",
        "https://example.com/success",
        "https://example.com/cancel",
      );

      expect(result).toEqual({
        available: false,
        reason: "stripe_error",
        error: expect.stringContaining("card_declined"),
      });
    });
  });
});


