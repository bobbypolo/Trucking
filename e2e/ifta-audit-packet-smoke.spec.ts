/**
 * E2E IFTA Audit Packet Smoke — STORY-001 Phase 1 (R-P1-15)
 *
 * Manual smoke test for the IFTA audit packet feature. This is a guarded
 * spec that only runs when IFTA_PACKET_SMOKE_ENABLED=1 is set in the
 * environment, since it requires a real backend, a seeded company, and a
 * real Q4 2025 dataset to download a packet ZIP and assert it contains at
 * least 4 entries (cover-letter.pdf, jurisdiction-summary.csv,
 * fuel-ledger.csv, manifest.json).
 *
 * Acceptance criterion (R-P1-15):
 *   In the current web app, generating a Q4 2025 packet for a seeded
 *   company downloads a .zip file that opens successfully and contains
 *   at least 4 files, including cover-letter.pdf and jurisdiction-summary.csv.
 */
import { test, expect } from "@playwright/test";
import { API_BASE } from "./fixtures/urls";
import JSZip from "jszip";

const SMOKE_ENABLED = process.env.IFTA_PACKET_SMOKE_ENABLED === "1";
const SMOKE_TOKEN = process.env.IFTA_PACKET_SMOKE_TOKEN || "";

test.describe("IFTA Audit Packet Manual Smoke (R-P1-15)", () => {
  test.skip(
    !SMOKE_ENABLED,
    "IFTA_PACKET_SMOKE_ENABLED!=1 — set to 1 with a seeded backend to run",
  );
  test.skip(
    !SMOKE_TOKEN,
    "IFTA_PACKET_SMOKE_TOKEN missing — required to authenticate against real backend",
  );

  test("Tests R-P1-15 — Q4 2025 packet downloads as .zip and opens with at least 4 files", async ({
    request,
  }) => {
    // 1. POST to generate the packet
    const generateRes = await request.post(
      `${API_BASE}/api/accounting/ifta-audit-packets`,
      {
        headers: { Authorization: `Bearer ${SMOKE_TOKEN}` },
        data: { quarter: 4, taxYear: 2025, includeDocuments: true },
      },
    );
    expect(generateRes.status()).toBe(201);
    const body = await generateRes.json();
    expect(body.packetId).toBeTruthy();
    expect(body.packetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.downloadUrl).toBeTruthy();

    // 2. GET the download URL and assert ZIP shape
    const downloadRes = await request.get(`${API_BASE}${body.downloadUrl}`, {
      headers: { Authorization: `Bearer ${SMOKE_TOKEN}` },
    });
    expect(downloadRes.status()).toBe(200);
    const buffer = Buffer.from(await downloadRes.body());
    expect(buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files).sort();
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries).toContain("cover-letter.pdf");
    expect(entries).toContain("jurisdiction-summary.csv");
    expect(entries).toContain("fuel-ledger.csv");
    expect(entries).toContain("manifest.json");
  });
});
