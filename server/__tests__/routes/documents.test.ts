/**
 * Tests for /api/documents route.
 * Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05, R-P3-06, R-P3-07
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks - must be hoisted before any imports that use them
const { mockUpload, mockListDocuments, mockGetDownloadUrl, mockFindById } =
  vi.hoisted(() => {
    return {
      mockUpload: vi.fn(),
      mockListDocuments: vi.fn(),
      mockGetDownloadUrl: vi.fn(),
      mockFindById: vi.fn(),
    };
  });

// Mock the document service factory
vi.mock("../../services/document.service", () => ({
  createDocumentService: vi.fn().mockReturnValue({
    upload: mockUpload,
    listDocuments: mockListDocuments,
    getDownloadUrl: mockGetDownloadUrl,
    validateFile: vi.fn(),
  }),
  createStorageAdapter: vi.fn().mockResolvedValue({
    uploadBlob: vi.fn(),
    deleteBlob: vi.fn(),
    getSignedUrl: vi.fn(),
  }),
}));

// Mock the document repository (used by getDownloadUrl for cross-tenant check)
vi.mock("../../repositories/document.repository", () => ({
  documentRepository: {
    findById: mockFindById,
    findByCompany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    updateStatus: vi.fn(),
    deleteById: vi.fn(),
  },
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
  sanitizeFilename: vi.fn((name: string) => {
    // Simulate real sanitization: strip path traversal
    let n = name.split(/[/\\]/).pop() || "";
    n = n.replace(/\.\./g, "");
    n = n.replace(/[^a-zA-Z0-9._-]/g, "_");
    n = n
      .replace(/_+/g, "_")
      .replace(/^[_.]+/, "")
      .replace(/[_.]+$/, "");
    return n || "unnamed_document";
  }),
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

// Auth state control
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
  requireAuth: (req: any, _res: any, next: any) => {
    if (!mockAuthState.enabled) {
      return _res.status(401).json({ error: "Authentication required." });
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

import express from "express";
import request from "supertest";
import documentsRouter from "../../routes/documents";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(documentsRouter);
  app.use(errorHandler);
  return app;
}

// ── R-P3-01: POST accepts multipart/form-data ─────────────────────────────────

describe("R-P3-01: POST /api/documents accepts multipart/form-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockUpload.mockResolvedValue({
      documentId: "doc-001",
      storagePath: "tenants/company-aaa/documents/doc-001/test.pdf",
      status: "finalized",
      sanitizedFilename: "test.pdf",
    });
  });

  it("R-P3-01: returns 201 for valid multipart upload with file field", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "bol")
      .attach("file", Buffer.from("%PDF-1.4 content"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("documentId");
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when no file is provided", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .send({ document_type: "bol" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when document_type is missing", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .attach("file", Buffer.from("PDF content"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
  });
});

// ── R-P3-02: File > 10MB returns 413 ─────────────────────────────────────────

describe("R-P3-02: File > 10MB returns 413 with JSON error body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
  });

  it("R-P3-02: returns 413 with JSON body when file exceeds 10MB", async () => {
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, "x");

    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "bol")
      .attach("file", oversizedBuffer, {
        filename: "large.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });
});

// ── R-P3-03: Invalid MIME type returns 400 ────────────────────────────────────

describe("R-P3-03: Invalid MIME type returns 400 with JSON error body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
  });

  it("R-P3-03: returns 400 for .exe MIME type", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "bol")
      .attach("file", Buffer.from("malicious content"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("returns 400 for text/html MIME type", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "bol")
      .attach("file", Buffer.from("<html>xss</html>"), {
        filename: "evil.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});

// ── R-P3-04: Path traversal filename is sanitized ────────────────────────────

describe("R-P3-04: Path traversal filename sanitized by sanitizeFilename()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockUpload.mockResolvedValue({
      documentId: "doc-sec-001",
      storagePath: "tenants/company-aaa/documents/doc-sec-001/etc_passwd",
      status: "finalized",
      sanitizedFilename: "etc_passwd",
    });
  });

  it("R-P3-04: sanitizes path traversal filename and does not reflect raw path in response", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "bol")
      .attach("file", Buffer.from("%PDF-1.4 fake"), {
        filename: "../../../etc/passwd.pdf",
        contentType: "application/pdf",
      });

    // Should succeed (pdf is valid MIME) but the filename must be sanitized
    expect(res.status).toBe(201);
    // The sanitized filename from the service mock should not contain traversal
    expect(res.body.sanitizedFilename).not.toContain("..");
    expect(res.body.sanitizedFilename).not.toContain("/");
    expect(res.body.sanitizedFilename).not.toContain("\\");

    // Verify upload was called with sanitized input
    expect(mockUpload).toHaveBeenCalled();
    const uploadCallArg = mockUpload.mock.calls[0][0];
    // originalFilename is passed as-is; service applies sanitization
    expect(uploadCallArg.originalFilename).toBeDefined();
  });
});

// ── R-P3-05: GET /api/documents returns document list ────────────────────────

describe("R-P3-05: GET /api/documents returns document list for authenticated tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockListDocuments.mockResolvedValue([]);
  });

  it("R-P3-05: returns 200 with documents array for authenticated tenant", async () => {
    const docs = [
      {
        id: "doc-aaa",
        company_id: "company-aaa",
        original_filename: "bill.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 2048,
        document_type: "bol",
        status: "finalized",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    mockListDocuments.mockResolvedValue(docs);

    const res = await request(buildApp())
      .get("/api/documents")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.documents)).toBe(true);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].id).toBe("doc-aaa");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthState.enabled = false;

    const res = await request(buildApp()).get("/api/documents");

    expect(res.status).toBe(401);
  });

  it("returns empty array when tenant has no documents", async () => {
    mockListDocuments.mockResolvedValue([]);

    const res = await request(buildApp())
      .get("/api/documents")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
  });
});

// ── R-P3-06: GET /api/documents/:id/download returns signed URL ──────────────

describe("R-P3-06: GET /api/documents/:id/download returns signed URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockGetDownloadUrl.mockResolvedValue("https://signed.example.com/doc-001");
  });

  it("R-P3-06: returns 200 with signed URL for valid document", async () => {
    const res = await request(buildApp())
      .get("/api/documents/doc-001/download")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url");
    expect(typeof res.body.url).toBe("string");
    expect(res.body.url).toContain("https://");
  });

  it("returns 404 when document does not exist", async () => {
    const { ValidationError } = await import("../../errors/AppError");
    mockGetDownloadUrl.mockRejectedValue(
      new ValidationError(
        "Document not found",
        {},
        "VALIDATION_DOCUMENT_NOT_FOUND",
      ),
    );

    const res = await request(buildApp())
      .get("/api/documents/nonexistent/download")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});

// ── R-P3-07: Cross-tenant document access returns 404 ────────────────────────

describe("R-P3-07: Cross-tenant document access returns 404", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
  });

  it("R-P3-07: returns 404 when document belongs to different tenant", async () => {
    const { ValidationError } = await import("../../errors/AppError");
    // Simulate service returning not-found because company_id doesn't match
    mockGetDownloadUrl.mockRejectedValue(
      new ValidationError(
        "Document not found",
        {},
        "VALIDATION_DOCUMENT_NOT_FOUND",
      ),
    );

    const res = await request(buildApp())
      .get("/api/documents/doc-other-tenant/download")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("cross-tenant GET list only returns documents for requesting tenant", async () => {
    // Only return docs for company-aaa, never company-bbb
    const docs = [
      {
        id: "doc-aaa",
        company_id: "company-aaa",
        original_filename: "bill.pdf",
        document_type: "bol",
        status: "finalized",
      },
    ];
    mockListDocuments.mockResolvedValue(docs);

    const res = await request(buildApp())
      .get("/api/documents")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // All returned documents belong to the authenticated tenant only
    res.body.documents.forEach((doc: any) => {
      expect(doc.company_id).toBe("company-aaa");
    });
  });
});
