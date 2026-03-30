/**
 * Documents API Route — Canonical Document Domain
 *
 * Single authoritative API for all document operations.
 * All consumers (FileVault, load docs, finance docs, onboarding docs) use
 * filtered views via query params on GET /api/documents.
 *
 * Endpoints:
 *   GET    /api/documents              — list documents with filter params
 *   POST   /api/documents              — upload a new document (multipart/form-data)
 *   GET    /api/documents/:id          — get a single document by ID
 *   PATCH  /api/documents/:id          — update status and/or lock state
 *   GET    /api/documents/:id/download — get a signed download URL for a document
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { createRequestLogger } from "../lib/logger";
import { createDocumentService } from "../services/document.service";
import type { StorageAdapter } from "../services/document.service";
import { ValidationError } from "../errors/AppError";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  documentListQuerySchema,
  documentPatchSchema,
} from "../schemas/document.schema";
import { createDiskStorageAdapter } from "../services/disk-storage-adapter";
import { createStorageAdapter } from "../services/document.service";

const router = Router();

/**
 * Storage adapter resolved via STORAGE_BACKEND env var.
 * Defaults to disk; set STORAGE_BACKEND=firebase for cloud storage.
 * Initialized lazily on first request to allow async factory.
 */
let resolvedStorageAdapter: StorageAdapter | null = null;

async function getStorageAdapter(): Promise<StorageAdapter> {
  if (!resolvedStorageAdapter) {
    resolvedStorageAdapter = await createStorageAdapter();
  }
  return resolvedStorageAdapter;
}

/** Factory so tests can inject a custom storage adapter. */
export async function createDocumentsRouteService(storage?: StorageAdapter) {
  const adapter = storage ?? (await getStorageAdapter());
  return createDocumentService(adapter);
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
  async (req: Request, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "GET /api/documents");
    const companyId = req.user!.tenantId;

    const parsed = documentListQuerySchema.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};

    try {
      const svc = await createDocumentsRouteService();
      const documents = await svc.listDocuments(companyId, filters);
      res.json({ documents });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/documents]");
      next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "POST /api/documents");
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
      const svc = await createDocumentsRouteService();
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
      next(error);
    }
  },
);

// ── GET /api/documents/:id ───────────────────────────────────────────────────

router.get(
  "/api/documents/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "GET /api/documents/:id");
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const svc = await createDocumentsRouteService();
      const document = await svc.findById(id, companyId);
      res.json({ document });
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.error_code === "VALIDATION_DOCUMENT_NOT_FOUND") {
          res.status(404).json({ error: error.message });
          return;
        }
        res.status(400).json({ error: error.message });
        return;
      }
      log.error({ err: error }, "SERVER ERROR [GET /api/documents/:id]");
      next(error);
    }
  },
);

// ── PATCH /api/documents/:id ────────────────────────────────────────────────

router.patch(
  "/api/documents/:id",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "PATCH /api/documents/:id");
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    const parsed = documentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
      return;
    }

    const { status, is_locked } = parsed.data;
    if (status === undefined && is_locked === undefined) {
      res.status(400).json({
        error: "At least one of 'status' or 'is_locked' must be provided",
      });
      return;
    }

    try {
      const svc = await createDocumentsRouteService();
      const updated = await svc.updateStatusAndLock(id, companyId, {
        status,
        is_locked,
      });
      res.json({ message: "Document updated", document: updated });
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.error_code === "VALIDATION_DOCUMENT_NOT_FOUND") {
          res.status(404).json({ error: error.message });
          return;
        }
        res.status(400).json({ error: error.message });
        return;
      }
      log.error({ err: error }, "SERVER ERROR [PATCH /api/documents/:id]");
      next(error);
    }
  },
);

// ── GET /api/documents/:id/download ──────────────────────────────────────────

router.get(
  "/api/documents/:id/download",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    const log = createRequestLogger(req, "GET /api/documents/:id/download");
    const companyId = req.user!.tenantId;
    const { id } = req.params;

    try {
      const svc = await createDocumentsRouteService();
      const url = await svc.getDownloadUrl(id, companyId);
      // Disk storage returns disk:// URIs — serve the file directly
      if (url.startsWith("disk://")) {
        const { join } = await import("path");
        const { readFile } = await import("fs/promises");
        const storagePath = url.replace("disk://", "");
        const baseDir = process.env.UPLOAD_DIR || "./uploads";
        const fullPath = join(baseDir, storagePath);
        const doc = await svc.findById(id, companyId);
        const buffer = await readFile(fullPath);
        res.setHeader(
          "Content-Type",
          doc?.mime_type || "application/octet-stream",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${doc?.original_filename || "download"}"`,
        );
        res.send(buffer);
        return;
      }
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
      next(error);
    }
  },
);

export default router;
