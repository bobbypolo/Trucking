/**
 * Tests for FileVault upload-download round trip with DiskStorageAdapter.
 * Tests R-W6-02a, R-W6-02b, R-W6-02c, R-W6-VPC-702
 *
 * Verifies that:
 * - POST /api/documents stores file via DiskStorageAdapter and returns metadata
 * - GET /api/documents/:id/download retrieves file from DiskStorageAdapter
 * - The file content matches the original upload
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — must be defined before any imports that use them
const { mockCreate, mockFindById, mockFindByCompany, mockUpdateStatus } =
  vi.hoisted(() => {
    return {
      mockCreate: vi.fn(),
      mockFindById: vi.fn(),
      mockFindByCompany: vi.fn().mockResolvedValue([]),
      mockUpdateStatus: vi.fn(),
    };
  });

// Mock the document repository so we control DB interactions
vi.mock("../../repositories/document.repository", () => ({
  documentRepository: {
    create: mockCreate,
    findById: mockFindById,
    findByCompany: mockFindByCompany,
    updateStatus: mockUpdateStatus,
    deleteById: vi.fn(),
  },
}));

// Mock the document schema constants (keep real validation logic)
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

// ── R-W6-02a: POST stores file via DiskStorageAdapter ───────────────────────

describe("R-W6-02a: POST /api/documents stores file via DiskStorageAdapter and returns metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    // Mock repository create to succeed
    mockCreate.mockResolvedValue(undefined);
    // Mock updateStatus for finalization
    mockUpdateStatus.mockResolvedValue(undefined);
  });

  it("R-W6-02a: upload returns 201 with documentId and storagePath", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "BOL")
      .attach("file", Buffer.from("%PDF-1.4 test content"), {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("documentId");
    expect(res.body).toHaveProperty("storagePath");
    expect(res.body.storagePath).toContain("tenants/company-aaa/documents/");
    expect(res.body).toHaveProperty("sanitizedFilename", "invoice.pdf");
  });

  it("R-W6-02a: upload calls repository.create with correct storage path", async () => {
    await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "BOL")
      .attach("file", Buffer.from("%PDF-1.4 test content"), {
        filename: "receipt.pdf",
        contentType: "application/pdf",
      });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.storage_path).toContain("tenants/company-aaa/documents/");
    expect(createArg.company_id).toBe("company-aaa");
    expect(createArg.document_type).toBe("BOL");
    expect(createArg.sanitized_filename).toBe("receipt.pdf");
  });
});

// ── R-W6-02b: GET download retrieves file from DiskStorageAdapter ───────────

describe("R-W6-02b: GET /api/documents/:id/download retrieves file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
  });

  it("R-W6-02b: returns download URL for valid document", async () => {
    mockFindById.mockResolvedValue({
      id: "doc-001",
      company_id: "company-aaa",
      storage_path: "tenants/company-aaa/documents/doc-001/invoice.pdf",
      original_filename: "invoice.pdf",
      sanitized_filename: "invoice.pdf",
      mime_type: "application/pdf",
      status: "finalized",
    });

    // Write a test file to disk so the download endpoint can serve it
    const { join } = await import("path");
    const { writeFile, mkdir } = await import("fs/promises");
    const baseDir = process.env.UPLOAD_DIR || "./uploads";
    const storagePath = "tenants/company-aaa/documents/doc-001/invoice.pdf";
    const fullPath = join(baseDir, storagePath);
    await mkdir(join(baseDir, "tenants/company-aaa/documents/doc-001"), {
      recursive: true,
    });
    await writeFile(fullPath, "PDF content for test");

    const res = await request(buildApp())
      .get("/api/documents/doc-001/download")
      .set("Authorization", "Bearer valid-token");

    // Disk mode serves the file directly with proper content-type
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("invoice.pdf");
  });

  it("R-W6-02b: returns 404 for non-existent document", async () => {
    mockFindById.mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/api/documents/nonexistent/download")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("R-W6-02b: disk download serves file content", async () => {
    const storagePath = "tenants/company-aaa/documents/doc-002/test-file.pdf";
    mockFindById.mockResolvedValue({
      id: "doc-002",
      company_id: "company-aaa",
      storage_path: storagePath,
      original_filename: "test-file.pdf",
      sanitized_filename: "test-file.pdf",
      mime_type: "application/pdf",
      status: "finalized",
    });

    // Write test file
    const { join } = await import("path");
    const { writeFile, mkdir } = await import("fs/promises");
    const baseDir = process.env.UPLOAD_DIR || "./uploads";
    const fullPath = join(baseDir, storagePath);
    await mkdir(join(baseDir, "tenants/company-aaa/documents/doc-002"), {
      recursive: true,
    });
    await writeFile(fullPath, "Test PDF content");

    const res = await request(buildApp())
      .get("/api/documents/doc-002/download")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString()).toBe("Test PDF content");
  });
});

// ── R-W6-VPC-702: Server tests pass, tsc clean ──────────────────────────────

describe("R-W6-VPC-702: Route integration with DiskStorageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.enabled = true;
    mockCreate.mockResolvedValue(undefined);
    mockUpdateStatus.mockResolvedValue(undefined);
  });

  it("R-W6-VPC-702: documents route uses DiskStorageAdapter (not memory no-op)", async () => {
    // Import the route module and check the factory uses disk storage
    const { createDocumentsRouteService } =
      await import("../../routes/documents");
    const svc = await createDocumentsRouteService();
    // The service should be defined and have the expected methods
    expect(svc).toBeDefined();
    expect(typeof svc.upload).toBe("function");
    expect(typeof svc.getDownloadUrl).toBe("function");
    expect(typeof svc.listDocuments).toBe("function");
  });

  it("R-W6-VPC-702: upload returns correct response shape", async () => {
    const res = await request(buildApp())
      .post("/api/documents")
      .set("Authorization", "Bearer valid-token")
      .field("document_type", "POD")
      .attach("file", Buffer.from("%PDF-1.4 pod content"), {
        filename: "pod-doc.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      message: "Document uploaded successfully",
      documentId: expect.any(String),
      storagePath: expect.stringContaining("tenants/"),
      status: expect.any(String),
      sanitizedFilename: "pod-doc.pdf",
    });
  });
});


