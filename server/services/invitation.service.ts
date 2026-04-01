import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import admin from "firebase-admin";
import pool from "../db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { createChildLogger } from "../lib/logger";
import { sendEmail } from "./notification-delivery.service";

const log = createChildLogger({ service: "invitation" });

/** Shape of an invitation row from the database. */
export interface InvitationRow {
  id: string;
  company_id: string;
  email: string;
  role: string;
  token: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  invited_by: string;
  expires_at: Date | string;
  accepted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** Default invitation expiry: 7 days. */
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a cryptographically secure invitation token (32 bytes, hex-encoded).
 */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create an invitation and send a notification email.
 *
 * @param companyId - The tenant that owns this invitation
 * @param email - Email address to invite
 * @param role - Role the invited user will have
 * @param invitedBy - User ID of the person sending the invite
 * @returns The created invitation record
 */
export async function createInvitation(
  companyId: string,
  email: string,
  role: string,
  invitedBy: string,
): Promise<InvitationRow> {
  const id = uuidv4();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

  await pool.query<ResultSetHeader>(
    `INSERT INTO invitations (id, company_id, email, role, token, status, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, companyId, email, role, token, invitedBy, expiresAt],
  );

  // Best-effort email notification
  try {
    const appUrl = process.env.APP_URL || "https://app.loadpilot.com";
    const acceptUrl = `${appUrl}/accept-invite?token=${token}`;
    await sendEmail({
      to: email,
      subject: "You have been invited to LoadPilot",
      body: `You have been invited to join a team on LoadPilot as a ${role}.\n\nAccept your invitation: ${acceptUrl}\n\nThis invitation expires in 7 days.`,
      html: `<p>You have been invited to join a team on LoadPilot as a <strong>${role}</strong>.</p><p><a href="${acceptUrl}">Accept Invitation</a></p><p>This invitation expires in 7 days.</p>`,
    });
  } catch (emailErr: unknown) {
    log.warn(
      { err: emailErr, email, invitationId: id },
      "Failed to send invitation email (non-blocking)",
    );
  }

  log.info({ invitationId: id, email, role }, "Invitation created");

  return {
    id,
    company_id: companyId,
    email,
    role,
    token,
    status: "pending",
    invited_by: invitedBy,
    expires_at: expiresAt.toISOString(),
    accepted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Accept an invitation by token. Validates expiry and status.
 *
 * @param token - The unique invitation token
 * @param name - Name for the new user
 * @param password - Password for the new user (hashed by caller or auth layer)
 * @returns Object with the invitation and created user ID
 * @throws Error with specific codes: INVITATION_NOT_FOUND, INVITATION_EXPIRED, INVITATION_ALREADY_ACCEPTED
 */
export async function acceptInvitation(
  token: string,
  name: string,
  password: string,
): Promise<{ invitation: InvitationRow; userId: string }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM invitations WHERE token = ?",
    [token],
  );

  if (rows.length === 0) {
    const err = new Error("Invitation not found");
    (err as Error & { code: string }).code = "INVITATION_NOT_FOUND";
    throw err;
  }

  const invitation = rows[0] as unknown as InvitationRow;

  // Check if already accepted
  if (invitation.status === "accepted") {
    const err = new Error("Invitation has already been accepted");
    (err as Error & { code: string }).code = "INVITATION_ALREADY_ACCEPTED";
    throw err;
  }

  // Check if cancelled
  if (invitation.status === "cancelled") {
    const err = new Error("Invitation has been cancelled");
    (err as Error & { code: string }).code = "INVITATION_CANCELLED";
    throw err;
  }

  // Check expiry
  const expiresAt = new Date(invitation.expires_at);
  if (expiresAt < new Date()) {
    // Mark as expired in the database
    await pool.query<ResultSetHeader>(
      "UPDATE invitations SET status = 'expired' WHERE id = ?",
      [invitation.id],
    );
    const err = new Error("Invitation has expired");
    (err as Error & { code: string }).code = "INVITATION_EXPIRED";
    throw err;
  }

  // Create Firebase Auth account
  let firebaseUid: string;
  try {
    const firebaseUser = await admin.auth().createUser({
      email: invitation.email,
      password,
      displayName: name,
      emailVerified: false,
    });
    firebaseUid = firebaseUser.uid;
  } catch (fbErr: unknown) {
    const msg =
      fbErr instanceof Error ? fbErr.message : "Firebase user creation failed";
    log.error({ err: fbErr, email: invitation.email }, msg);
    const err = new Error(msg);
    (err as Error & { code: string }).code = "FIREBASE_CREATE_FAILED";
    throw err;
  }

  // Send verification email link (best-effort)
  try {
    const verificationLink = await admin
      .auth()
      .generateEmailVerificationLink(invitation.email);
    await sendEmail({
      to: invitation.email,
      subject: "Verify your LoadPilot email",
      body: `Please verify your email address: ${verificationLink}`,
      html: `<p>Please verify your email address:</p><p><a href="${verificationLink}">Verify Email</a></p>`,
    });
  } catch (emailErr: unknown) {
    log.warn(
      { err: emailErr, email: invitation.email },
      "Failed to send verification email (non-blocking)",
    );
  }

  // Create the user record in the users table with firebase_uid
  const userId = uuidv4();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query<ResultSetHeader>(
      `INSERT INTO users (id, company_id, name, email, role, firebase_uid, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [
        userId,
        invitation.company_id,
        name,
        invitation.email,
        invitation.role,
        firebaseUid,
      ],
    );

    await conn.query<ResultSetHeader>(
      "UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = ?",
      [invitation.id],
    );

    await conn.commit();
  } catch (txErr: unknown) {
    await conn.rollback();
    // Clean up Firebase user if DB insert fails
    try {
      await admin.auth().deleteUser(firebaseUid);
    } catch (cleanupErr: unknown) {
      log.error(
        { err: cleanupErr, firebaseUid },
        "Failed to clean up Firebase user after DB rollback",
      );
    }
    throw txErr;
  } finally {
    conn.release();
  }

  log.info(
    {
      invitationId: invitation.id,
      userId,
      firebaseUid,
      email: invitation.email,
    },
    "Invitation accepted, Firebase + SQL user created",
  );

  return {
    invitation: {
      ...invitation,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    },
    userId,
  };
}

/**
 * List all invitations for a company.
 *
 * @param companyId - The tenant ID
 * @returns Array of invitation rows
 */
export async function listInvitations(
  companyId: string,
): Promise<InvitationRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM invitations WHERE company_id = ? ORDER BY created_at DESC",
    [companyId],
  );
  return rows as unknown as InvitationRow[];
}

/**
 * Cancel a pending invitation.
 *
 * @param invitationId - The invitation ID
 * @param companyId - Tenant ID for isolation
 * @returns True if the invitation was cancelled, false if not found
 */
export async function cancelInvitation(
  invitationId: string,
  companyId: string,
): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "UPDATE invitations SET status = 'cancelled' WHERE id = ? AND company_id = ? AND status = 'pending'",
    [invitationId, companyId],
  );

  if (result.affectedRows === 0) {
    return false;
  }

  log.info({ invitationId }, "Invitation cancelled");
  return true;
}
