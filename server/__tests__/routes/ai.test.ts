/**
 * AI proxy route tests.
 *
 * Tests R-P0-01, R-P1-01, R-P1-02, R-P1-03, R-P1-04
 *
 * Covers:
 *   - All 5 AI endpoints require authentication (401 without token)
 *   - Input validation rejects bad payloads (400)
 *   - Successful requests return expected response shapes
 *   - Gemini SDK errors are sanitized to 500 (no API key leak)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (must be declared before any vi.mock calls) ---
const {
  mockExtractLoadInfo,
  mockExtractBrokerFromImage,
  mockExtractEquipmentFromImage,
  mockGenerateTrainingFromImage,
  mockAnalyzeSafetyCompliance,
} = vi.hoisted(() => {
  return {
    mockExtractLoadInfo: vi.fn(),
    mockExtractBrokerFromImage: vi.fn(),
    mockExtractEquipmentFromImage: vi.fn(),
    mockGenerateTrainingFromImage: vi.fn(),
    mockAnalyzeSafetyCompliance: vi.fn(),
  };
});

vi.mock("../../services/gemini.service", () => ({
  extractLoadInfo: mockExtractLoadInfo,
  extractBrokerFromImage: mockExtractBrokerFromImage,
  extractEquipmentFromImage: mockExtractEquipmentFromImage,
  generateTrainingFromImage: mockGenerateTrainingFromImage,
  analyzeSafetyCompliance: mockAnalyzeSafetyCompliance,
}));

vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock firebase-admin for requireAuth middleware
vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "dispatcher",
                  email: "test@test.com",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => mockFirestore,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: vi.fn().mockResolvedValue({
    id: "1",
    tenantId: "company-aaa",
    companyId: "company-aaa",
    role: "admin",
    email: "test@test.com",
    firebaseUid: "firebase-uid-1",
  }),
}));

import express from "express";
import request from "supertest";
import aiRouter from "../../routes/ai";
import { errorHandler } from "../../middleware/errorHandler";

// Build a minimal Express app with the AI router
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(aiRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-firebase-token";
const VALID_IMAGE_BODY = {
  imageBase64: "abc123base64data",
  mimeType: "image/jpeg",
};

describe("AI proxy routes — authentication", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  const endpoints = [
    "/api/ai/extract-load",
    "/api/ai/extract-broker",
    "/api/ai/extract-equipment",
    "/api/ai/generate-training",
    "/api/ai/analyze-safety",
  ];

  for (const endpoint of endpoints) {
    it(`${endpoint} returns 401 without Authorization header`, async () => {
      const res = await request(app).post(endpoint).send(VALID_IMAGE_BODY);
      expect(res.status).toBe(401);
    });
  }
});

describe("POST /api/ai/extract-load", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const res = await request(app)
      .post("/api/ai/extract-load")
      .set("Authorization", AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/imageBase64/);
  });

  it("returns 400 when imageBase64 is empty string", async () => {
    const res = await request(app)
      .post("/api/ai/extract-load")
      .set("Authorization", AUTH_HEADER)
      .send({ imageBase64: "" });
    expect(res.status).toBe(400);
  });

  it("returns 200 with loadInfo on success", async () => {
    const mockResult = {
      load: {
        loadNumber: "LD-001",
        carrierRate: 1500,
        pickup: { city: "Dallas", state: "TX" },
        dropoff: { city: "Houston", state: "TX" },
      },
      broker: { name: "ACME Brokers" },
    };
    mockExtractLoadInfo.mockResolvedValueOnce(mockResult);

    const res = await request(app)
      .post("/api/ai/extract-load")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("loadInfo");
    expect(res.body.loadInfo).toEqual(mockResult);
    expect(mockExtractLoadInfo).toHaveBeenCalledWith(
      "abc123base64data",
      "image/jpeg",
    );
  });

  it("returns 500 when Gemini service throws", async () => {
    mockExtractLoadInfo.mockRejectedValueOnce(
      new Error("GEMINI_API_KEY not set"),
    );

    const res = await request(app)
      .post("/api/ai/extract-load")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(500);
    // Must NOT leak API key info
    expect(JSON.stringify(res.body)).not.toMatch(/GEMINI_API_KEY/);
    expect(res.body.error).toBe("AI extraction failed");
  });
});

describe("POST /api/ai/extract-broker", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const res = await request(app)
      .post("/api/ai/extract-broker")
      .set("Authorization", AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 200 with brokerInfo on success", async () => {
    const mockBroker = { name: "ACME Brokers", mcNumber: "MC123456" };
    mockExtractBrokerFromImage.mockResolvedValueOnce(mockBroker);

    const res = await request(app)
      .post("/api/ai/extract-broker")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("brokerInfo");
    expect(res.body.brokerInfo).toEqual(mockBroker);
  });

  it("returns 500 when Gemini service throws", async () => {
    mockExtractBrokerFromImage.mockRejectedValueOnce(
      new Error("network error"),
    );

    const res = await request(app)
      .post("/api/ai/extract-broker")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("AI extraction failed");
  });
});

describe("POST /api/ai/extract-equipment", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const res = await request(app)
      .post("/api/ai/extract-equipment")
      .set("Authorization", AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 200 with equipmentInfo on success", async () => {
    const mockEquipment = { id: "TRUCK-001", type: "Truck" };
    mockExtractEquipmentFromImage.mockResolvedValueOnce(mockEquipment);

    const res = await request(app)
      .post("/api/ai/extract-equipment")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("equipmentInfo");
    expect(res.body.equipmentInfo).toEqual(mockEquipment);
  });

  it("returns 500 when Gemini service throws", async () => {
    mockExtractEquipmentFromImage.mockRejectedValueOnce(new Error("timeout"));

    const res = await request(app)
      .post("/api/ai/extract-equipment")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("AI extraction failed");
  });
});

describe("POST /api/ai/generate-training", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const res = await request(app)
      .post("/api/ai/generate-training")
      .set("Authorization", AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 200 with training on success", async () => {
    const mockTraining = {
      id: "quiz-abc",
      title: "Safety Basics",
      description: "A quiz about safety",
      questions: [],
      assignedTo: ["all"],
      createdAt: "2026-03-08T00:00:00.000Z",
    };
    mockGenerateTrainingFromImage.mockResolvedValueOnce(mockTraining);

    const res = await request(app)
      .post("/api/ai/generate-training")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("training");
    expect(res.body.training).toEqual(mockTraining);
  });

  it("returns 500 when Gemini service throws", async () => {
    mockGenerateTrainingFromImage.mockRejectedValueOnce(
      new Error("quota exceeded"),
    );

    const res = await request(app)
      .post("/api/ai/generate-training")
      .set("Authorization", AUTH_HEADER)
      .send(VALID_IMAGE_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("AI generation failed");
  });
});

describe("POST /api/ai/analyze-safety", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when data field is missing", async () => {
    const res = await request(app)
      .post("/api/ai/analyze-safety")
      .set("Authorization", AUTH_HEADER)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/data/);
  });

  it("returns 400 when data is not an object", async () => {
    const res = await request(app)
      .post("/api/ai/analyze-safety")
      .set("Authorization", AUTH_HEADER)
      .send({ data: "not-an-object" });
    expect(res.status).toBe(400);
  });

  it("returns 200 with analysis on success", async () => {
    const mockAnalysis = {
      summary: "Driver has good compliance record.",
      recommendations: ["Complete refresher course"],
      suggestedQuizIds: [],
    };
    mockAnalyzeSafetyCompliance.mockResolvedValueOnce(mockAnalysis);

    const res = await request(app)
      .post("/api/ai/analyze-safety")
      .set("Authorization", AUTH_HEADER)
      .send({
        data: {
          activityHistory: [{ event: "loaded", timestamp: "2026-03-01" }],
          performance: { totalScore: 90, grade: "A" },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("analysis");
    expect(res.body.analysis).toEqual(mockAnalysis);
  });

  it("returns 500 when Gemini service throws", async () => {
    mockAnalyzeSafetyCompliance.mockRejectedValueOnce(
      new Error("service unavailable"),
    );

    const res = await request(app)
      .post("/api/ai/analyze-safety")
      .set("Authorization", AUTH_HEADER)
      .send({ data: { activityHistory: [], performance: {} } });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("AI analysis failed");
  });
});
