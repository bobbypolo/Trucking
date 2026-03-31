import pool from "../db";
import admin from "../auth";
import { logger } from "./logger";

/**
 * Check if a user's tokens have been revoked by looking up the firebase_uid
 * in the revoked_tokens table.
 *
 * @param firebaseUid - The Firebase UID to check
 * @returns true if the user's tokens are revoked, false otherwise
 */
export async function isTokenRevoked(firebaseUid: string): Promise<boolean> {
  const [rows] = await pool.execute(
    "SELECT 1 FROM revoked_tokens WHERE firebase_uid = ? LIMIT 1",
    [firebaseUid],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Revoke all tokens for a user by inserting a record into the revoked_tokens
 * table and calling Firebase Admin to revoke refresh tokens.
 *
 * @param userId - The application user ID
 * @param firebaseUid - The Firebase UID
 * @param reason - Reason for revocation
 */
export async function revokeUserTokens(
  userId: string,
  firebaseUid: string,
  reason: string,
): Promise<void> {
  await pool.execute(
    "INSERT INTO revoked_tokens (user_id, firebase_uid, reason) VALUES (?, ?, ?)",
    [userId, firebaseUid, reason],
  );

  try {
    await admin.auth().revokeRefreshTokens(firebaseUid);
  } catch (error: unknown) {
    logger.error(
      { err: error, firebaseUid },
      "Failed to revoke Firebase refresh tokens",
    );
  }
}
