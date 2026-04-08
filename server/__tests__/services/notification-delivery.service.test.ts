import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-W7-01a, R-W7-01b, R-W7-02a, R-W7-02b, R-W7-VPC-801

// Mock nodemailer before importing the service
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn().mockReturnValue({
  sendMail: mockSendMail,
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
  createTransport: mockCreateTransport,
}));

const { mockInfo, mockWarn, mockError, mockDebug } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: mockDebug,
    child() {
      return this;
    },
  },
  createChildLogger: () => ({
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: mockDebug,
  }),
  createRequestLogger: () => ({
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: mockDebug,
  }),
}));

const originalEnv = { ...process.env };

describe("R-W7-01: Notification Delivery Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("R-W7-01a: sendEmail() with SMTP configured sends real email", () => {
    it("sends email via nodemailer when SMTP env vars are set", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@ethereal.email";
      process.env.SMTP_PASS = "testpass";
      process.env.SMTP_FROM = "noreply@loadpilot.com";

      mockSendMail.mockResolvedValueOnce({
        messageId: "<test-message-id@ethereal.email>",
      });

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      const result = await sendEmail({
        to: "driver@example.com",
        subject: "Load Assignment",
        body: "You have been assigned load #1234",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("<test-message-id@ethereal.email>");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@loadpilot.com",
          to: "driver@example.com",
          subject: "Load Assignment",
          text: "You have been assigned load #1234",
        }),
      );
    });

    it("exports sendEmail as a named export", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";

      const mod = await import("../../services/notification-delivery.service");

      expect(typeof mod.sendEmail).toBe("function");
    });

    it("uses nodemailer createTransport with correct SMTP config", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "secret";
      process.env.SMTP_FROM = "noreply@test.com";

      mockSendMail.mockResolvedValueOnce({ messageId: "<id>" });

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      await sendEmail({
        to: "recipient@test.com",
        subject: "Test",
        body: "Test body",
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.test.com",
          port: 465,
          auth: {
            user: "user@test.com",
            pass: "secret",
          },
        }),
      );
    });
  });

  describe("R-W7-01b: sendEmail() falls back to console.log when SMTP not configured", () => {
    it("falls back to console.log when SMTP_HOST is not set", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      const result = await sendEmail({
        to: "driver@example.com",
        subject: "Load Assignment",
        body: "You have been assigned load #1234",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP not configured");
      expect(mockSendMail).not.toHaveBeenCalled();
      // Should log a warning
      expect(mockWarn).toHaveBeenCalled();
    });

    it("logs the email details when falling back", async () => {
      delete process.env.SMTP_HOST;

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        body: "Test Body",
      });

      // Should log info about the email that would have been sent
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Test Subject",
        }),
        expect.stringContaining("SMTP not configured"),
      );
    });
  });

  describe("R-W7-02a: Job status is SENT with sent_at on success", () => {
    it("returns success with messageId and sent_at timestamp", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@ethereal.email";
      process.env.SMTP_PASS = "testpass";
      process.env.SMTP_FROM = "noreply@loadpilot.com";

      mockSendMail.mockResolvedValueOnce({
        messageId: "<success-id@ethereal.email>",
      });

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      const result = await sendEmail({
        to: "admin@trucking.com",
        subject: "Certificate Expiry",
        body: "Driver certificate expires in 7 days",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.sent_at).toBeDefined();
      expect(new Date(result.sent_at!).getTime()).not.toBeNaN();
    });
  });

  describe("R-W7-02b: Job status is FAILED with sync_error on delivery failure", () => {
    it("returns failure with error message when sendMail rejects", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@ethereal.email";
      process.env.SMTP_PASS = "testpass";
      process.env.SMTP_FROM = "noreply@loadpilot.com";

      mockSendMail.mockRejectedValueOnce(new Error("Connection refused"));

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      const result = await sendEmail({
        to: "driver@example.com",
        subject: "Load Update",
        body: "Your load has been updated",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
      expect(result.sent_at).toBeUndefined();
    });

    it("logs error details on delivery failure", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@ethereal.email";
      process.env.SMTP_PASS = "testpass";
      process.env.SMTP_FROM = "noreply@loadpilot.com";

      mockSendMail.mockRejectedValueOnce(new Error("Auth failed"));

      const { sendEmail } =
        await import("../../services/notification-delivery.service");

      await sendEmail({
        to: "driver@example.com",
        subject: "Test",
        body: "Test",
      });

      expect(mockError).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.stringContaining("delivery failed"),
      );
    });
  });

  describe("R-W7-01b: deliverNotification dispatches by channel", () => {
    it("calls sendEmail for email channel jobs", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@ethereal.email";
      process.env.SMTP_PASS = "testpass";
      process.env.SMTP_FROM = "noreply@loadpilot.com";

      mockSendMail.mockResolvedValueOnce({ messageId: "<id>" });

      const { deliverNotification } =
        await import("../../services/notification-delivery.service");

      const result = await deliverNotification({
        channel: "email",
        message: "Test notification",
        recipients: [{ email: "user@example.com", name: "Test User" }],
        subject: "Notification",
      });

      expect(result.status).toBe("SENT");
      expect(result.sent_at).toBeDefined();
      expect(mockSendMail).toHaveBeenCalled();
    });

    it("returns FAILED for SMS channel when Twilio not configured", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_FROM_NUMBER;

      const { deliverNotification } =
        await import("../../services/notification-delivery.service");

      const result = await deliverNotification({
        channel: "SMS",
        message: "Test SMS",
        recipients: [{ phone: "555-1234", name: "Test" }],
      });

      expect(result.status).toBe("FAILED");
      expect(result.sync_error).toBe("Twilio not configured");
    });
  });

  describe("R-W7-02b: Integration test confirms email queued (mock transport)", () => {
    it("queues email via mock transport and confirms delivery result", async () => {
      process.env.SMTP_HOST = "smtp.ethereal.email";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@ethereal.email";
      process.env.SMTP_PASS = "testpass";
      process.env.SMTP_FROM = "noreply@loadpilot.com";

      mockSendMail.mockResolvedValueOnce({
        messageId: "<queued-id@ethereal.email>",
        accepted: ["driver@example.com"],
        rejected: [],
      });

      const { deliverNotification } =
        await import("../../services/notification-delivery.service");

      const result = await deliverNotification({
        channel: "email",
        message: "Load #5678 assigned to you",
        recipients: [{ email: "driver@example.com", name: "John Driver" }],
        subject: "Load Assignment",
      });

      expect(result.status).toBe("SENT");
      expect(result.sent_at).toBeDefined();
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "driver@example.com",
          subject: "Load Assignment",
          text: "Load #5678 assigned to you",
        }),
      );
    });
  });
});


