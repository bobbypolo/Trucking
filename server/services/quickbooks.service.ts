/**
 * quickbooks.service.ts — QuickBooks OAuth service for LoadPilot.
 *
 * Provides:
 * - isQbConfigured() — check if QuickBooks credentials are present
 * - getAuthorizationUrl(companyId) — generate Intuit OAuth redirect URL
 * - handleCallback(companyId, authCode, realmId) — exchange auth code for tokens, encrypt, store
 * - getClient(companyId) — decrypt tokens, refresh if expired, return authenticated client
 * - syncInvoiceToQBO(companyId, invoiceData) — create Invoice in QuickBooks
 * - syncBillToQBO(companyId, billData) — create Bill in QuickBooks
 * - getConnectionStatus(companyId) — check connection state
 *
 * Token encryption: AES-256-GCM with QUICKBOOKS_TOKEN_ENCRYPTION_KEY env var.
 * Graceful degradation: all functions return structured error objects when not configured.
 *
 * @see .claude/docs/PLAN.md S-204
 */

import OAuthClient from "intuit-oauth";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import pool from "../db";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ service: "quickbooks" });

// ─── Configuration check ────────────────────────────────────

/**
 * Check whether QuickBooks OAuth is configured (client ID + secret present).
 */
export function isQbConfigured(): boolean {
  return !!(
    process.env.QUICKBOOKS_CLIENT_ID &&
    process.env.QUICKBOOKS_CLIENT_SECRET
  );
}

// ─── Result types ────────────────────────────────────────────

export type AuthUrlResult =
  | { url: string }
  | { available: false; reason: "no_api_key" };

export type CallbackResult =
  | { success: true; realmId: string }
  | { success: false; error: string; available?: false; reason?: string };

export type GetClientResult =
  | { client: OAuthClient; realmId: string }
  | { error: string; available?: false; reason?: string };

export type SyncInvoiceResult =
  | { success: true; invoiceId: string }
  | { success: false; error: string; available?: false; reason?: string };

export type SyncBillResult =
  | { success: true; billId: string }
  | { success: false; error: string; available?: false; reason?: string };

export type ConnectionStatusResult =
  | { connected: true; realmId: string; expiresAt: string }
  | { connected: false; reason: string }
  | { available: false; reason: "no_api_key" };

// ─── Encryption helpers ──────────────────────────────────────

function getEncryptionKey(): Buffer {
  const keyHex = process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("QUICKBOOKS_TOKEN_ENCRYPTION_KEY not set");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a token string with AES-256-GCM.
 * Returns base64-encoded string: iv (12 bytes) + authTag (16 bytes) + ciphertext.
 */
function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM token.
 * Input format: iv (12 bytes) + authTag (16 bytes) + ciphertext.
 */
function decryptToken(stored: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

// ─── OAuth client factory ────────────────────────────────────

function createOAuthClient(): OAuthClient | null {
  if (!isQbConfigured()) return null;
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    redirectUri:
      process.env.QUICKBOOKS_REDIRECT_URI || "http://localhost:5000/callback/quickbooks",
    environment: process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox",
  });
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Generate an authorization URL to redirect the user to QuickBooks OAuth.
 */
export async function getAuthorizationUrl(
  companyId: string,
): Promise<AuthUrlResult> {
  const oauthClient = createOAuthClient();
  if (!oauthClient) {
    log.warn("getAuthorizationUrl called without QuickBooks credentials");
    return { available: false, reason: "no_api_key" };
  }

  const url = oauthClient.authorizeUri({
    scope: OAuthClient.scopes.Accounting,
    state: companyId,
  });

  log.info({ companyId }, "Generated QuickBooks authorization URL");
  return { url };
}

/**
 * Handle the OAuth callback: exchange auth code for tokens,
 * encrypt with AES-256-GCM, and store in quickbooks_tokens table.
 */
export async function handleCallback(
  companyId: string,
  authCode: string,
  realmId: string,
): Promise<CallbackResult> {
  const oauthClient = createOAuthClient();
  if (!oauthClient) {
    return { success: false, error: "QuickBooks not configured", available: false, reason: "no_api_key" };
  }

  try {
    // Exchange authorization code for tokens
    const callbackUrl = `${process.env.QUICKBOOKS_REDIRECT_URI}?code=${authCode}&realmId=${realmId}`;
    await oauthClient.createToken(callbackUrl);

    const tokens = oauthClient.getToken();

    // Encrypt tokens before storage
    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = encryptToken(tokens.refresh_token);

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Upsert into quickbooks_tokens table
    const id = randomBytes(18).toString("hex").slice(0, 36);
    await pool.query(
      `INSERT INTO quickbooks_tokens (id, company_id, realm_id, access_token, refresh_token, token_type, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         realm_id = VALUES(realm_id),
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         token_type = VALUES(token_type),
         expires_at = VALUES(expires_at),
         updated_at = CURRENT_TIMESTAMP`,
      [id, companyId, realmId, encryptedAccess, encryptedRefresh, tokens.token_type || "bearer", expiresAt],
    );

    log.info({ companyId, realmId }, "QuickBooks tokens stored (encrypted)");
    return { success: true, realmId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, companyId }, "QuickBooks callback token exchange failed");
    return { success: false, error: message };
  }
}

/**
 * Retrieve an authenticated QuickBooks client for a company.
 * Decrypts stored tokens, refreshes if expired, re-encrypts and stores new tokens.
 */
export async function getClient(
  companyId: string,
): Promise<GetClientResult> {
  const oauthClient = createOAuthClient();
  if (!oauthClient) {
    return { error: "QuickBooks not configured", available: false, reason: "no_api_key" };
  }

  try {
    // Fetch encrypted tokens from DB
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM quickbooks_tokens WHERE company_id = ?",
      [companyId],
    );

    if (!rows || rows.length === 0) {
      return { error: "No QuickBooks tokens found for this company" };
    }

    const row = rows[0];

    // Decrypt tokens
    const accessToken = decryptToken(row.access_token);
    const refreshToken = decryptToken(row.refresh_token);

    // Set tokens on the OAuth client
    oauthClient.setToken({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: row.token_type || "bearer",
      expires_in: Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000)),
      realmId: row.realm_id,
    });

    // Check if access token is expired and refresh if needed
    if (!oauthClient.isAccessTokenValid()) {
      log.info({ companyId }, "Access token expired, refreshing");

      await oauthClient.refresh();
      const newTokens = oauthClient.getToken();

      // Re-encrypt new tokens
      const encryptedAccess = encryptToken(newTokens.access_token);
      const encryptedRefresh = encryptToken(newTokens.refresh_token);
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000);

      // Update DB with refreshed tokens
      await pool.query(
        `UPDATE quickbooks_tokens
         SET access_token = ?,
             refresh_token = ?,
             expires_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE company_id = ?`,
        [encryptedAccess, encryptedRefresh, newExpiresAt, companyId],
      );

      log.info({ companyId }, "QuickBooks tokens refreshed and re-encrypted");
    }

    return { client: oauthClient, realmId: row.realm_id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, companyId }, "Failed to get QuickBooks client");
    return { error: message };
  }
}

/**
 * Sync an invoice to QuickBooks Online.
 */
export async function syncInvoiceToQBO(
  companyId: string,
  invoiceData: {
    invoiceNumber?: string;
    customerName?: string;
    lineItems?: Array<{ description: string; amount: number; quantity?: number }>;
    amount?: number;
  },
): Promise<SyncInvoiceResult> {
  if (!isQbConfigured()) {
    return { success: false, error: "QuickBooks not configured", available: false, reason: "no_api_key" };
  }

  const clientResult = await getClient(companyId);
  if ("error" in clientResult) {
    return { success: false, error: clientResult.error, available: clientResult.available, reason: clientResult.reason };
  }

  const { client, realmId } = clientResult;

  try {
    // Map LoadPilot invoice fields to QBO Invoice format
    const qboInvoice: Record<string, unknown> = {
      DocNumber: invoiceData.invoiceNumber,
      Line: (invoiceData.lineItems || []).map((item) => ({
        Amount: item.amount,
        Description: item.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          Qty: item.quantity || 1,
          UnitPrice: item.amount / (item.quantity || 1),
        },
      })),
    };

    if (invoiceData.customerName) {
      qboInvoice.CustomerRef = { name: invoiceData.customerName };
    }

    const response = await client.makeApiCall({
      url: `v3/company/${realmId}/invoice`,
      method: "POST",
      body: qboInvoice,
    });

    const invoice = response.json?.Invoice;
    log.info(
      { companyId, invoiceId: invoice?.Id, docNumber: invoiceData.invoiceNumber },
      "Invoice synced to QuickBooks",
    );

    return { success: true, invoiceId: invoice?.Id || "" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, companyId }, "Failed to sync invoice to QuickBooks");
    return { success: false, error: message };
  }
}

/**
 * Sync a bill to QuickBooks Online.
 */
export async function syncBillToQBO(
  companyId: string,
  billData: {
    billNumber?: string;
    vendorName?: string;
    lineItems?: Array<{ description: string; amount: number; quantity?: number }>;
    amount?: number;
  },
): Promise<SyncBillResult> {
  if (!isQbConfigured()) {
    return { success: false, error: "QuickBooks not configured", available: false, reason: "no_api_key" };
  }

  const clientResult = await getClient(companyId);
  if ("error" in clientResult) {
    return { success: false, error: clientResult.error, available: clientResult.available, reason: clientResult.reason };
  }

  const { client, realmId } = clientResult;

  try {
    // Map LoadPilot bill fields to QBO Bill format
    const qboBill: Record<string, unknown> = {
      DocNumber: billData.billNumber,
      Line: (billData.lineItems || []).map((item) => ({
        Amount: item.amount,
        Description: item.description,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { name: "Expenses" },
          Qty: item.quantity || 1,
        },
      })),
    };

    if (billData.vendorName) {
      qboBill.VendorRef = { name: billData.vendorName };
    }

    const response = await client.makeApiCall({
      url: `v3/company/${realmId}/bill`,
      method: "POST",
      body: qboBill,
    });

    const bill = response.json?.Bill;
    log.info(
      { companyId, billId: bill?.Id, docNumber: billData.billNumber },
      "Bill synced to QuickBooks",
    );

    return { success: true, billId: bill?.Id || "" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, companyId }, "Failed to sync bill to QuickBooks");
    return { success: false, error: message };
  }
}

/**
 * Check QuickBooks connection status for a company.
 */
export async function getConnectionStatus(
  companyId: string,
): Promise<ConnectionStatusResult> {
  if (!isQbConfigured()) {
    return { available: false, reason: "no_api_key" };
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, company_id, realm_id, expires_at FROM quickbooks_tokens WHERE company_id = ?",
      [companyId],
    );

    if (!rows || rows.length === 0) {
      return { connected: false, reason: "no_tokens" };
    }

    const row = rows[0];
    return {
      connected: true,
      realmId: row.realm_id,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, companyId }, "Failed to check QuickBooks connection status");
    return { connected: false, reason: message };
  }
}
