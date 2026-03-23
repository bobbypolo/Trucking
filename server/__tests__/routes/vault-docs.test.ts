/**
 * Tests for vault-docs route.
 * Tests R-P1-09, R-P1-10, R-P1-11, R-P1-12
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks - must be hoisted before any imports that use them
const {
  mockDocumentServiceCreate,
  mockDocumentServiceList,
  mockDocumentServiceValidateFile,
} = vi.hoisted(() => {
  return {
    mockDocumentServiceCreate: vi.fn(),
    mockDocumentServiceList: vi.fn(),
    mockDocumentServiceValidateFile: vi.fn(),
  };
});

// Mock the document service factory
vi.mock("../../services/document.service", () => ({
  createDocumentService: vi.fn().mockReturnValue({
    upload: mockDocumentServiceCreate,
    listDocuments: mockDocumentServiceList,
    validateFile: mockDocumentServiceValidateFile,
  }),
}));

// Mock the document schema constants
vi.mock("../../schemas/document.schema", () => ({
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
  ],
  ALLOWED_EXTENSIONS: [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"],
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  sanitizeFilename: vi.fn((name: string) => name),
  hasAllowedExtension: vi.fn((name: string) => {
    const lower = name.toLowerCase();
    return (
      lower.endsWith(".pdf") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".tiff") ||
      lower.endsWith(".tif")
    );
  }),
  documentUploadSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  documentListQuerySchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
}));

// Mock firebase admin
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

// Mock logger
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock requireAuth middleware
const mockAuthState = {
  enabled: true,
  uid: "user-1",
  tenantId: "company-aaa",
  companyId: "company-aaa",
  role: "dispatcher",
  email: "test@loadpilot.com",
  firebaseUid: "firebase-uid-1",
};

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuthState.enabled) {
      return res.status(401).json({ error: "Authentication required." });
    }
    req.user = {
      uid: mockAuthState.uid,
      tenantId: mockAuthState.tenantId,
      companyId: mockAuthState.companyId,
      role: mockAuthState.role,
      email: mockAuthState.email,
      firebaseUid: mockAuthState.firebaseUid,
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });
    }
    next();
  },
}));

// Mock firebase storage adapter
vi.mock("../../lib/firebase-storage", () => ({
  firebaseStorageAdapter: {
    uploadBlob: vi.fn().mockResolvedValue(undefined),
    deleteBlob: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue("https://signed-url-example.com"),
  },
}));

import express from "express";
import request from "supertest";
import vaultDocsRouter from "../../routes/vault-docs";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(vaultDocsRouter);
  app.use(errorHandler);
  return app;
}

describe("GET /api/vault-docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockDocumentServiceList.mockResolvedValue([]);
  });

  // Tests R-P1-09
  it("R-P1-09: returns 200 with JSON array for authenticated tenant", async () => {
    const docs = [
      {
        id: "doc-001",
        company_id: "company-aaa",
        original_filename: "invoice.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 1024,
        document_type: "invoice",
        status: "finalized",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    mockDocumentServiceList.mockResolvedValue(docs);

    const res = await request(buildApp())
      .get("/api/vault-docs")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.documents)).toBe(true);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].id).toBe("doc-001");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthState.enabled = false;

    const res = await request(buildApp()).get("/api/vault-docs");

    expect(res.status).toBe(401);
  });

  it("returns empty array when no documents exist", async () => {
    mockDocumentServiceList.mockResolvedValue([]);

    const res = await request(buildApp())
      .get("/api/vault-docs")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
  });
});

describe("POST /api/vault-docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockDocumentServiceCreate.mockResolvedValue({
      documentId: "new-doc-123",
      storagePath: "tenants/company-aaa/documents/new-doc-123/test.pdf",
      status: "finalized",
      sanitizedFilename: "test.pdf",
    });
  });

  // Tests R-P1-10
  it("R-P1-10: creates document and returns 201 for valid multipart file", async () => {
    const res = await request(buildApp())
      .post("/api/vault-docs")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "invoice")
      .attach("file", Buffer.from("PDF content here"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("documentId");
    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 for unauthenticated upload", async () => {
    mockAuthState.enabled = false;

    const res = await request(buildApp())
      .post("/api/vault-docs")
      .field("document_type", "invoice")
      .attach("file", Buffer.from("PDF content"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(401);
  });

  // Tests R-P1-11
  it("R-P1-11: returns 413 when file exceeds 10MB", async () => {
    // Create a buffer larger than 10MB (10 * 1024 * 1024 + 1 bytes)
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, "x");

    const res = await request(buildApp())
      .post("/api/vault-docs")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "invoice")
      .attach("file", oversizedBuffer, {
        filename: "large-file.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
  });

  // Tests R-P1-12
  it("R-P1-12: returns 400 for invalid MIME type", async () => {
    const res = await request(buildApp())
      .post("/api/vault-docs")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "invoice")
      .attach("file", Buffer.from("executable content"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when no file is provided", async () => {
    const res = await request(buildApp())
      .post("/api/vault-docs")
      .set("Authorization", "Bearer valid-token")
      .send({ document_type: "invoice" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when document_type is missing", async () => {
    const res = await request(buildApp())
      .post("/api/vault-docs")
      .set("Authorization", "Bearer valid-token")
      .attach("file", Buffer.from("PDF content"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
  });
});
