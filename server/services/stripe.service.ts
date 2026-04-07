/**
 * stripe.service.ts — Stripe payment service for LoadPilot SaaS billing.
 *
 * Provides:
 * - isStripeConfigured() — check if Stripe key is present
 * - createCheckoutSession() — start a new subscription checkout
 * - createBillingPortalSession() — redirect to Stripe billing portal
 * - handleWebhookEvent() — process Stripe webhook events with idempotency
 *
 * Graceful degradation: all functions return structured error objects
 * instead of throwing when STRIPE_SECRET_KEY is missing.
 *
 * @see .claude/docs/PLAN.md S-201
 */

import Stripe from "stripe";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ service: "stripe" });

// ─── Tier-to-Price mapping ────────────────────────────────────────

type SubscriptionTier =
  | "Records Vault"
  | "Automation Pro"
  | "Fleet Core"
  | "Fleet Command";

function getTierPriceId(tier: string): string | null {
  const mapping: Record<string, string | undefined> = {
    "Records Vault": process.env.STRIPE_PRICE_RECORDS_VAULT,
    "Automation Pro": process.env.STRIPE_PRICE_AUTOMATION_PRO,
    "Fleet Core": process.env.STRIPE_PRICE_FLEET_CORE,
    "Fleet Command": process.env.STRIPE_PRICE_FLEET_COMMAND,
  };
  return mapping[tier] ?? null;
}

// ─── Stripe client ────────────────────────────────────────────────

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Check whether Stripe is configured (secret key present).
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Result types for checkout/portal session creation.
 */
export type CheckoutSessionResult =
  | { sessionId: string; url: string }
  | {
      available: false;
      reason: "no_api_key" | "invalid_tier" | "stripe_error";
      error?: string;
    };

export type BillingPortalResult =
  | { url: string }
  | { available: false; reason: "no_api_key" | "stripe_error"; error?: string };

export type WebhookResult =
  | { received: true; duplicate?: boolean }
  | { received: false; error: string };

/**
 * Create a Stripe Checkout session for a subscription.
 *
 * @param companyId  - Internal company ID (stored in session metadata)
 * @param tier       - Subscription tier name (one of the 4 valid tiers)
 * @param email      - Customer email for pre-filling checkout
 * @param successUrl - Redirect URL after successful payment
 * @param cancelUrl  - Redirect URL if customer cancels
 */
export async function createCheckoutSession(
  companyId: string,
  tier: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    log.warn("createCheckoutSession called without STRIPE_SECRET_KEY");
    return { available: false, reason: "no_api_key" };
  }

  const priceId = getTierPriceId(tier);
  if (!priceId) {
    log.warn({ tier }, "Invalid subscription tier requested");
    return { available: false, reason: "invalid_tier" };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyId,
        tier,
      },
    });

    log.info(
      { sessionId: session.id, companyId, tier },
      "Checkout session created",
    );

    if (!session.url) {
      log.error(
        { sessionId: session.id },
        "Stripe returned session without URL",
      );
      return {
        available: false,
        reason: "stripe_error",
        error: "No checkout URL returned",
      };
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { err: message, companyId, tier },
      "Stripe checkout session creation failed",
    );
    return { available: false, reason: "stripe_error", error: message };
  }
}

/**
 * Create a Stripe Billing Portal session so a customer can manage
 * their subscription (upgrade, cancel, update payment method).
 *
 * @param stripeCustomerId - The Stripe customer ID (cus_xxx)
 * @param returnUrl        - URL to redirect back to after portal
 */
export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<BillingPortalResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    log.warn("createBillingPortalSession called without STRIPE_SECRET_KEY");
    return { available: false, reason: "no_api_key" };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    log.info({ stripeCustomerId }, "Billing portal session created");
    return { url: session.url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { err: message },
      "Stripe billing portal session creation failed",
    );
    return { available: false, reason: "stripe_error", error: message };
  }
}

/**
 * Handle an incoming Stripe webhook event.
 *
 * Verifies the signature, checks for idempotency (duplicate event ID),
 * then dispatches to the appropriate handler based on event type.
 *
 * Supported events:
 * - checkout.session.completed → updates company with Stripe IDs, sets active
 * - invoice.payment_failed → sets subscription_status to past_due
 * - customer.subscription.deleted → clears subscription_status
 *
 * @param rawBody   - The raw request body (Buffer) for signature verification
 * @param signature - The Stripe-Signature header value
 */
export async function handleWebhookEvent(
  rawBody: Buffer,
  signature: string,
): Promise<WebhookResult> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { received: false, error: "Stripe not configured" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { received: false, error: "Webhook secret not configured" };
  }

  // 1. Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    ) as Stripe.Event;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "Webhook signature verification failed");
    return { received: false, error: message };
  }

  // 2. Idempotency check — skip if event.id already processed
  const [existingRows] = await pool.query<RowDataPacket[]>(
    "SELECT event_id FROM stripe_webhook_events WHERE event_id = ?",
    [event.id],
  );
  if (existingRows.length > 0) {
    log.info({ eventId: event.id }, "Duplicate webhook event skipped");
    return { received: true, duplicate: true };
  }

  // 3. Dispatch by event type
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;
        const tier = session.metadata?.tier;

        if (!companyId) {
          log.warn(
            { eventId: event.id },
            "checkout.session.completed missing companyId metadata",
          );
          break;
        }

        await pool.query(
          `UPDATE companies
           SET stripe_customer_id = ?,
               stripe_subscription_id = ?,
               subscription_status = ?,
               subscription_tier = ?,
               subscription_period_end = NULL
           WHERE id = ?`,
          [
            session.customer as string,
            session.subscription as string,
            "active",
            tier || null,
            companyId,
          ],
        );

        log.info(
          { eventId: event.id, companyId, tier },
          "Company subscription activated via checkout",
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await pool.query(
          `UPDATE companies
           SET subscription_status = ?
           WHERE stripe_customer_id = ?`,
          ["past_due", customerId],
        );

        log.warn(
          { eventId: event.id, customerId },
          "Invoice payment failed — subscription set to past_due",
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await pool.query(
          `UPDATE companies
           SET subscription_status = ?,
               stripe_subscription_id = NULL,
               subscription_period_end = NULL
           WHERE stripe_customer_id = ?`,
          [null, customerId],
        );

        log.info(
          { eventId: event.id, customerId },
          "Subscription deleted — status cleared",
        );
        break;
      }

      default:
        log.info(
          { eventId: event.id, type: event.type },
          "Unhandled webhook event type",
        );
    }

    // 4. Record processed event for idempotency
    await pool.query(
      "INSERT INTO stripe_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, NOW())",
      [event.id, event.type],
    );

    return { received: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { err: message, eventId: event.id },
      "Webhook event processing failed",
    );
    return { received: false, error: message };
  }
}
