import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P2-06, R-P2-07, R-P2-08, R-P2-09

// Mock nodemailer (needed since the module imports it at top-level)
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

// Mock Twilio client
const mockTwilioCreate = vi.fn();
vi.mock("twilio", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockTwilioCreate,
    },
  })),
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

const originalEnv = { ...process.env };

describe("R-P2-06: SMS channel sends via Twilio when configured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("sends SMS via Twilio and returns SENT with message SID", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "token123";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";

    mockTwilioCreate.mockResolvedValueOnce({
      sid: "SM1234567890abcdef",
      status: "queued",
    });

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Your load #1234 is ready for pickup",
      recipients: [{ phone: "+15559876543", name: "John Driver" }],
    });

    expect(result.status).toBe("SENT");
    expect(result.sent_at).toBeDefined();
    expect(mockTwilioCreate).toHaveBeenCalledWith({
      body: "Your load #1234 is ready for pickup",
      from: "+15551234567",
      to: "+15559876543",
    });
  });

  it("sends SMS to multiple recipients and returns SENT if any succeed", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "token123";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";

    mockTwilioCreate
      .mockResolvedValueOnce({ sid: "SM_first", status: "queued" })
      .mockResolvedValueOnce({ sid: "SM_second", status: "queued" });

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Fleet alert",
      recipients: [
        { phone: "+15559876543", name: "Driver A" },
        { phone: "+15551112222", name: "Driver B" },
      ],
    });

    expect(result.status).toBe("SENT");
    expect(mockTwilioCreate).toHaveBeenCalledTimes(2);
  });

  it("returns FAILED when Twilio API errors", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "token123";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";

    mockTwilioCreate.mockRejectedValueOnce(
      new Error("The 'To' number is not a valid phone number"),
    );

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Test",
      recipients: [{ phone: "+15559876543", name: "Driver" }],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toContain("not a valid phone number");
  });
});

describe("R-P2-07: Missing Twilio config returns FAILED with sync_error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns FAILED with 'Twilio not configured' when env vars missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Test SMS",
      recipients: [{ phone: "+15559876543", name: "Test" }],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toBe("Twilio not configured");
  });

  it("returns FAILED when only TWILIO_ACCOUNT_SID is set (incomplete config)", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Test SMS",
      recipients: [{ phone: "+15559876543", name: "Test" }],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toBe("Twilio not configured");
  });
});

describe("R-P2-08: Recipients without phone numbers are skipped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("skips recipients without phone numbers (no error)", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "token123";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";

    mockTwilioCreate.mockResolvedValueOnce({
      sid: "SM_only_one",
      status: "queued",
    });

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Alert",
      recipients: [
        { email: "only-email@example.com", name: "No Phone" },
        { phone: "+15559876543", name: "Has Phone" },
      ],
    });

    expect(result.status).toBe("SENT");
    // Only one SMS sent (recipient with phone)
    expect(mockTwilioCreate).toHaveBeenCalledTimes(1);
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+15559876543" }),
    );
  });

  it("returns FAILED when all recipients lack phone numbers", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "token123";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "sms",
      message: "Alert",
      recipients: [
        { email: "a@example.com", name: "No Phone 1" },
        { email: "b@example.com", name: "No Phone 2" },
      ],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toContain("No recipients with phone numbers");
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });
});

describe("R-P2-09: Existing email delivery tests still pass (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("email channel still works after Twilio integration", async () => {
    process.env.SMTP_HOST = "smtp.ethereal.email";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@ethereal.email";
    process.env.SMTP_PASS = "testpass";
    process.env.SMTP_FROM = "noreply@loadpilot.com";

    mockSendMail.mockResolvedValueOnce({
      messageId: "<regression-test-id@ethereal.email>",
    });

    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "email",
      message: "Regression test email",
      recipients: [{ email: "user@example.com", name: "Test User" }],
      subject: "Regression Test",
    });

    expect(result.status).toBe("SENT");
    expect(result.sent_at).toBeDefined();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Regression Test",
        text: "Regression test email",
      }),
    );
  });

  it("sendEmail still returns proper shape on SMTP not configured", async () => {
    delete process.env.SMTP_HOST;

    const { sendEmail } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("SMTP not configured");
  });

  it("unsupported channel still returns proper FAILED response", async () => {
    const { deliverNotification } = await import(
      "../../services/notification-delivery.service"
    );

    const result = await deliverNotification({
      channel: "carrier-pigeon",
      message: "Test",
      recipients: [{ email: "test@example.com" }],
    });

    expect(result.status).toBe("FAILED");
    expect(result.sync_error).toContain("not supported");
  });
});


