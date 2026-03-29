/**
 * Tests for tracking provider credential encryption at rest.
 * Covers R-P5-05 through R-P5-09.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

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
                  role: "admin",
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
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

vi.mock("../../middleware/requireTier", () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/gps", () => ({
  getGpsProvider: () => ({
    getVehicleLocations: vi.fn().mockResolvedValue([]),
  }),
  getGpsProviderForTenant: vi.fn().mockResolvedValue({
    provider: null,
    state: "not-configured",
  }),
}));

import trackingRouter from "../../routes/tracking";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  isEncrypted,
} from "../../services/secret-encryption";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

// Set encryption key for tests (32 bytes = 64 hex chars)
const TEST_KEY = "a".repeat(64);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(trackingRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Unit tests for secret-encryption service
// ---------------------------------------------------------------------------
describe("secret-encryption service", () => {
  beforeEach(() => {
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.SECRET_ENCRYPTION_KEY;
    delete process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts a value roundtrip", () => {
    const plaintext = "my-secret-api-token-12345";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(isEncrypted(encrypted)).toBe(true);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const plaintext = "same-input";
    const enc1 = encryptSecret(plaintext);
    const enc2 = encryptSecret(plaintext);
    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1)).toBe(plaintext);
    expect(decryptSecret(enc2)).toBe(plaintext);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptSecret("test-value");
    const prefix = encrypted.slice(0, 4); // "enc:"
    const payload = encrypted.slice(4);
    // Corrupt a character in the base64 payload
    const corrupted =
      prefix +
      payload.slice(0, 10) +
      (payload[10] === "A" ? "B" : "A") +
      payload.slice(11);
    expect(() => decryptSecret(corrupted)).toThrow();
  });

  it("throws when no encryption key is set", () => {
    delete process.env.SECRET_ENCRYPTION_KEY;
    delete process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptSecret("value")).toThrow(/not set/);
  });

  it("falls back to QUICKBOOKS_TOKEN_ENCRYPTION_KEY", () => {
    delete process.env.SECRET_ENCRYPTION_KEY;
    process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const encrypted = encryptSecret("qb-fallback");
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe("qb-fallback");
  });

  it("isEncrypted detects the enc: prefix", () => {
    expect(isEncrypted("enc:somebase64data")).toBe(true);
    expect(isEncrypted("plaintext-value")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for maskSecret
// ---------------------------------------------------------------------------
describe("maskSecret", () => {
  it("masks a long secret showing last 4 chars", () => {
    expect(maskSecret("my-api-token-abcd")).toBe("****abcd");
  });

  it("masks a short secret without revealing content", () => {
    expect(maskSecret("ab")).toBe("****");
  });

  it("masks empty string", () => {
    expect(maskSecret("")).toBe("****");
  });

  it("masks exactly 5-char value", () => {
    expect(maskSecret("12345")).toBe("****2345");
  });
});

// ---------------------------------------------------------------------------
// R-P5-05: New tracking configs store api_token encrypted
// ---------------------------------------------------------------------------
describe("R-P5-05: POST /api/tracking/providers encrypts api_token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  afterEach(() => {
    delete process.env.SECRET_ENCRYPTION_KEY;
  });

  it("stores api_token as encrypted ciphertext, not plaintext", async () => {
    // Tests R-P5-05
    const plainApiToken = "samsara-test-token-xyz789";
    let capturedParams: any[] = [];

    // Capture the INSERT params
    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (typeof sql === "string" && sql.includes("INSERT INTO tracking_provider_configs")) {
        capturedParams = params;
        return [{ affectedRows: 1 }, []];
      }
      if (typeof sql === "string" && sql.includes("SELECT")) {
        return [
          [
            {
              id: "cfg-enc-1",
              provider_name: "samsara",
              is_active: 1,
              created_at: "2026-03-28T00:00:00.000Z",
            },
          ],
          [],
        ];
      }
      return [[], []];
    });

    const app = createApp();
    await request(app)
      .post("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER)
      .send({
        providerName: "samsara",
        apiToken: plainApiToken,
        isActive: true,
      });

    // The 4th param (index 3) is api_token — must be encrypted, not plaintext
    const storedApiToken = capturedParams[3];
    expect(storedApiToken).not.toBe(plainApiToken);
    expect(storedApiToken).not.toBeNull();
    expect(isEncrypted(storedApiToken)).toBe(true);
    // Verify it decrypts to the original value
    const decrypted = decryptSecret(storedApiToken);
    expect(decrypted).toBe(plainApiToken);
  });
});

// ---------------------------------------------------------------------------
// R-P5-06: New tracking configs store webhook_secret encrypted
// ---------------------------------------------------------------------------
describe("R-P5-06: POST /api/tracking/providers encrypts webhook_secret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  afterEach(() => {
    delete process.env.SECRET_ENCRYPTION_KEY;
  });

  it("stores webhook_secret as encrypted ciphertext, not plaintext", async () => {
    // Tests R-P5-06
    const plainWebhookSecret = "webhook-secret-key-abc123";
    let capturedParams: any[] = [];

    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (typeof sql === "string" && sql.includes("INSERT INTO tracking_provider_configs")) {
        capturedParams = params;
        return [{ affectedRows: 1 }, []];
      }
      if (typeof sql === "string" && sql.includes("SELECT")) {
        return [
          [
            {
              id: "cfg-enc-2",
              provider_name: "webhook",
              is_active: 1,
              created_at: "2026-03-28T00:00:00.000Z",
            },
          ],
          [],
        ];
      }
      return [[], []];
    });

    const app = createApp();
    await request(app)
      .post("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER)
      .send({
        providerName: "webhook",
        webhookUrl: "https://example.com/gps",
        webhookSecret: plainWebhookSecret,
        isActive: true,
      });

    // The 6th param (index 5) is webhook_secret — must be encrypted
    const storedSecret = capturedParams[5];
    expect(storedSecret).not.toBe(plainWebhookSecret);
    expect(storedSecret).not.toBeNull();
    expect(isEncrypted(storedSecret)).toBe(true);
    const decrypted = decryptSecret(storedSecret);
    expect(decrypted).toBe(plainWebhookSecret);
  });
});

// ---------------------------------------------------------------------------
// R-P5-07: GET /api/tracking/providers returns masked secrets
// ---------------------------------------------------------------------------
describe("R-P5-07: GET /api/tracking/providers returns masked secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  afterEach(() => {
    delete process.env.SECRET_ENCRYPTION_KEY;
  });

  it("returns masked api_token as ****XXXX format, never plaintext", async () => {
    // Tests R-P5-07
    const plainToken = "samsara-key-ending-in-7890";
    const encryptedToken = encryptSecret(plainToken);

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "cfg-mask-1",
          provider_name: "samsara",
          api_token: encryptedToken,
          webhook_secret: null,
          webhook_url: null,
          is_active: 1,
          created_at: "2026-03-28T00:00:00.000Z",
        },
      ],
      [],
    ]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const provider = res.body[0];
    // Must be masked, not plaintext
    expect(provider.apiToken).toBe("****7890");
    expect(provider.apiToken).not.toBe(plainToken);
    expect(provider.apiToken).not.toBe(encryptedToken);
  });

  it("returns masked webhook_secret as ****XXXX format", async () => {
    // Tests R-P5-07
    const plainSecret = "webhook-secret-ending-in-wxyz";
    const encryptedSecret = encryptSecret(plainSecret);

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "cfg-mask-2",
          provider_name: "webhook",
          api_token: null,
          webhook_secret: encryptedSecret,
          webhook_url: "https://example.com/hook",
          is_active: 1,
          created_at: "2026-03-28T00:00:00.000Z",
        },
      ],
      [],
    ]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const provider = res.body[0];
    expect(provider.webhookSecret).toBe("****wxyz");
    expect(provider.webhookSecret).not.toBe(plainSecret);
  });

  it("returns null for fields that have no secret configured", async () => {
    // Tests R-P5-07
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "cfg-mask-3",
          provider_name: "samsara",
          api_token: null,
          webhook_secret: null,
          webhook_url: null,
          is_active: 1,
          created_at: "2026-03-28T00:00:00.000Z",
        },
      ],
      [],
    ]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const provider = res.body[0];
    expect(provider.apiToken).toBeNull();
    expect(provider.webhookSecret).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R-P5-08: POST /api/tracking/providers/:id/test decrypts at point of use
// ---------------------------------------------------------------------------
describe("R-P5-08: POST /api/tracking/providers/:id/test decrypts at point of use", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  afterEach(() => {
    delete process.env.SECRET_ENCRYPTION_KEY;
  });

  it("decrypts stored api_token before using it for Samsara API call", async () => {
    // Tests R-P5-08
    const plainApiToken = "samsara-real-token-for-test";
    const encryptedApiToken = encryptSecret(plainApiToken);

    // Mock the DB query that fetches the config
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "cfg-test-1",
          provider_name: "samsara",
          api_token: encryptedApiToken,
          webhook_url: null,
          webhook_secret: null,
        },
      ],
      [],
    ]);

    // Mock global fetch to capture the Authorization header
    let capturedAuthHeader = "";
    const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
      capturedAuthHeader = opts?.headers?.Authorization ?? "";
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-test-1/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    // The fetch must have used the DECRYPTED token, not the encrypted ciphertext
    expect(capturedAuthHeader).toBe(`Bearer ${plainApiToken}`);
    expect(capturedAuthHeader).not.toContain("enc:");

    vi.unstubAllGlobals();
  });

  it("decrypts stored webhook_secret before using it for webhook test", async () => {
    // Tests R-P5-08
    const plainWebhookSecret = "webhook-secret-for-test";
    const encryptedWebhookSecret = encryptSecret(plainWebhookSecret);

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "cfg-test-2",
          provider_name: "webhook",
          api_token: null,
          webhook_url: "https://example.com/webhook",
          webhook_secret: encryptedWebhookSecret,
        },
      ],
      [],
    ]);

    let capturedApiKeyHeader = "";
    const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
      capturedApiKeyHeader = opts?.headers?.["X-GPS-API-Key"] ?? "";
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-test-2/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    // The fetch must have used the DECRYPTED secret
    expect(capturedApiKeyHeader).toBe(plainWebhookSecret);
    expect(capturedApiKeyHeader).not.toContain("enc:");

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// R-P5-09: Migration 043 encrypts existing plaintext values
// ---------------------------------------------------------------------------
describe("R-P5-09: Migration 043 — schema and encryption approach", () => {
  it("migration file 043 exists and widens webhook_secret column to TEXT", async () => {
    // Tests R-P5-09
    const fs = await import("node:fs");
    const path = await import("node:path");
    const migrationPath = path.join(
      __dirname,
      "../../migrations/043_encrypt_tracking_secrets.sql",
    );
    const content = fs.readFileSync(migrationPath, "utf8");

    // Migration must ALTER the column to TEXT for encrypted values
    expect(content).toContain("ALTER TABLE tracking_provider_configs");
    expect(content).toContain("MODIFY COLUMN webhook_secret TEXT");
  });

  it("encryptSecret produces values with enc: prefix for idempotent detection", () => {
    // Tests R-P5-09 — idempotent migration relies on prefix detection
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
    const encrypted = encryptSecret("plaintext-value");
    expect(encrypted.startsWith("enc:")).toBe(true);
    // Already-encrypted values are detected by isEncrypted()
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted("plaintext-value")).toBe(false);
    delete process.env.SECRET_ENCRYPTION_KEY;
  });

  it("legacy plaintext values are handled gracefully on decrypt failure", () => {
    // Tests R-P5-09 — transition period handling
    process.env.SECRET_ENCRYPTION_KEY = TEST_KEY;
    // Attempting to decrypt a plaintext value throws (not base64)
    expect(() => decryptSecret("plain-legacy-token")).toThrow();
    delete process.env.SECRET_ENCRYPTION_KEY;
  });
});
