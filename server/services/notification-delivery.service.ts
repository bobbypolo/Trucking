/**
 * Notification Delivery Service for LoadPilot
 *
 * Implements email delivery using nodemailer and SMS delivery using Twilio.
 * Falls back gracefully when SMTP or Twilio is not configured.
 *
 * Environment Variables:
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.ethereal.email)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - SMTP_FROM: Default sender address
 * - TWILIO_ACCOUNT_SID: Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Twilio Auth Token
 * - TWILIO_FROM_NUMBER: Twilio sender phone number (E.164 format)
 *
 * @see .claude/docs/PLAN.md H-801, S-202
 */

import nodemailer from "nodemailer";
import Twilio from "twilio";
import { createChildLogger } from "../lib/logger";
import { sendPush } from "../lib/expo-push";
import pool from "../db";

const log = createChildLogger({ service: "notification-delivery" });

/** Input for sendEmail */
export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

/** Result from sendEmail */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  sent_at?: string;
  error?: string;
}

/** Recipient shape from notification jobs */
export interface NotificationRecipient {
  email?: string;
  phone?: string;
  name?: string;
  id?: string;
  role?: string;
}

/** Input for deliverNotification */
export interface DeliverNotificationOptions {
  channel: string;
  message: string;
  recipients: NotificationRecipient[];
  subject?: string;
}

/** Result from deliverNotification */
export interface DeliverNotificationResult {
  status: "SENT" | "FAILED";
  sent_at?: string;
  sync_error?: string;
}

/**
 * Check whether SMTP is configured via environment variables.
 */
function isSmtpConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

/**
 * Create a nodemailer transport from environment variables.
 */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

/**
 * Send an email via nodemailer.
 *
 * When SMTP is not configured, logs the email details and returns
 * a failure result with error "SMTP not configured" (graceful fallback).
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  if (!isSmtpConfigured()) {
    log.warn(
      { to: options.to, subject: options.subject },
      "SMTP not configured — email not sent",
    );
    return { success: false, error: "SMTP not configured" };
  }

  const transport = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "";

  try {
    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.body,
      ...(options.html ? { html: options.html } : {}),
    });

    const sent_at = new Date().toISOString();
    log.info(
      { messageId: info.messageId, to: options.to },
      "Email sent successfully",
    );

    return {
      success: true,
      messageId: info.messageId,
      sent_at,
    };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown delivery error";
    log.error(
      { err, to: options.to, subject: options.subject },
      "Email delivery failed",
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Check whether Twilio is configured via environment variables.
 * All three variables are required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
 */
function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

/**
 * Create a Twilio client from environment variables.
 */
function createTwilioClient() {
  return Twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
  );
}

/**
 * Deliver an SMS notification via Twilio.
 *
 * - Filters recipients to those with phone numbers (skips others)
 * - Returns FAILED with "Twilio not configured" if env vars are missing
 * - Returns FAILED with "No recipients with phone numbers" if none have phones
 * - Returns SENT if at least one message was sent successfully
 * - Handles Twilio API errors gracefully (logs, returns FAILED, doesn't throw)
 */
async function deliverSms(
  options: DeliverNotificationOptions,
): Promise<DeliverNotificationResult> {
  if (!isTwilioConfigured()) {
    log.warn({ channel: "SMS" }, "Twilio not configured — SMS not sent");
    return {
      status: "FAILED",
      sync_error: "Twilio not configured",
    };
  }

  // Filter to recipients with phone numbers; skip those without
  const smsRecipients = options.recipients.filter((r) => r.phone);

  if (smsRecipients.length === 0) {
    log.warn(
      { channel: "SMS", recipientCount: options.recipients.length },
      "No recipients with phone numbers — SMS skipped",
    );
    return {
      status: "FAILED",
      sync_error: "No recipients with phone numbers",
    };
  }

  const client = createTwilioClient();
  const fromNumber = process.env.TWILIO_FROM_NUMBER!;
  let anySent = false;
  let lastError: string | undefined;

  for (const recipient of smsRecipients) {
    try {
      const message = await client.messages.create({
        body: options.message,
        from: fromNumber,
        to: recipient.phone!,
      });

      log.info(
        { sid: message.sid, to: recipient.phone, name: recipient.name },
        "SMS sent successfully",
      );
      anySent = true;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown SMS delivery error";
      log.error(
        { err, to: recipient.phone, name: recipient.name },
        "SMS delivery failed",
      );
      lastError = errorMessage;
    }
  }

  if (anySent) {
    return {
      status: "SENT",
      sent_at: new Date().toISOString(),
    };
  }

  return {
    status: "FAILED",
    sync_error: lastError || "All SMS deliveries failed",
  };
}

/**
 * Deliver a push notification via Expo Push API.
 *
 * Queries push_tokens for recipient user IDs where enabled=1,
 * then delegates to sendPush() with the collected tokens.
 *
 * - Returns FAILED with "No push tokens found" when no enabled tokens exist
 * - Returns SENT when sendPush() sends to at least one token
 *
 * # Tests R-P1-01, R-P1-02
 */
async function deliverPush(
  options: DeliverNotificationOptions,
): Promise<DeliverNotificationResult> {
  const recipientIds = options.recipients
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (recipientIds.length === 0) {
    return {
      status: "FAILED",
      sync_error: "No push tokens found",
    };
  }

  const placeholders = recipientIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT expo_push_token FROM push_tokens WHERE user_id IN (${placeholders}) AND enabled = 1`,
    recipientIds,
  );

  const tokens = (rows as Array<{ expo_push_token: string }>).map(
    (r) => r.expo_push_token,
  );

  if (tokens.length === 0) {
    return {
      status: "FAILED",
      sync_error: "No push tokens found",
    };
  }

  const result = await sendPush(
    tokens,
    options.subject || "LoadPilot Notification",
    options.message,
    {},
  );

  if (result.sent > 0) {
    return {
      status: "SENT",
      sent_at: new Date().toISOString(),
    };
  }

  return {
    status: "FAILED",
    sync_error: result.errors?.[0]?.reason || "All push deliveries failed",
  };
}

/**
 * Deliver a notification by dispatching to the appropriate channel handler.
 *
 * - email: sends via nodemailer (falls back gracefully when SMTP not configured)
 * - sms: sends via Twilio (falls back gracefully when Twilio not configured)
 * - push: sends via Expo Push API (queries push_tokens for recipient tokens)
 * - Other channels: returns FAILED with "Channel not supported"
 */
export async function deliverNotification(
  options: DeliverNotificationOptions,
): Promise<DeliverNotificationResult> {
  const channel = options.channel.toLowerCase();

  if (channel === "email") {
    // Send to each recipient that has an email address
    const emailRecipients = options.recipients.filter((r) => r.email);

    if (emailRecipients.length === 0) {
      return {
        status: "FAILED",
        sync_error: "No recipients with email addresses",
      };
    }

    // Send to all recipients (for now, sequentially)
    const results: SendEmailResult[] = [];
    for (const recipient of emailRecipients) {
      const result = await sendEmail({
        to: recipient.email!,
        subject: options.subject || "LoadPilot Notification",
        body: options.message,
      });
      results.push(result);
    }

    // If any succeeded, mark as SENT
    const anySuccess = results.some((r) => r.success);
    if (anySuccess) {
      return {
        status: "SENT",
        sent_at: new Date().toISOString(),
      };
    }

    // All failed
    const firstError = results[0]?.error || "All email deliveries failed";
    return {
      status: "FAILED",
      sync_error: firstError,
    };
  }

  if (channel === "sms") {
    return deliverSms(options);
  }

  if (channel === "push") {
    return deliverPush(options);
  }

  return {
    status: "FAILED",
    sync_error: `Channel "${options.channel}" not supported`,
  };
}
