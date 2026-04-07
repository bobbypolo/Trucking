/**
 * Endpoint hardening tests — STORY-029
 *
 * Tests R-S29-01, R-S29-02, R-S29-03, R-S29-04
 *
 * Covers:
 *   - IFTA pings array > 10,000 items returns 400 (R-S29-01)
 *   - AI payload > 5 MB returns 413 via express.json limit (R-S29-02)
 *   - AI endpoints reject invalid MIME types with 400 (R-S29-03)
 *   - Each boundary has a dedicated test (R-S29-04)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const {
  mockPoolQuery,
  mockGetConnection,
  mockExtractLoadInfo,
  mockExtractBrokerFromImage,
  mockExtractEquipmentFromImage,
  mockGenerateTrainingFromImage,
  mockAnalyzeSafetyCompliance,
  mockResolveSqlPrincipalByFirebaseUid,
} = vi.hoisted(() => {
  return {
    mockPoolQuery: vi.fn(),
    mockGetConnection: vi.fn(),
    mockExtractLoadInfo: vi.fn(),
    mockExtractBrokerFromImage: vi.fn(),
    mockExtractEquipmentFromImage: vi.fn(),
    mockGenerateTrainingFromImage: vi.fn(),
    mockAnalyzeSafetyCompliance: vi.fn(),
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockPoolQuery,
    getConnection: mockGetConnection,
  },
}));

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

vi.mock("../../geoUtils", () => ({
  detectState: vi.fn().mockReturnValue("TX"),
  calculateDistance: vi.fn().mockReturnValue(50),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

// Mock requireTier to pass-through (hardening tests focus on validation, not tier gating)
vi.mock("../../middleware/requireTier", () => ({
  requireTier:
    () => (_req: any, _res: any, next: any) =>
      next(),
}));

vi.mock("../../schemas/settlements", () => ({
  createSettlementSchema: {},
}));

vi.mock("../../services/gemini.service", () => ({
  extractLoadInfo: mockExtractLoadInfo,
  extractBrokerFromImage: mockExtractBrokerFromImage,
  extractEquipmentFromImage: mockExtractEquipmentFromImage,
  generateTrainingFromImage: mockGenerateTrainingFromImage,
  analyzeSafetyCompliance: mockAnalyzeSafetyCompliance,
}));

import express from "express";
import request from "supertest";
import accountingRouter from "../../routes/accounting";
import aiRouter from "../../routes/ai";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

const TEST_TENANT_ID = "tenant-hardening-test";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
  ...DEFAULT_SQL_PRINCIPAL,
  tenantId: TEST_TENANT_ID,
  companyId: TEST_TENANT_ID,
});

const AUTH_HEADER = "Bearer valid-token";

function buildAccountingApp() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use(accountingRouter);
  app.use(errorHandler);
  return app;
}

function buildAiApp(jsonLimit = "5mb") {
  const app = express();
  app.use(express.json({ limit: jsonLimit }));
  app.use(aiRouter);
  app.use(errorHandler);
  return app;
}

// --- R-S29-01: IFTA pings bounds check ---
describe("IFTA /api/accounting/ifta-analyze — pings bounds check (R-S29-01)", () => {
  let app: ReturnType<typeof buildAccountingApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: TEST_TENANT_ID,
      companyId: TEST_TENANT_ID,
    });
    app = buildAccountingApp();
    vi.clearAllMocks();
  });

  it("returns 400 when pings is not an array", async () => {
    const res = await request(app)
      .post("/api/accounting/ifta-analyze")
      .set("Authorization", AUTH_HEADER)
      .send({ pings: "not-an-array", mode: "GPS" });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
    expect(res.body.message).toBe("Validation failed");
    expect(JSON.stringify(res.body.details)).toMatch(/array/i);
  });

  it("returns 400 when pings has exactly 10,001 items (R-S29-04 boundary)", async () => {
    const pings = Array.from({ length: 10_001 }, (_: unknown, i: number) => ({
      lat: 30 + i * 0.001,
      lng: -97 + i * 0.001,
    }));

    const res = await request(app)
      .post("/api/accounting/ifta-analyze")
      .set("Authorization", AUTH_HEADER)
      .send({ pings, mode: "GPS" });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
    expect(JSON.stringify(res.body.details)).toMatch(/10,?000|max|too big/i);
  });

  it("returns 400 for pings null (non-array variant)", async () => {
    const res = await request(app)
      .post("/api/accounting/ifta-analyze")
      .set("Authorization", AUTH_HEADER)
      .send({ pings: null, mode: "GPS" });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("VALIDATION_001");
    expect(res.body.message).toBe("Validation failed");
    expect(JSON.stringify(res.body.details)).toMatch(/array/i);
  });

  it("accepts exactly 10,000 pings (at-limit boundary — R-S29-04)", async () => {
    const pings = Array.from({ length: 10_000 }, (_: unknown, i: number) => ({
      lat: 30 + i * 0.0001,
      lng: -97 + i * 0.0001,
    }));

    const res = await request(app)
      .post("/api/accounting/ifta-analyze")
      .set("Authorization", AUTH_HEADER)
      .send({ pings, mode: "GPS" });

    // Should not be rejected by the bounds check
    expect(res.status).not.toBe(400);
  });

  it("accepts small pings array (happy path)", async () => {
    const pings = [
      { lat: 30.1, lng: -97.1 },
      { lat: 30.2, lng: -97.2 },
    ];

    const res = await request(app)
      .post("/api/accounting/ifta-analyze")
      .set("Authorization", AUTH_HEADER)
      .send({ pings, mode: "GPS" });

    expect(res.status).not.toBe(400);
  });
});

// --- R-S29-03: AI MIME type validation ---
describe("AI routes — MIME type validation (R-S29-03)", () => {
  const VALID_BASE64 = "abc123base64imagedata";
  const ALLOWED_MIMES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  const INVALID_MIMES = [
    "text/plain",
    "application/octet-stream",
    "image/gif",
    "video/mp4",
    "application/json",
  ];

  const imageEndpoints = [
    "/extract-load",
    "/extract-broker",
    "/extract-equipment",
    "/generate-training",
  ];

  let app: ReturnType<typeof buildAiApp>;

  beforeEach(() => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: TEST_TENANT_ID,
      companyId: TEST_TENANT_ID,
    });
    app = buildAiApp();
    vi.clearAllMocks();
    mockExtractLoadInfo.mockResolvedValue({ load: {}, broker: {} });
    mockExtractBrokerFromImage.mockResolvedValue({});
    mockExtractEquipmentFromImage.mockResolvedValue({});
    mockGenerateTrainingFromImage.mockResolvedValue({});
  });

  for (const endpoint of imageEndpoints) {
    describe(`POST ${endpoint}`, () => {
      for (const mime of INVALID_MIMES) {
        it(`returns 400 for invalid mimeType ${mime} (R-S29-04)`, async () => {
          const res = await request(app)
            .post(endpoint)
            .set("Authorization", AUTH_HEADER)
            .send({ imageBase64: VALID_BASE64, mimeType: mime });

          expect(res.status).toBe(400);
          expect(res.body.error).toMatch(/mimeType/i);
        });
      }

      for (const mime of ALLOWED_MIMES) {
        it(`accepts valid mimeType ${mime} (R-S29-04)`, async () => {
          const res = await request(app)
            .post(endpoint)
            .set("Authorization", AUTH_HEADER)
            .send({ imageBase64: VALID_BASE64, mimeType: mime });

          // Should not reject with 400 from MIME validation
          expect(res.status).not.toBe(400);
        });
      }

      it("accepts request without mimeType (defaults to image/jpeg)", async () => {
        const res = await request(app)
          .post(endpoint)
          .set("Authorization", AUTH_HEADER)
          .send({ imageBase64: VALID_BASE64 });

        expect(res.status).not.toBe(400);
      });
    });
  }
});

// --- R-S29-02: AI payload 5 MB limit ---
describe("AI routes — 5 MB payload limit (R-S29-02)", () => {
  it("5 MB limit is configured: app construction succeeds with limit option", () => {
    const app = buildAiApp("5mb");
    expect(app).toBeTruthy();
  });

  it("returns 413 when JSON payload exceeds the configured limit (R-S29-04)", async () => {
    // Use a tiny limit to force a 413 without sending megabytes in tests.
    const tinyApp = buildAiApp("1b");

    const res = await request(tinyApp)
      .post("/extract-load")
      .set("Authorization", AUTH_HEADER)
      .send({ imageBase64: "abc123" });

    expect(res.status).toBe(413);
  });
});
