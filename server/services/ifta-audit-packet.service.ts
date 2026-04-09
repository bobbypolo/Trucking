/**
 * IFTA Audit Packet Service
 *
 * Generates a deterministic ZIP packet containing:
 *   - cover-letter.pdf
 *   - jurisdiction-summary.csv
 *   - fuel-ledger.csv
 *   - manifest.json
 *
 * The packet bytes are deterministic for the same input — repeated calls
 * to bundleAuditPacket() with the same AuditPacketInput produce the same
 * SHA-256 hash, which is used to verify packet integrity later.
 */
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { createHash } from "crypto";

export interface JurisdictionRow {
  stateCode: string;
  totalMiles: number;
  totalGallons: number;
  taxRate: number;
  taxDue: number;
}

export interface FuelLedgerRow {
  vendorName: string;
  transactionDate: string;
  stateCode: string;
  gallons: number;
  pricePerGallon: number;
  totalCost: number;
}

export interface AuditPacketInput {
  companyId: string;
  companyName: string;
  quarter: number;
  taxYear: number;
  jurisdictionRows: JurisdictionRow[];
  fuelLedgerRows: FuelLedgerRow[];
  /**
   * ISO timestamp used in manifest. Caller passes a fixed value (or "now")
   * so the packet bytes remain deterministic for the same input.
   */
  generatedAt: string;
}

/**
 * Convert an array of objects into a deterministic CSV string.
 * Header row is taken from the keys of the first row, in insertion order.
 */
function toCsv(rows: ReadonlyArray<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

/**
 * Generate a small deterministic PDF cover letter for the audit packet.
 * Uses pdfkit; the PDF creation date is forced to the input generatedAt
 * value so repeated calls with the same input produce identical bytes.
 */
function generateCoverLetterPdf(input: AuditPacketInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        info: {
          Title: `IFTA Audit Packet Q${input.quarter} ${input.taxYear}`,
          Author: input.companyName,
          CreationDate: new Date(input.generatedAt),
          ModDate: new Date(input.generatedAt),
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("IFTA Audit Packet", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Company: ${input.companyName}`);
      doc.text(`Company ID: ${input.companyId}`);
      doc.text(`Quarter: Q${input.quarter}`);
      doc.text(`Tax Year: ${input.taxYear}`);
      doc.text(`Generated: ${input.generatedAt}`);
      doc.moveDown();
      doc.text(
        `This packet contains a jurisdiction summary, fuel ledger, and manifest for ` +
          `the requested IFTA reporting period. The packet hash is computed over the ` +
          `ZIP bytes and may be used to verify integrity at any time.`,
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Bundle an IFTA audit packet into a ZIP buffer with exactly 4 entries:
 *   cover-letter.pdf, jurisdiction-summary.csv, fuel-ledger.csv, manifest.json
 *
 * The output is deterministic: identical input produces byte-identical output.
 */
export async function bundleAuditPacket(
  input: AuditPacketInput,
): Promise<Buffer> {
  const zip = new JSZip();

  const coverLetter = await generateCoverLetterPdf(input);
  zip.file("cover-letter.pdf", coverLetter, {
    date: new Date(input.generatedAt),
  });

  const jurisdictionCsv = toCsv(
    input.jurisdictionRows as unknown as Array<Record<string, unknown>>,
  );
  zip.file("jurisdiction-summary.csv", jurisdictionCsv, {
    date: new Date(input.generatedAt),
  });

  const fuelLedgerCsv = toCsv(
    input.fuelLedgerRows as unknown as Array<Record<string, unknown>>,
  );
  zip.file("fuel-ledger.csv", fuelLedgerCsv, {
    date: new Date(input.generatedAt),
  });

  const manifest = {
    companyId: input.companyId,
    companyName: input.companyName,
    quarter: input.quarter,
    taxYear: input.taxYear,
    generatedAt: input.generatedAt,
    jurisdictionCount: input.jurisdictionRows.length,
    fuelLedgerCount: input.fuelLedgerRows.length,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2), {
    date: new Date(input.generatedAt),
  });

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Compute a SHA-256 hex digest over the given packet bytes.
 * Always returns a 64-character lowercase hex string.
 */
export function computePacketHash(packetBytes: Buffer): string {
  return createHash("sha256").update(packetBytes).digest("hex");
}
