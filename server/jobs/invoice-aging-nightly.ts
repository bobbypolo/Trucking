/**
 * Invoice Aging Nightly Job
 *
 * Computes days_since_issued for every AR invoice and writes the result
 * back to the ar_invoices table along with the snapshot timestamp. This
 * data is the precursor to the broker-credit aging buckets that ship in
 * a later trucker-app sprint.
 */
import db from "../db";
import { logger } from "../lib/logger";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface InvoiceAgingSnapshot {
  invoiceId: string;
  daysSinceIssued: number;
  lastAgingSnapshotAt: Date;
}

export interface InvoiceAgingResult {
  updated: number;
  snapshots: InvoiceAgingSnapshot[];
}

interface InvoiceRow {
  id: string;
  issued_at: Date | string;
}

/**
 * Compute aging buckets for every AR invoice and persist them.
 *
 * @param now Snapshot timestamp; passed in for deterministic testing.
 *            Production callers should pass `new Date()`.
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
      row.issued_at instanceof Date ? row.issued_at : new Date(row.issued_at);
    const daysSinceIssued = Math.max(
      0,
      Math.floor((now.getTime() - issuedAt.getTime()) / MS_PER_DAY),
    );
    const lastAgingSnapshotAt = now;

    await db.query(
      "UPDATE ar_invoices SET days_since_issued = ?, last_aging_snapshot_at = ? WHERE id = ?",
      [daysSinceIssued, lastAgingSnapshotAt, row.id],
    );

    snapshots.push({
      invoiceId: row.id,
      daysSinceIssued,
      lastAgingSnapshotAt,
    });
  }

  logger.info(
    { count: snapshots.length },
    "invoice-aging-nightly: updated invoice aging snapshots",
  );

  return { updated: snapshots.length, snapshots };
}
