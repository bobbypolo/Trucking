/**
 * Reusable secret encryption service using AES-256-GCM.
 *
 * Provides encryptSecret() and decryptSecret() for encrypting sensitive
 * values at rest (API tokens, webhook secrets, OAuth tokens).
 *
 * Key source: SECRET_ENCRYPTION_KEY env var (hex-encoded 32-byte key).
 * Falls back to QUICKBOOKS_TOKEN_ENCRYPTION_KEY for backward compatibility.
 *
 * Wire format: base64(iv[12] + authTag[16] + ciphertext)
 *
 * @see .claude/docs/PLAN.md S-5.1
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ENCRYPTED_PREFIX = "enc:";

/**
 * Get the AES-256 encryption key from environment variables.
 * Prefers SECRET_ENCRYPTION_KEY, falls back to QUICKBOOKS_TOKEN_ENCRYPTION_KEY.
 * @throws {Error} if neither key is configured
 */
function getEncryptionKey(): Buffer {
  const keyHex =
    process.env.SECRET_ENCRYPTION_KEY ||
    process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "SECRET_ENCRYPTION_KEY (or QUICKBOOKS_TOKEN_ENCRYPTION_KEY) not set",
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a prefixed base64 string: "enc:" + base64(iv[12] + authTag[16] + ciphertext).
 * The prefix allows idempotent detection of already-encrypted values.
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const encoded = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  return ENCRYPTED_PREFIX + encoded;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Accepts values with or without the "enc:" prefix.
 * @throws {Error} on invalid key or tampered ciphertext
 */
export function decryptSecret(stored: string): string {
  const key = getEncryptionKey();
  const payload = stored.startsWith(ENCRYPTED_PREFIX)
    ? stored.slice(ENCRYPTED_PREFIX.length)
    : stored;
  const raw = Buffer.from(payload, "base64");
  if (raw.length < 29) {
    throw new Error("Invalid encrypted value: too short");
  }
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Check whether a value appears to be already encrypted (has the "enc:" prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Mask a secret for display purposes.
 * Returns "****" + last 4 characters. If the value is shorter than 5 chars,
 * returns "****" only.
 */
export function maskSecret(value: string): string {
  if (!value || value.length < 5) {
    return "****";
  }
  return "****" + value.slice(-4);
}
