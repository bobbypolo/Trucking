/**
 * Disk Storage Adapter
 *
 * Implements the StorageAdapter interface using the local filesystem.
 * Files are written to a configurable base directory (default: ./uploads).
 * Suitable for development and single-server deployments where cloud
 * storage (Firebase/S3) is not required.
 */
import { join, dirname } from "path";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import type { StorageAdapter } from "./document.service";

const DEFAULT_BASE_DIR = "./uploads";

/**
 * Creates a disk-backed StorageAdapter.
 *
 * @param baseDir - Root directory for file storage. Defaults to "./uploads".
 *                  Subdirectories are created automatically on upload.
 * @returns A StorageAdapter that persists files to the local filesystem.
 */
export function createDiskStorageAdapter(
  baseDir: string = DEFAULT_BASE_DIR,
): StorageAdapter {
  return {
    /**
     * Write a file to disk at `<baseDir>/<path>`.
     * Creates intermediate directories as needed.
     */
    async uploadBlob(
      path: string,
      buffer: Buffer,
      _metadata: Record<string, string>,
    ): Promise<void> {
      const fullPath = join(baseDir, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);
    },

    /**
     * Delete a file from disk. Silently succeeds if the file does not exist.
     */
    async deleteBlob(path: string): Promise<void> {
      const fullPath = join(baseDir, path);
      await unlink(fullPath).catch(() => {
        // Swallow ENOENT — file already gone is not an error
      });
    },

    /**
     * Return a URL path suitable for the documents download endpoint.
     * The path is URI-encoded so it can be used directly in links.
     */
    async getSignedUrl(path: string, _expiresInMs: number): Promise<string> {
      // For disk storage, return a file:// URI or relative path that the
      // download endpoint can resolve to serve the actual file.
      return `disk://${path}`;
    },
  };
}
