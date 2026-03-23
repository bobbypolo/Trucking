/**
 * Documents API Route
 *
 * Provides file upload and retrieval endpoints for document management.
 * Uses multer for multipart form parsing and the document.service StorageAdapter pattern.
 *
 * Endpoints:
 *   GET  /api/documents              — list documents for authenticated tenant
 *   POST /api/documents              — upload a new document (multipart/form-data)
 *   GET  /api/documents/:id/download — get a signed download URL for a document
 */
import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { createChildLogger } from "../lib/logger";
import { createDocumentService } from "../services/document.service";
import type { StorageAdapter } from "../services/document.service";
import { ValidationError } from "../errors/AppError";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  documentListQuerySchema,
} from "../schemas/document.schema";
import { createDiskStorageAdapter } from "../services/disk-storage-adapter";

const router = Router();

/**
 * Default storage adapter: DiskStorageAdapter.
 * Files are persisted to ./uploads on the local filesystem.
 * Suitable for development and single-server deployments.
 */
const defaultStorageAdapter: StorageAdapter = createDiskStorageAdapter();

/** Factory so tests can inject a custom storage adapter. */
export function createDocumentsRouteService(
  storage: StorageAdapter = defaultStorageAdapter,
) {
  return createDocumentService(storage);
}

/**
 * Multer configuration:
 * - Memory storage (no temp files on disk)
 * - 10 MB size limit enforced at the multer layer
 * - MIME type filter rejects non-allowed types with 400
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) {
    const allowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(
      file.mimetype,
    );
    if (!allowed) {
      const err = new ValidationError(
        `MIME type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
        { mimetype: file.mimetype, allowed: [...ALLOWED_MIME_TYPES] },
        "VALIDATION_FILE_TYPE",
      );
      cb(err as unknown as null, false);
    } else {
      cb(null, true);
    }
  },
});

/**
 * Multer error handler middleware.
 * Translates multer-specific errors into appropriate HTTP responses.
 */
function multerErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: (err?: unknown) => void,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "File too large",
        details: `Maximum file size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        code: "FILE_TOO_LARGE",
      });
      return;
    }
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, error_code: err.error_code });
    return;
  }
  next(err);
}

// ── GET /api/documents ────────────────────────────────────────────────────────

router.get(
  "/api/documents",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/documents",
    });
    const companyId = req.user!.tenantId;

    const parsed = documentListQuerySchema.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};

    try {
      const svc = createDocumentsRouteService();
      const documents = await svc.listDocuments(companyId, filters);
      res.json({ documents });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/documents]");
      res.status(500).json({ error: "Failed to retrieve documents" });
    }
  },
);

// ── POST /api/documents ───────────────────────────────────────────────────────

router.post(
  "/api/documents",
  requireAuth,
  requireTenant,
  upload.single("file"),
  multerErrorHandler,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/documents",
    });
    const companyId = req.user!.tenantId;
    const uploadedBy = req.user!.uid;

    // Validate file presence
    if (!req.file) {
      res.status(400).json({
        error: "No file provided",
        details: "A file must be attached as multipart field 'file'",
      });
      return;
    }

    // Validate document_type
    const documentType: string | undefined = req.body?.document_type;
    if (!documentType || documentType.trim() === "") {
      res.status(400).json({
        error: "Missing required field",
        details: "'document_type' body field is required",
      });
      return;
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const description: string | undefined = req.body?.description;
    const loadId: string | undefined = req.body?.load_id;

    try {
      const svc = createDocumentsRouteService();
      const result = await svc.upload({
        companyId,
        originalFilename: originalname,
        mimeType: mimetype,
        fileSizeBytes: size,
        buffer,
        documentType: documentType.trim(),
        loadId,
        description,
        uploadedBy,
      });

      log.info({ documentId: result.documentId }, "Document created");
      res.status(201).json({
        message: "Document uploaded successfully",
        documentId: result.documentId,
        storagePath: result.storagePath,
        status: result.status,
        sanitizedFilename: result.sanitizedFilename,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.error_code === "VALIDATION_FILE_SIZE") {
          res
            .status(413)
            .json({ error: error.message, error_code: error.error_code });
          return;
        }
        res
          .status(400)
          .json({ error: error.message, error_code: error.error_code });
        return;
      }
      log.error({ err: error }, "SERVER ERROR [POST /api/documents]");
      res.status(500).json({ error: "Failed to upload document" });
    }
  },
);

// ── GET /api/documents/:id/download ──────────────────────────────────────────

router.get(
  "/api/documents/:id/download",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/documents/:id/download",
    });
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const svc = createDocumentsRouteService();
      const url = await svc.getDownloadUrl(id, companyId);
      res.json({ url });
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.error_code === "VALIDATION_DOCUMENT_NOT_FOUND") {
          res.status(404).json({ error: error.message });
          return;
        }
        res.status(400).json({ error: error.message });
        return;
      }
      log.error(
        { err: error },
        "SERVER ERROR [GET /api/documents/:id/download]",
      );
      res.status(500).json({ error: "Failed to generate download URL" });
    }
  },
);

export default router;
