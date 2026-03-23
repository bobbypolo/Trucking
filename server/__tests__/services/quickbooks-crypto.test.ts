import { describe, it, expect } from "vitest";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// Tests R-P2-18 (real crypto roundtrip — no mocks)

describe("R-P2-18: AES-256-GCM token encrypt/decrypt roundtrip", () => {
  const key = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex",
  );

  it("roundtrip preserves original token value", () => {
    const originalToken =
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test-token-value-roundtrip";

    // Encrypt (same format as quickbooks.service.ts encryptToken)
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(originalToken, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Storage format: iv (12 bytes) + authTag (16 bytes) + ciphertext
    const stored = Buffer.concat([iv, authTag, encrypted]).toString("base64");

    // Decrypt (same format as quickbooks.service.ts decryptToken)
    const raw = Buffer.from(stored, "base64");
    const decIv = raw.subarray(0, 12);
    const decAuthTag = raw.subarray(12, 28);
    const decCiphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, decIv);
    decipher.setAuthTag(decAuthTag);
    const decrypted = Buffer.concat([
      decipher.update(decCiphertext),
      decipher.final(),
    ]).toString("utf8");

    expect(decrypted).toBe(originalToken);
  });

  it("different IVs produce different ciphertexts for same plaintext", () => {
    const plaintext = "same-value-for-both";

    const iv1 = randomBytes(12);
    const cipher1 = createCipheriv("aes-256-gcm", key, iv1);
    const enc1 = Buffer.concat([cipher1.update(plaintext, "utf8"), cipher1.final()]);
    const stored1 = Buffer.concat([iv1, cipher1.getAuthTag(), enc1]).toString("base64");

    const iv2 = randomBytes(12);
    const cipher2 = createCipheriv("aes-256-gcm", key, iv2);
    const enc2 = Buffer.concat([cipher2.update(plaintext, "utf8"), cipher2.final()]);
    const stored2 = Buffer.concat([iv2, cipher2.getAuthTag(), enc2]).toString("base64");

    // Different IVs mean different ciphertexts
    expect(stored1).not.toBe(stored2);

    // But both decrypt to the same value
    const raw1 = Buffer.from(stored1, "base64");
    const dec1 = createDecipheriv("aes-256-gcm", key, raw1.subarray(0, 12));
    dec1.setAuthTag(raw1.subarray(12, 28));
    const plain1 = Buffer.concat([dec1.update(raw1.subarray(28)), dec1.final()]).toString("utf8");

    const raw2 = Buffer.from(stored2, "base64");
    const dec2 = createDecipheriv("aes-256-gcm", key, raw2.subarray(0, 12));
    dec2.setAuthTag(raw2.subarray(12, 28));
    const plain2 = Buffer.concat([dec2.update(raw2.subarray(28)), dec2.final()]).toString("utf8");

    expect(plain1).toBe(plaintext);
    expect(plain2).toBe(plaintext);
  });

  it("tampered ciphertext fails authentication", () => {
    const plaintext = "sensitive-data-value";

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const stored = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);

    // Tamper with the ciphertext (flip a bit)
    stored[30] ^= 0xff;

    const raw = Buffer.from(stored);
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));

    expect(() => {
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    }).toThrow();
  });
});
