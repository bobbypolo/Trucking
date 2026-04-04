/**
 * Firebase Storage Adapter
 *
 * Implements the StorageAdapter interface using Firebase Cloud Storage.
 * Files are stored in a Firebase Storage bucket with tenant-scoped paths:
 *   tenants/{companyId}/documents/{docId}/{filename}
 *
 * Requires FIREBASE_STORAGE_BUCKET environment variable for bucket name.
 * Uses the firebase-admin SDK initialized in server/auth.ts.
 */
import admin from "../auth";
import type { StorageAdapter } from "./document.service";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "firebase-storage-adapter" });

const DEFAULT_SIGNED_URL_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates a Firebase Cloud Storage-backed StorageAdapter.
 *
 * @param bucketName - Firebase Storage bucket name. Defaults to
 *                     process.env.FIREBASE_STORAGE_BUCKET.
 * @returns A StorageAdapter that persists files to Firebase Cloud Storage.
 */
export function createFirebaseStorageAdapter(
  bucketName?: string,
): StorageAdapter {
  const resolvedBucket =
    bucketName ?? process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = admin.storage().bucket(resolvedBucket);

  return {
    /**
     * Upload a buffer to Firebase Storage at the given path.
     * Path must be tenant-scoped: tenants/{companyId}/documents/{docId}/{filename}
     */
    async uploadBlob(
      path: string,
      buffer: Buffer,
      metadata: Record<string, string>,
    ): Promise<void> {
      const file = bucket.file(path);
      await file.save(buffer, {
        metadata: {
          contentType: metadata.contentType ?? "application/octet-stream",
          metadata, // custom metadata stored under metadata.metadata in GCS
        },
        resumable: false,
      });
      log.info({ path, size: buffer.length }, "Blob uploaded to Firebase Storage");
    },

    /**
     * Delete a blob from Firebase Storage. Silently succeeds if the file
     * does not exist (ignoreNotFound).
     */
    async deleteBlob(path: string): Promise<void> {
      const file = bucket.file(path);
      await file.delete({ ignoreNotFound: true });
      log.info({ path }, "Blob deleted from Firebase Storage");
    },

    /**
     * Generate a time-limited signed URL for downloading the blob.
     *
     * @param path - Storage path of the blob.
     * @param expiresInMs - URL validity duration in milliseconds.
     *                      Defaults to 1 hour.
     * @returns A signed URL string.
     */
    async getSignedUrl(
      path: string,
      expiresInMs: number = DEFAULT_SIGNED_URL_EXPIRY_MS,
    ): Promise<string> {
      const file = bucket.file(path);
      const expiresAt = Date.now() + expiresInMs;
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: expiresAt,
      });
      log.info({ path, expiresInMs }, "Signed URL generated");
      return url;
    },

    async readBlob(path: string): Promise<Buffer> {
      const file = bucket.file(path);
      const [buffer] = await file.download();
      return buffer;
    },
  };
}
