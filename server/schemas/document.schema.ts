import { z } from "zod";

/**
 * Allowed file types for document upload.
 * Only these MIME types are accepted server-side.
 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
] as const;

/**
 * Allowed file extensions (used for filename validation).
 */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".tiff",
  ".tif",
] as const;

/**
 * Maximum file size in bytes: 10 MB.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Sanitizes a filename by removing path traversal sequences,
 * special characters, and capping length.
 *
 * Rules:
 * - Strip directory path components (path traversal)
 * - Replace special characters with underscores
 * - Collapse consecutive underscores
 * - Trim leading/trailing underscores and dots
 * - Cap at 255 characters
 * - If result is empty after sanitization, use "unnamed_document"
 */
export function sanitizeFilename(raw: string): string {
  // 1. Extract basename (strip directory separators and traversal)
  let name = raw
    .replace(/\.\.\//g, "")
    .replace(/\.\.\\/g, "")
    .replace(/\//g, "_")
    .replace(/\\/g, "_");

  // Take only the last segment if any path separators remain
  const segments = name.split("_");
  // Actually, just use the raw basename approach
  name = raw.split(/[/\\]/).pop() || "";
  // Remove path traversal dots
  name = name.replace(/\.\./g, "");

  // 2. Replace special characters (keep alphanumeric, dots, hyphens, underscores)
  name = name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // 3. Collapse consecutive underscores
  name = name.replace(/_+/g, "_");

  // 4. Trim leading/trailing underscores and dots
  name = name.replace(/^[_.]+/, "").replace(/[_.]+$/, "");

  // 5. Preserve the extension through trimming
  // Re-extract extension if we trimmed it
  const extMatch = raw.match(/\.[a-zA-Z0-9]+$/);
  if (extMatch && !name.includes(".")) {
    const ext = extMatch[0].replace(/[^a-zA-Z0-9.]/g, "");
    name = name + ext;
  }

  // 6. Cap length
  if (name.length > 255) {
    name = name.substring(0, 255);
  }

  // 7. Fallback
  if (!name || name === "." || name === "..") {
    name = "unnamed_document";
  }

  return name;
}

/**
 * Validates that a filename has an allowed extension.
 */
export function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Schema for document upload metadata.
 */
export const documentUploadSchema = z.object({
  load_id: z.string().min(1).optional(),
  document_type: z.string().min(1),
  description: z.string().optional(),
});

/**
 * Schema for document status update.
 */
export const documentStatusUpdateSchema = z.object({
  status: z.string().min(1),
});

/**
 * Schema for document list query params.
 * Supports all attachment-key filters for filtered views
 * (load docs, driver docs, truck docs, vendor docs, customer docs).
 */
export const documentListQuerySchema = z.object({
  load_id: z.string().optional(),
  driver_id: z.string().optional(),
  truck_id: z.string().optional(),
  trailer_id: z.string().optional(),
  vendor_id: z.string().optional(),
  customer_id: z.string().optional(),
  status: z.string().optional(),
  document_type: z.string().optional(),
  search: z.string().optional(),
});

/**
 * Schema for document status/lock update via PATCH /api/documents/:id.
 */
export const documentPatchSchema = z.object({
  status: z.string().min(1).optional(),
  is_locked: z.boolean().optional(),
});
