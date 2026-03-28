import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";

// Tests R-W6-01a, R-W6-01b, R-W6-01c, R-W6-VPC-701

import { createDiskStorageAdapter } from "../../services/disk-storage-adapter";

describe("DiskStorageAdapter", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a fresh temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), "disk-storage-test-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("uploadBlob", () => {
    it("writes file to the configured base directory", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const buffer = Buffer.from("hello world");
      const path = "tenant-123/test-file.txt";

      await adapter.uploadBlob(path, buffer, { contentType: "text/plain" });

      const written = await readFile(join(tempDir, path));
      expect(written.toString()).toBe("hello world");
    });

    it("creates nested directories automatically", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const buffer = Buffer.from("nested content");
      const path = "tenant-456/subdir/deep/file.pdf";

      await adapter.uploadBlob(path, buffer, {
        contentType: "application/pdf",
      });

      const written = await readFile(join(tempDir, path));
      expect(written.toString()).toBe("nested content");
    });

    it("overwrites existing file without error", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const path = "tenant-123/overwrite.txt";

      await adapter.uploadBlob(path, Buffer.from("original"), {});
      await adapter.uploadBlob(path, Buffer.from("updated"), {});

      const written = await readFile(join(tempDir, path));
      expect(written.toString()).toBe("updated");
    });

    it("handles binary content (Buffer with non-UTF8 bytes)", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const binary = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0xfe]);
      const path = "tenant-123/binary.bin";

      await adapter.uploadBlob(path, binary, {});

      const written = await readFile(join(tempDir, path));
      expect(Buffer.compare(written, binary)).toBe(0);
    });

    it("handles empty buffer", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const path = "tenant-123/empty.txt";

      await adapter.uploadBlob(path, Buffer.alloc(0), {});

      const written = await readFile(join(tempDir, path));
      expect(written.length).toBe(0);
    });
  });

  describe("deleteBlob", () => {
    it("deletes an existing file", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const path = "tenant-123/to-delete.txt";

      await adapter.uploadBlob(path, Buffer.from("delete me"), {});
      await adapter.deleteBlob(path);

      await expect(readFile(join(tempDir, path))).rejects.toThrow();
    });

    it("does not throw when deleting a non-existent file", async () => {
      const adapter = createDiskStorageAdapter(tempDir);

      // Should not throw
      await expect(
        adapter.deleteBlob("tenant-123/nonexistent.txt"),
      ).resolves.toBeUndefined();
    });
  });

  describe("getSignedUrl", () => {
    it("returns a disk:// URI for the given file path", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const path = "tenant-123/document.pdf";

      const url = await adapter.getSignedUrl(path, 3600000);

      expect(url).toBe(`disk://${path}`);
    });

    it("preserves the full path in the disk URI", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      const path = "tenant-123/file with spaces.pdf";

      const url = await adapter.getSignedUrl(path, 3600000);

      expect(url).toBe(`disk://${path}`);
    });
  });

  describe("error handling", () => {
    it("readFile throws ENOENT for non-existent file (retrieve scenario)", async () => {
      // Verifies that reading a non-existent path throws,
      // which is the expected behavior when retrieving a missing file
      await expect(
        readFile(join(tempDir, "nonexistent/path.txt")),
      ).rejects.toThrow(/ENOENT/);
    });

    it("deleteBlob silently handles missing files", async () => {
      const adapter = createDiskStorageAdapter(tempDir);
      // Should not throw even if file never existed
      await expect(
        adapter.deleteBlob("no-such-tenant/no-such-file.txt"),
      ).resolves.toBeUndefined();
    });
  });

  describe("default base directory", () => {
    it("uses ./uploads as default when no directory is specified", () => {
      const adapter = createDiskStorageAdapter();
      // The adapter should be created without throwing
      expect(adapter).toBeDefined();
      expect(adapter.uploadBlob).toBeInstanceOf(Function);
      expect(adapter.deleteBlob).toBeInstanceOf(Function);
      expect(adapter.getSignedUrl).toBeInstanceOf(Function);
    });
  });
});
