/**
 * Invoice Aging Nightly Job
 *
 * Computes aging_bucket for every AR invoice based on days since issued_at.
 * Buckets: current (0), 1_30 (1-30), 31_60 (31-60), 61_90 (61-90), 90_plus (>90).
 */
import db from "../db";
import { logger } from "../lib/logger";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface InvoiceAgingSnapshot {
  invoiceId: string;
  daysSinceIssued: number;
  agingBucket: string | null;
  lastAgingSnapshotAt: Date;
}

export interface InvoiceAgingResult {
  updated: number;
  snapshots: InvoiceAgingSnapshot[];
}

interface InvoiceRow {
  id: string;
  issued_at: Date | string | null;
}

/**
 * Compute the aging bucket for an invoice based on its issued_at date.
 *
 * @param issuedAt The date the invoice was issued, or null.
 * @param now      Reference timestamp for "today".
 * @returns One of 'current', '1_30', '31_60', '61_90', '90_plus', or null if issuedAt is null.
 */
export function computeAgingBucket(
  issuedAt: Date | null,
  now: Date = new Date(),
): string | null {
  if (issuedAt === null) {
    return null;
  }

  const age = Math.floor((now.getTime() - issuedAt.getTime()) / MS_PER_DAY);

  if (age <= 0) {
    return "current";
  }
  if (age <= 30) {
    return "1_30";
  }
  if (age <= 60) {
    return "31_60";
  }
  if (age <= 90) {
    return "61_90";
  }
  return "90_plus";
}

/**
 * Run the nightly invoice aging job.
 *
 * Reads all AR invoices, computes aging bucket for each, and persists
 * the bucket assignment along with days_since_issued and a snapshot timestamp.
 *
 * @param now Snapshot timestamp; passed in for deterministic testing.
 */
export async function runInvoiceAgingNightly(
  now: Date,
): Promise<InvoiceAgingResult> {
  const [rows] = (await db.query("SELECT id, issued_at FROM ar_invoices")) as [
    InvoiceRow[],
    unknown,
  ];

  if (!rows || rows.length === 0) {
    return { updated: 0, snapshots: [] };
  }

  const snapshots: InvoiceAgingSnapshot[] = [];
  for (const row of rows) {
    const issuedAt =
      row.issued_at === null
        ? null
        : row.issued_at instanceof Date
          ? row.issued_at
          : new Date(row.issued_at);

    const agingBucket = computeAgingBucket(issuedAt, now);
    const daysSinceIssued =
      issuedAt === null
        ? 0
        : Math.max(
            0,
            Math.floor((now.getTime() - issuedAt.getTime()) / MS_PER_DAY),
          );

    await db.query(
      "UPDATE ar_invoices SET days_since_issued = ?, aging_bucket = ?, last_aging_snapshot_at = ? WHERE id = ?",
      [daysSinceIssued, agingBucket, now, row.id],
    );

    snapshots.push({
      invoiceId: row.id,
      daysSinceIssued,
      agingBucket,
      lastAgingSnapshotAt: now,
    });
  }

  logger.info(
    { count: snapshots.length },
    "invoice-aging-nightly: updated invoice aging snapshots",
  );

  return { updated: snapshots.length, snapshots };
}
