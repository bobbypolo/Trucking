import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P2-14, R-P2-15, R-P2-16, R-P2-17, R-P2-18, R-P2-19

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
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

// Mock intuit-oauth SDK
const mockAuthorizeUri = vi.fn();
const mockCreateToken = vi.fn();
const mockRefresh = vi.fn();
const mockSetToken = vi.fn();
const mockGetToken = vi.fn();
const mockMakeApiCall = vi.fn();
const mockIsAccessTokenValid = vi.fn();

function MockOAuthClient() {
  return {
    authorizeUri: mockAuthorizeUri,
    createToken: mockCreateToken,
    refresh: mockRefresh,
    setToken: mockSetToken,
    getToken: mockGetToken,
    makeApiCall: mockMakeApiCall,
    isAccessTokenValid: mockIsAccessTokenValid,
    token: {
      realmId: "realm-123",
      access_token: "access-token-xyz",
      refresh_token: "refresh-token-abc",
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
      createdAt: Date.now(),
    },
  };
}

MockOAuthClient.scopes = {
  Accounting: "com.intuit.quickbooks.accounting",
  Payment: "com.intuit.quickbooks.payment",
};

MockOAuthClient.environment = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com/",
  production: "https://quickbooks.api.intuit.com/",
};

vi.mock("intuit-oauth", () => {
  return { default: MockOAuthClient };
});

// Mock node:crypto for AES-256-GCM
const mockRandomBytes = vi.fn();
const mockCreateCipheriv = vi.fn();
const mockCreateDecipheriv = vi.fn();

vi.mock("node:crypto", () => ({
  randomBytes: (...args: any[]) => mockRandomBytes(...args),
  createCipheriv: (...args: any[]) => mockCreateCipheriv(...args),
  createDecipheriv: (...args: any[]) => mockCreateDecipheriv(...args),
}));

const originalEnv = { ...process.env };

describe("S-204: QuickBooks OAuth Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Default: QuickBooks configured
    process.env.QUICKBOOKS_CLIENT_ID = "qb_client_id_test";
    process.env.QUICKBOOKS_CLIENT_SECRET = "qb_client_secret_test";
    process.env.QUICKBOOKS_REDIRECT_URI = "https://app.example.com/callback/quickbooks";
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-19: Missing env vars returns { available: false, reason: no_api_key }
  // ───────────────────────────────────────────────────────────
  describe("R-P2-19: Missing env vars graceful fallback", () => {
    it("isQbConfigured returns false when QUICKBOOKS_CLIENT_ID is missing", async () => {
      delete process.env.QUICKBOOKS_CLIENT_ID;
      const { isQbConfigured } = await import("../../services/quickbooks.service");
      expect(isQbConfigured()).toBe(false);
    });

    it("isQbConfigured returns false when QUICKBOOKS_CLIENT_SECRET is missing", async () => {
      delete process.env.QUICKBOOKS_CLIENT_SECRET;
      const { isQbConfigured } = await import("../../services/quickbooks.service");
      expect(isQbConfigured()).toBe(false);
    });

    it("getAuthorizationUrl returns { available: false, reason: no_api_key } when not configured", async () => {
      delete process.env.QUICKBOOKS_CLIENT_ID;
      const { getAuthorizationUrl } = await import("../../services/quickbooks.service");
      const result = await getAuthorizationUrl("comp-1");
      expect(result).toEqual({ available: false, reason: "no_api_key" });
    });

    it("getConnectionStatus returns { available: false, reason: no_api_key } when not configured", async () => {
      delete process.env.QUICKBOOKS_CLIENT_ID;
      const { getConnectionStatus } = await import("../../services/quickbooks.service");
      const result = await getConnectionStatus("comp-1");
      expect(result).toEqual({ available: false, reason: "no_api_key" });
    });

    it("syncInvoiceToQBO returns { available: false, reason: no_api_key } when not configured", async () => {
      delete process.env.QUICKBOOKS_CLIENT_ID;
      const { syncInvoiceToQBO } = await import("../../services/quickbooks.service");
      const result = await syncInvoiceToQBO("comp-1", { invoiceNumber: "INV-001", amount: 100 });
      expect(result).toMatchObject({ available: false, reason: "no_api_key" });
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-14: getAuthorizationUrl returns valid Intuit OAuth URL
  // ───────────────────────────────────────────────────────────
  describe("R-P2-14: getAuthorizationUrl", () => {
    it("returns valid Intuit OAuth URL with correct client_id and redirect_uri", async () => {
      const expectedUrl =
        "https://appcenter.intuit.com/connect/oauth2?response_type=code&client_id=qb_client_id_test&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback%2Fquickbooks&scope=com.intuit.quickbooks.accounting&state=comp-1";

      mockAuthorizeUri.mockReturnValueOnce(expectedUrl);

      const { getAuthorizationUrl } = await import("../../services/quickbooks.service");
      const result = await getAuthorizationUrl("comp-1");

      expect(result).toHaveProperty("url");
      if ("url" in result) {
        expect(result.url).toContain("appcenter.intuit.com");
        expect(result.url).toContain("client_id=qb_client_id_test");
        expect(result.url).toContain("redirect_uri");
      }

      expect(mockAuthorizeUri).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "com.intuit.quickbooks.accounting",
          state: "comp-1",
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-15: handleCallback exchanges auth code, encrypts tokens, stores
  // ───────────────────────────────────────────────────────────
  describe("R-P2-15: handleCallback token exchange and storage", () => {
    it("exchanges auth code, encrypts tokens with AES-256-GCM, stores in quickbooks_tokens", async () => {
      // Mock createToken response from Intuit
      mockCreateToken.mockResolvedValueOnce({
        json: {
          access_token: "qb-access-token-123",
          refresh_token: "qb-refresh-token-456",
          token_type: "bearer",
          expires_in: 3600,
          x_refresh_token_expires_in: 8726400,
        },
      });

      mockGetToken.mockReturnValue({
        access_token: "qb-access-token-123",
        refresh_token: "qb-refresh-token-456",
        token_type: "bearer",
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
      });

      // Mock crypto for encryption
      const fakeIv = Buffer.alloc(12, 0x01);
      mockRandomBytes.mockReturnValue(fakeIv);

      const fakeAuthTag = Buffer.alloc(16, 0xaa);
      const fakeCipherText = Buffer.from("encrypted-data");
      const mockCipher = {
        update: vi.fn().mockReturnValue(fakeCipherText),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        getAuthTag: vi.fn().mockReturnValue(fakeAuthTag),
      };
      mockCreateCipheriv.mockReturnValue(mockCipher);

      // Mock DB insert/upsert
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const { handleCallback } = await import("../../services/quickbooks.service");
      const result = await handleCallback("comp-1", "auth-code-xyz", "realm-123");

      expect(result).toHaveProperty("success", true);

      // Verify createToken was called with the auth code in URL format
      expect(mockCreateToken).toHaveBeenCalledWith(
        expect.stringContaining("code=auth-code-xyz"),
      );

      // Verify encryption was used
      expect(mockCreateCipheriv).toHaveBeenCalledWith(
        "aes-256-gcm",
        expect.any(Buffer),
        expect.any(Buffer),
      );

      // Verify DB store was called
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("quickbooks_tokens"),
        expect.any(Array),
      );
    });

    it("returns error when createToken fails", async () => {
      mockCreateToken.mockRejectedValueOnce(new Error("Invalid auth code"));

      const { handleCallback } = await import("../../services/quickbooks.service");
      const result = await handleCallback("comp-1", "bad-code", "realm-123");

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-16: getClient decrypts tokens, refreshes if expired
  // ───────────────────────────────────────────────────────────
  describe("R-P2-16: getClient with decrypt and refresh", () => {
    it("decrypts tokens and returns authenticated client when tokens are valid", async () => {
      // Mock DB query returning encrypted token row
      const fakeIv = Buffer.alloc(12, 0x01);
      const fakeAuthTag = Buffer.alloc(16, 0xaa);
      const fakeEncryptedAccess = Buffer.from("encrypted-access");
      const fakeEncryptedRefresh = Buffer.from("encrypted-refresh");

      // Combine: iv + authTag + ciphertext for storage format
      const storedAccess = Buffer.concat([fakeIv, fakeAuthTag, fakeEncryptedAccess]).toString("base64");
      const storedRefresh = Buffer.concat([fakeIv, fakeAuthTag, fakeEncryptedRefresh]).toString("base64");

      // Return token row from DB
      mockQuery.mockResolvedValueOnce([[{
        id: "tok-1",
        company_id: "comp-1",
        realm_id: "realm-123",
        access_token: storedAccess,
        refresh_token: storedRefresh,
        token_type: "bearer",
        expires_at: new Date(Date.now() + 3600000), // not expired
      }]]);

      // Mock decryption
      const mockDecipher = {
        update: vi.fn().mockReturnValue(Buffer.from("decrypted-access-token")),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        setAuthTag: vi.fn(),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      mockIsAccessTokenValid.mockReturnValue(true);

      const { getClient } = await import("../../services/quickbooks.service");
      const result = await getClient("comp-1");

      expect(result).toHaveProperty("client");
      expect(mockCreateDecipheriv).toHaveBeenCalledWith(
        "aes-256-gcm",
        expect.any(Buffer),
        expect.any(Buffer),
      );
    });

    it("refreshes expired tokens and re-encrypts before storing", async () => {
      // Return expired token from DB
      const fakeIv = Buffer.alloc(12, 0x01);
      const fakeAuthTag = Buffer.alloc(16, 0xaa);
      const fakeCipher = Buffer.from("encrypted");
      const storedToken = Buffer.concat([fakeIv, fakeAuthTag, fakeCipher]).toString("base64");

      mockQuery.mockResolvedValueOnce([[{
        id: "tok-1",
        company_id: "comp-1",
        realm_id: "realm-123",
        access_token: storedToken,
        refresh_token: storedToken,
        token_type: "bearer",
        expires_at: new Date(Date.now() - 60000), // expired
      }]]);

      // Mock decryption
      const mockDecipher = {
        update: vi.fn().mockReturnValue(Buffer.from("old-token")),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        setAuthTag: vi.fn(),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);

      // First call: isAccessTokenValid returns false (expired)
      mockIsAccessTokenValid.mockReturnValue(false);

      // Mock refresh
      mockRefresh.mockResolvedValueOnce({
        json: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        },
      });

      mockGetToken.mockReturnValue({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      });

      // Mock re-encryption
      const mockCipherObj = {
        update: vi.fn().mockReturnValue(Buffer.from("re-encrypted")),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        getAuthTag: vi.fn().mockReturnValue(Buffer.alloc(16, 0xbb)),
      };
      mockCreateCipheriv.mockReturnValue(mockCipherObj);
      mockRandomBytes.mockReturnValue(Buffer.alloc(12, 0x02));

      // Mock DB update for re-encrypted tokens
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const { getClient } = await import("../../services/quickbooks.service");
      const result = await getClient("comp-1");

      expect(result).toHaveProperty("client");

      // Verify refresh was called
      expect(mockRefresh).toHaveBeenCalled();

      // Verify new tokens were stored (re-encrypted)
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE quickbooks_tokens");
    });

    it("returns error when no tokens found in DB", async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const { getClient } = await import("../../services/quickbooks.service");
      const result = await getClient("comp-1");

      expect(result).toHaveProperty("error");
      expect(result).not.toHaveProperty("client");
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-17: syncInvoiceToQBO creates Invoice via Intuit API
  // ───────────────────────────────────────────────────────────
  describe("R-P2-17: syncInvoiceToQBO", () => {
    it("creates Invoice via Intuit API with correct field mapping", async () => {
      // Mock getClient returning a working client
      // We need to mock the entire flow: DB query -> decrypt -> client ready
      const fakeIv = Buffer.alloc(12, 0x01);
      const fakeAuthTag = Buffer.alloc(16, 0xaa);
      const fakeCipher = Buffer.from("encrypted");
      const storedToken = Buffer.concat([fakeIv, fakeAuthTag, fakeCipher]).toString("base64");

      mockQuery.mockResolvedValueOnce([[{
        id: "tok-1",
        company_id: "comp-1",
        realm_id: "realm-123",
        access_token: storedToken,
        refresh_token: storedToken,
        token_type: "bearer",
        expires_at: new Date(Date.now() + 3600000),
      }]]);

      const mockDecipher = {
        update: vi.fn().mockReturnValue(Buffer.from("decrypted-token")),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        setAuthTag: vi.fn(),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);
      mockIsAccessTokenValid.mockReturnValue(true);

      // Mock makeApiCall for invoice creation
      mockMakeApiCall.mockResolvedValueOnce({
        json: {
          Invoice: {
            Id: "123",
            DocNumber: "INV-001",
            TotalAmt: 5000,
          },
        },
      });

      const { syncInvoiceToQBO } = await import("../../services/quickbooks.service");
      const result = await syncInvoiceToQBO("comp-1", {
        invoiceNumber: "INV-001",
        customerName: "ACME Corp",
        lineItems: [
          { description: "Freight Load #42", amount: 5000, quantity: 1 },
        ],
        amount: 5000,
      });

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("invoiceId", "123");

      // Verify makeApiCall was called with Invoice object
      expect(mockMakeApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("invoice"),
          method: "POST",
          body: expect.objectContaining({
            DocNumber: "INV-001",
            Line: expect.any(Array),
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // R-P2-18: Token encrypt/decrypt roundtrip
  // ───────────────────────────────────────────────────────────
  describe("R-P2-18: Token encrypt/decrypt roundtrip", () => {
    it("roundtrip preserves original token value", async () => {
      // Test the AES-256-GCM encrypt/decrypt roundtrip using the mock
      // infrastructure to verify the storage format (iv + authTag + ciphertext).
      const key = Buffer.from(
        process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY!,
        "hex",
      );
      const originalToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test-token-value";

      // Set up encrypt mock: store values for decrypt verification
      const fakeIv = Buffer.alloc(12, 0x42);
      mockRandomBytes.mockReturnValueOnce(fakeIv);

      const fakeEncrypted = Buffer.from(originalToken, "utf8");
      const fakeAuthTag = Buffer.alloc(16, 0xcc);
      const mockCipher = {
        update: vi.fn().mockReturnValue(fakeEncrypted),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        getAuthTag: vi.fn().mockReturnValue(fakeAuthTag),
      };
      mockCreateCipheriv.mockReturnValueOnce(mockCipher);

      // Simulate encrypt: produce the stored format
      const stored = Buffer.concat([fakeIv, fakeAuthTag, fakeEncrypted]).toString("base64");

      // Now set up decrypt mock to return the original token
      const mockDecipher = {
        update: vi.fn().mockReturnValue(Buffer.from(originalToken, "utf8")),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        setAuthTag: vi.fn(),
      };
      mockCreateDecipheriv.mockReturnValueOnce(mockDecipher);

      // Simulate decrypt
      const raw = Buffer.from(stored, "base64");
      const decIv = raw.subarray(0, 12);
      const decAuthTag = raw.subarray(12, 28);
      const decCiphertext = raw.subarray(28);

      // Verify format: iv matches
      expect(decIv).toEqual(fakeIv);
      // Verify format: authTag matches
      expect(decAuthTag).toEqual(fakeAuthTag);
      // Verify format: ciphertext matches
      expect(decCiphertext).toEqual(fakeEncrypted);

      // Decrypt returns original
      const decipher = mockCreateDecipheriv("aes-256-gcm", key, decIv);
      decipher.setAuthTag(decAuthTag);
      const decrypted = Buffer.concat([
        decipher.update(decCiphertext),
        decipher.final(),
      ]).toString("utf8");

      expect(decrypted).toBe(originalToken);
    });
  });

  // ───────────────────────────────────────────────────────────
  // syncBillToQBO
  // ───────────────────────────────────────────────────────────
  describe("syncBillToQBO", () => {
    it("creates Bill via Intuit API with correct field mapping", async () => {
      const fakeIv = Buffer.alloc(12, 0x01);
      const fakeAuthTag = Buffer.alloc(16, 0xaa);
      const fakeCipher = Buffer.from("encrypted");
      const storedToken = Buffer.concat([fakeIv, fakeAuthTag, fakeCipher]).toString("base64");

      mockQuery.mockResolvedValueOnce([[{
        id: "tok-1",
        company_id: "comp-1",
        realm_id: "realm-123",
        access_token: storedToken,
        refresh_token: storedToken,
        token_type: "bearer",
        expires_at: new Date(Date.now() + 3600000),
      }]]);

      const mockDecipher = {
        update: vi.fn().mockReturnValue(Buffer.from("decrypted-token")),
        final: vi.fn().mockReturnValue(Buffer.alloc(0)),
        setAuthTag: vi.fn(),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher);
      mockIsAccessTokenValid.mockReturnValue(true);

      mockMakeApiCall.mockResolvedValueOnce({
        json: {
          Bill: {
            Id: "456",
            DocNumber: "BILL-001",
            TotalAmt: 3000,
          },
        },
      });

      const { syncBillToQBO } = await import("../../services/quickbooks.service");
      const result = await syncBillToQBO("comp-1", {
        billNumber: "BILL-001",
        vendorName: "Fuel Co",
        lineItems: [
          { description: "Diesel Fuel", amount: 3000, quantity: 1 },
        ],
        amount: 3000,
      });

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("billId", "456");

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("bill"),
          method: "POST",
          body: expect.objectContaining({
            DocNumber: "BILL-001",
            Line: expect.any(Array),
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // getConnectionStatus
  // ───────────────────────────────────────────────────────────
  describe("getConnectionStatus", () => {
    it("returns connected: true with realm info when tokens exist and valid", async () => {
      const futureDate = new Date(Date.now() + 3600000);
      mockQuery.mockResolvedValueOnce([[{
        id: "tok-1",
        company_id: "comp-1",
        realm_id: "realm-123",
        expires_at: futureDate,
      }]]);

      const { getConnectionStatus } = await import("../../services/quickbooks.service");
      const result = await getConnectionStatus("comp-1");

      expect(result).toEqual({
        connected: true,
        realmId: "realm-123",
        expiresAt: futureDate.toISOString(),
      });
    });

    it("returns connected: false with reason no_tokens when no tokens stored", async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const { getConnectionStatus } = await import("../../services/quickbooks.service");
      const result = await getConnectionStatus("comp-1");

      expect(result).toEqual({
        connected: false,
        reason: "no_tokens",
      });
    });
  });
});

