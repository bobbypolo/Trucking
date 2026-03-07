import { describe, it, expect } from "vitest";

// Tests R-P3-01-AC2

import {
  sanitizeFilename,
  hasAllowedExtension,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  documentUploadSchema,
} from "../../schemas/document.schema";

describe("R-P3-01-AC2: Document Schema Validation", () => {
  describe("sanitizeFilename", () => {
    it("passes through clean filenames unchanged", () => {
      expect(sanitizeFilename("invoice.pdf")).toBe("invoice.pdf");
      expect(sanitizeFilename("photo-2024.jpg")).toBe("photo-2024.jpg");
      expect(sanitizeFilename("scan_001.png")).toBe("scan_001.png");
    });

    it("strips path traversal sequences", () => {
      const result = sanitizeFilename("../../../etc/passwd.pdf");
      expect(result).not.toContain("..");
      expect(result).not.toContain("/");
      expect(result.endsWith(".pdf")).toBe(true);
    });

    it("strips backslash path traversal", () => {
      const result = sanitizeFilename("..\\..\\windows\\system32\\evil.pdf");
      expect(result).not.toContain("..");
      expect(result).not.toContain("\\");
    });

    it("replaces special characters with underscores", () => {
      const result = sanitizeFilename("file name (copy).pdf");
      expect(result).not.toContain(" ");
      expect(result).not.toContain("(");
      expect(result).not.toContain(")");
    });

    it("collapses consecutive underscores", () => {
      const result = sanitizeFilename("file___name.pdf");
      expect(result).not.toContain("___");
    });

    it("returns fallback for empty filename", () => {
      expect(sanitizeFilename("")).toBe("unnamed_document");
    });

    it("returns fallback for dot-only filename", () => {
      expect(sanitizeFilename("..")).toBe("unnamed_document");
    });

    it("caps filename at 255 characters", () => {
      const longName = "a".repeat(300) + ".pdf";
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe("hasAllowedExtension", () => {
    it("accepts .pdf", () => {
      expect(hasAllowedExtension("file.pdf")).toBe(true);
    });

    it("accepts .jpg", () => {
      expect(hasAllowedExtension("photo.jpg")).toBe(true);
    });

    it("accepts .jpeg", () => {
      expect(hasAllowedExtension("photo.jpeg")).toBe(true);
    });

    it("accepts .png", () => {
      expect(hasAllowedExtension("scan.png")).toBe(true);
    });

    it("accepts .tiff", () => {
      expect(hasAllowedExtension("scan.tiff")).toBe(true);
    });

    it("accepts .tif", () => {
      expect(hasAllowedExtension("scan.tif")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(hasAllowedExtension("FILE.PDF")).toBe(true);
      expect(hasAllowedExtension("photo.JPG")).toBe(true);
    });

    it("rejects .exe", () => {
      expect(hasAllowedExtension("malware.exe")).toBe(false);
    });

    it("rejects .html", () => {
      expect(hasAllowedExtension("page.html")).toBe(false);
    });

    it("rejects .js", () => {
      expect(hasAllowedExtension("script.js")).toBe(false);
    });

    it("rejects files with no extension", () => {
      expect(hasAllowedExtension("noextension")).toBe(false);
    });
  });

  describe("constants", () => {
    it("MAX_FILE_SIZE_BYTES is 10MB", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it("ALLOWED_EXTENSIONS includes pdf, jpg, jpeg, png, tiff, tif", () => {
      expect(ALLOWED_EXTENSIONS).toContain(".pdf");
      expect(ALLOWED_EXTENSIONS).toContain(".jpg");
      expect(ALLOWED_EXTENSIONS).toContain(".jpeg");
      expect(ALLOWED_EXTENSIONS).toContain(".png");
      expect(ALLOWED_EXTENSIONS).toContain(".tiff");
      expect(ALLOWED_EXTENSIONS).toContain(".tif");
    });

    it("ALLOWED_MIME_TYPES includes standard document types", () => {
      expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
      expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
      expect(ALLOWED_MIME_TYPES).toContain("image/png");
      expect(ALLOWED_MIME_TYPES).toContain("image/tiff");
    });
  });

  describe("documentUploadSchema", () => {
    it("validates valid upload metadata", () => {
      const result = documentUploadSchema.safeParse({
        document_type: "invoice",
        description: "Test doc",
        load_id: "load-001",
      });
      expect(result.success).toBe(true);
    });

    it("requires document_type", () => {
      const result = documentUploadSchema.safeParse({
        description: "Test doc",
      });
      expect(result.success).toBe(false);
    });

    it("allows optional load_id", () => {
      const result = documentUploadSchema.safeParse({
        document_type: "bol",
      });
      expect(result.success).toBe(true);
    });
  });
});
