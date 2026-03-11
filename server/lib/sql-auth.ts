import type { RowDataPacket } from "mysql2/promise";
import pool from "../db";
import { logger } from "./logger";

export interface SqlUserRow extends RowDataPacket {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: string;
  password?: string | null;
  pay_model?: string | null;
  pay_rate?: number | null;
  onboarding_status?: "Pending" | "Completed" | null;
  safety_score?: number | null;
  managed_by_user_id?: string | null;
  compliance_status?: "Eligible" | "Restricted" | null;
  restriction_reason?: string | null;
  primary_workspace?: string | null;
  duty_mode?: string | null;
  phone?: string | null;
  firebase_uid?: string | null;
}

export interface SqlPrincipal {
  id: string;
  tenantId: string;
  companyId: string;
  role: string;
  email: string;
  firebaseUid: string;
}

export interface SqlCompanyRow extends RowDataPacket {
  id: string;
  name: string;
  account_type?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  tax_id?: string | null;
  phone?: string | null;
  mc_number?: string | null;
  dot_number?: string | null;
  subscription_status?: string | null;
  load_numbering_config?: unknown;
  accessorial_rates?: unknown;
  operating_mode?: string | null;
}

export interface UserWriteInput {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: string;
  passwordHash?: string | null;
  payModel?: string | null;
  payRate?: number | null;
  onboardingStatus?: "Pending" | "Completed";
  safetyScore?: number | null;
  managedByUserId?: string | null;
  complianceStatus?: "Eligible" | "Restricted" | null;
  restrictionReason?: string | null;
  primaryWorkspace?: string | null;
  dutyMode?: string | null;
  phone?: string | null;
  firebaseUid?: string | null;
}

export function mapUserRowToApiUser(row: SqlUserRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    email: row.email,
    name: row.name,
    role: row.role,
    payModel: row.pay_model ?? undefined,
    payRate:
      row.pay_rate === null || row.pay_rate === undefined
        ? undefined
        : Number(row.pay_rate),
    onboardingStatus: row.onboarding_status ?? "Pending",
    safetyScore: row.safety_score ?? 100,
    managedByUserId: row.managed_by_user_id ?? undefined,
    complianceStatus: row.compliance_status ?? undefined,
    restrictionReason: row.restriction_reason ?? undefined,
    primaryWorkspace: row.primary_workspace ?? undefined,
    dutyMode: row.duty_mode ?? undefined,
    phone: row.phone ?? undefined,
    firebaseUid: row.firebase_uid ?? undefined,
  };
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== "string") {
    return value ?? undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function mapCompanyRowToApiCompany(row: SqlCompanyRow) {
  return {
    id: row.id,
    name: row.name,
    account_type: row.account_type ?? undefined,
    accountType: row.account_type ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    tax_id: row.tax_id ?? undefined,
    taxId: row.tax_id ?? undefined,
    phone: row.phone ?? undefined,
    mc_number: row.mc_number ?? undefined,
    mcNumber: row.mc_number ?? undefined,
    dot_number: row.dot_number ?? undefined,
    dotNumber: row.dot_number ?? undefined,
    subscription_status: row.subscription_status ?? undefined,
    subscriptionStatus: row.subscription_status ?? undefined,
    load_numbering_config: parseJsonColumn(row.load_numbering_config),
    loadNumberingConfig: parseJsonColumn(row.load_numbering_config),
    accessorial_rates: parseJsonColumn(row.accessorial_rates),
    accessorialRates: parseJsonColumn(row.accessorial_rates),
    operating_mode: row.operating_mode ?? undefined,
    operatingMode: row.operating_mode ?? undefined,
  };
}

function mapRowToPrincipal(row: SqlUserRow): SqlPrincipal {
  return {
    id: row.id,
    tenantId: row.company_id,
    companyId: row.company_id,
    role: row.role,
    email: row.email,
    firebaseUid: row.firebase_uid || "",
  };
}

export async function resolveSqlPrincipalByFirebaseUid(
  firebaseUid: string,
): Promise<SqlPrincipal | null> {
  const [rows] = await pool.query<SqlUserRow[]>(
    `SELECT id, company_id, email, role, firebase_uid
       FROM users
      WHERE firebase_uid = ?
      LIMIT 1`,
    [firebaseUid],
  );

  if (!rows.length) {
    return null;
  }

  return mapRowToPrincipal(rows[0]);
}

export async function linkSqlUserToFirebaseUid(
  email: string,
  firebaseUid: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();

  const [existingRows] = await pool.query<SqlUserRow[]>(
    `SELECT id
       FROM users
      WHERE firebase_uid = ?
      LIMIT 1`,
    [firebaseUid],
  );

  if (existingRows.length > 0) {
    return true;
  }

  const [result]: any = await pool.query(
    `UPDATE users
        SET firebase_uid = ?
      WHERE LOWER(email) = ?
        AND (firebase_uid IS NULL OR firebase_uid = '')
      LIMIT 1`,
    [firebaseUid, normalizedEmail],
  );

  return Boolean(result?.affectedRows);
}

export async function findSqlUserById(
  userId: string,
): Promise<SqlUserRow | null> {
  const [rows] = await pool.query<SqlUserRow[]>(
    `SELECT *
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [userId],
  );

  return rows[0] ?? null;
}

export async function findSqlUsersByCompany(
  companyId: string,
): Promise<SqlUserRow[]> {
  const [rows] = await pool.query<SqlUserRow[]>(
    `SELECT *
       FROM users
      WHERE company_id = ?
      ORDER BY name ASC`,
    [companyId],
  );

  return rows;
}

export async function findSqlCompanyById(
  companyId: string,
): Promise<SqlCompanyRow | null> {
  const [rows] = await pool.query<SqlCompanyRow[]>(
    `SELECT *
       FROM companies
      WHERE id = ?
      LIMIT 1`,
    [companyId],
  );

  return rows[0] ?? null;
}

export async function upsertSqlUser(input: UserWriteInput): Promise<void> {
  await pool.query(
    `INSERT INTO users (
      id,
      company_id,
      email,
      password,
      name,
      role,
      pay_model,
      pay_rate,
      onboarding_status,
      safety_score,
      managed_by_user_id,
      compliance_status,
      restriction_reason,
      primary_workspace,
      duty_mode,
      phone,
      firebase_uid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      company_id = VALUES(company_id),
      email = VALUES(email),
      password = COALESCE(VALUES(password), password),
      name = VALUES(name),
      role = VALUES(role),
      pay_model = VALUES(pay_model),
      pay_rate = VALUES(pay_rate),
      onboarding_status = VALUES(onboarding_status),
      safety_score = VALUES(safety_score),
      managed_by_user_id = VALUES(managed_by_user_id),
      compliance_status = VALUES(compliance_status),
      restriction_reason = VALUES(restriction_reason),
      primary_workspace = VALUES(primary_workspace),
      duty_mode = VALUES(duty_mode),
      phone = VALUES(phone),
      firebase_uid = COALESCE(VALUES(firebase_uid), firebase_uid)`,
    [
      input.id,
      input.companyId,
      input.email,
      input.passwordHash ?? null,
      input.name,
      input.role,
      input.payModel ?? null,
      input.payRate ?? null,
      input.onboardingStatus ?? "Completed",
      input.safetyScore ?? 100,
      input.managedByUserId ?? null,
      input.complianceStatus ?? "Eligible",
      input.restrictionReason ?? null,
      input.primaryWorkspace ?? null,
      input.dutyMode ?? null,
      input.phone ?? null,
      input.firebaseUid ?? null,
    ],
  );
}

export async function mirrorUserToFirestore(
  input: UserWriteInput,
): Promise<void> {
  try {
    const { default: db } = await import("../firestore");
    await db.collection("users").doc(input.id).set(
      {
        id: input.id,
        company_id: input.companyId,
        email: input.email,
        name: input.name,
        role: input.role,
        pay_model: input.payModel ?? null,
        pay_rate: input.payRate ?? null,
        onboarding_status: input.onboardingStatus ?? "Completed",
        safety_score: input.safetyScore ?? 100,
        managed_by_user_id: input.managedByUserId ?? null,
        compliance_status: input.complianceStatus ?? "Eligible",
        restriction_reason: input.restrictionReason ?? null,
        primary_workspace: input.primaryWorkspace ?? null,
        duty_mode: input.dutyMode ?? null,
        phone: input.phone ?? null,
        firebase_uid: input.firebaseUid ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    logger.warn(
      { err: error, userId: input.id },
      "Firestore user mirror failed; SQL record remains authoritative.",
    );
  }
}
