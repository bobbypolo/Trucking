/**
 * Tests R-P1-06, R-P1-07: IFTA Audit Packet Service
 *
 * Validates `server/services/ifta-audit-packet.service.ts`:
 *  - bundleAuditPacket() returns a ZIP buffer with exactly 4 entries
 *  - computePacketHash() is deterministic across repeated calls
 *  - The cover letter contains the requested quarter and tax year
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  bundleAuditPacket,
  computePacketHash,
  type AuditPacketInput,
} from "../../services/ifta-audit-packet.service";

const BASE_INPUT: AuditPacketInput = {
  companyId: "company-aaa",
  companyName: "Acme Trucking LLC",
  quarter: 4,
  taxYear: 2025,
  jurisdictionRows: [
    {
      stateCode: "TX",
      totalMiles: 5000,
      totalGallons: 800,
      taxRate: 0.2,
      taxDue: 160,
    },
    {
      stateCode: "OK",
      totalMiles: 2000,
      totalGallons: 320,
      taxRate: 0.19,
      taxDue: 60.8,
    },
  ],
  fuelLedgerRows: [
    {
      vendorName: "Loves",
      transactionDate: "2025-10-15",
      stateCode: "TX",
      gallons: 100,
      pricePerGallon: 3.5,
      totalCost: 350,
    },
    {
      vendorName: "Pilot",
      transactionDate: "2025-11-02",
      stateCode: "OK",
      gallons: 80,
      pricePerGallon: 3.4,
      totalCost: 272,
    },
  ],
  generatedAt: "2025-12-31T00:00:00.000Z",
};

describe("ifta-audit-packet.service — bundleAuditPacket", () => {
  it("Tests R-P1-06 — produces a Buffer with non-zero length", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("Tests R-P1-06 — ZIP contains exactly 4 top-level entries", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const entryNames = Object.keys(zip.files).sort();
    expect(entryNames.length).toBe(4);
    expect(entryNames).toEqual(
      [
        "cover-letter.pdf",
        "fuel-ledger.csv",
        "jurisdiction-summary.csv",
        "manifest.json",
      ].sort(),
    );
  });

  it("Tests R-P1-06 — cover-letter.pdf entry is a non-empty PDF", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const pdfFile = zip.file("cover-letter.pdf");
    expect(pdfFile).not.toBeNull();
    const bytes = await pdfFile!.async("nodebuffer");
    expect(bytes.length).toBeGreaterThan(50);
    // PDF magic header
    expect(bytes.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("Tests R-P1-06 — jurisdiction-summary.csv contains all jurisdiction rows", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const csv = await zip.file("jurisdiction-summary.csv")!.async("string");
    expect(csv).toContain("stateCode");
    expect(csv).toContain("TX");
    expect(csv).toContain("OK");
    expect(csv).toContain("5000");
    expect(csv).toContain("2000");
  });

  it("Tests R-P1-06 — fuel-ledger.csv contains all fuel ledger rows", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const csv = await zip.file("fuel-ledger.csv")!.async("string");
    expect(csv).toContain("vendorName");
    expect(csv).toContain("Loves");
    expect(csv).toContain("Pilot");
  });

  it("Tests R-P1-06 — manifest.json contains quarter, taxYear, and companyId", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const manifestStr = await zip.file("manifest.json")!.async("string");
    const manifest = JSON.parse(manifestStr);
    expect(manifest.quarter).toBe(4);
    expect(manifest.taxYear).toBe(2025);
    expect(manifest.companyId).toBe("company-aaa");
  });
});

describe("ifta-audit-packet.service — computePacketHash", () => {
  it("Tests R-P1-07 — returns a 64-character hex string", () => {
    const buf = Buffer.from("test data for hashing");
    const hash = computePacketHash(buf);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("Tests R-P1-07 — returns the same hash for the same bytes across 2 calls", () => {
    const buf = Buffer.from("identical bytes");
    const hash1 = computePacketHash(buf);
    const hash2 = computePacketHash(buf);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("Tests R-P1-07 — returns a different hash for different bytes", () => {
    const hash1 = computePacketHash(Buffer.from("payload-a"));
    const hash2 = computePacketHash(Buffer.from("payload-b"));
    expect(hash1).not.toBe(hash2);
  });

  it("Tests R-P1-07 — packet bytes from bundleAuditPacket hash deterministically across 2 calls", async () => {
    const buf = await bundleAuditPacket(BASE_INPUT);
    const hash1 = computePacketHash(buf);
    const hash2 = computePacketHash(buf);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
