/**
 * Tests for FileVault upload UX: progress indicator, error messages,
 * file type validation, file size validation.
 *
 * Covers: R-W5-02a, R-W5-03a, R-W5-03b, R-W5-03c, R-W5-VPC-602
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateFileType,
  validateFileSize,
} from "../../../services/storage/vault";

// --- File validation unit tests ---

describe("vault.ts file validation", () => {
  describe("validateFileType", () => {
    it("accepts PDF files", () => {
      const result = validateFileType(
        new File(["x"], "doc.pdf", { type: "application/pdf" }),
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts JPEG files", () => {
      const result = validateFileType(
        new File(["x"], "photo.jpg", { type: "image/jpeg" }),
      );
      expect(result.valid).toBe(true);
    });

    it("accepts PNG files", () => {
      const result = validateFileType(
        new File(["x"], "scan.png", { type: "image/png" }),
      );
      expect(result.valid).toBe(true);
    });

    it("accepts TIFF files", () => {
      const result = validateFileType(
        new File(["x"], "scan.tiff", { type: "image/tiff" }),
      );
      expect(result.valid).toBe(true);
    });

    it("rejects .exe files with error message", () => {
      const result = validateFileType(
        new File(["x"], "malware.exe", { type: "application/x-msdownload" }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("application/x-msdownload");
      expect(result.error).toContain("not allowed");
    });

    it("rejects .zip files with error message", () => {
      const result = validateFileType(
        new File(["x"], "archive.zip", { type: "application/zip" }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("rejects text files", () => {
      const result = validateFileType(
        new File(["x"], "notes.txt", { type: "text/plain" }),
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("validateFileSize", () => {
    it("accepts files under 10MB", () => {
      const smallFile = new File(["x".repeat(1000)], "small.pdf", {
        type: "application/pdf",
      });
      const result = validateFileSize(smallFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects files over 10MB with error message", () => {
      const bigFile = new File(["x"], "big.pdf", { type: "application/pdf" });
      Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 });
      const result = validateFileSize(bigFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("10");
      expect(result.error).toContain("MB");
    });

    it("accepts files exactly at 10MB", () => {
      const exactFile = new File(["x"], "exact.pdf", {
        type: "application/pdf",
      });
      Object.defineProperty(exactFile, "size", {
        value: 10 * 1024 * 1024,
      });
      const result = validateFileSize(exactFile);
      expect(result.valid).toBe(true);
    });
  });

  describe("constants", () => {
    it("exports ALLOWED_MIME_TYPES matching server schema", () => {
      expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
      expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
      expect(ALLOWED_MIME_TYPES).toContain("image/png");
      expect(ALLOWED_MIME_TYPES).toContain("image/tiff");
    });

    it("exports MAX_FILE_SIZE_BYTES as 10MB", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });
  });
});
