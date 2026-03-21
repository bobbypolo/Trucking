/**
 * Notification Delivery Service for LoadPilot
 *
 * Implements email delivery using nodemailer, replacing console.log stubs.
 * Falls back gracefully when SMTP is not configured.
 *
 * Environment Variables:
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.ethereal.email)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - SMTP_FROM: Default sender address
 *
 * @see .claude/docs/PLAN.md H-801
 */

import nodemailer from "nodemailer";
import { createChildLogger } from "../lib/logger";

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
 * Deliver a notification by dispatching to the appropriate channel handler.
 *
 * - email: sends via nodemailer (or falls back to console.log)
 * - SMS: returns FAILED with "SMS not yet implemented"
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
    const firstError =
      results[0]?.error || "All email deliveries failed";
    return {
      status: "FAILED",
      sync_error: firstError,
    };
  }

  if (channel === "sms") {
    log.warn({ channel: "SMS" }, "SMS channel not yet implemented");
    return {
      status: "FAILED",
      sync_error: "SMS not yet implemented",
    };
  }

  return {
    status: "FAILED",
    sync_error: `Channel "${options.channel}" not supported`,
  };
}
