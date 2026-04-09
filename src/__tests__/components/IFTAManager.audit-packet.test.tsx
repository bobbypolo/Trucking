/**
 * Tests R-P1-12, R-P1-13, R-P1-14: IFTAManager Audit Packet UI.
 *
 * Validates `components/IFTAManager.tsx`:
 *  - Renders the "Generate Audit Packet" button, quarter selector (1..4),
 *    and tax-year selector seeded to the current year.
 *  - Clicking the button with Q4/2025 selected calls
 *    generateIftaAuditPacket({ quarter:4, taxYear:2025, includeDocuments:true })
 *    exactly once.
 *  - After a successful response, renders the returned 64-char packetHash
 *    and a clickable download action pointing at downloadUrl.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IFTAManager } from "../../../components/IFTAManager";
import {
  LoadData,
  LOAD_STATUS,
  IFTASummary,
  MileageEntry,
} from "../../../types";

vi.mock("../../../services/financialService", () => ({
  getIFTASummary: vi.fn(),
  getMileageEntries: vi.fn(),
  saveMileageEntry: vi.fn(),
  postIFTAToLedger: vi.fn(),
  saveFuelReceipt: vi.fn(),
  getIFTAEvidence: vi.fn().mockResolvedValue([]),
  analyzeIFTA: vi.fn().mockResolvedValue(null),
  lockIFTATrip: vi.fn(),
  generateIftaAuditPacket: vi.fn(),
  listIftaAuditPackets: vi.fn().mockResolvedValue([]),
  getIftaAuditPacket: vi.fn(),
  verifyIftaAuditPacket: vi.fn(),
}));

vi.mock("../../../services/exportService", () => ({
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

import {
  getIFTASummary,
  getMileageEntries,
  generateIftaAuditPacket,
} from "../../../services/financialService";

const mockSummary: IFTASummary = {
  quarter: 4,
  year: 2025,
  rows: [
    {
      stateCode: "TX",
      totalMiles: 5000,
      totalGallons: 800,
      mpg: 6.25,
      taxPaidAtPump: 250,
      taxDue: 120,
    },
  ],
  totalMiles: 5000,
  totalGallons: 800,
  netTaxDue: 120,
};

const mockMileageEntries: MileageEntry[] = [];

const mockLoads: LoadData[] = [
  {
    id: "load-d1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-D1",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2025-10-10",
    pickup: { city: "Dallas", state: "TX", facilityName: "WH A" },
    delivery: { city: "Austin", state: "TX", facilityName: "WH B" },
    deliveryDate: "2025-10-12",
    customer: "Acme",
  } as any,
];

const FAKE_HASH = "a".repeat(64);
const FAKE_DOWNLOAD_URL = "/api/accounting/ifta-audit-packets/pkt-1/download";

describe("IFTAManager — Audit Packet UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getIFTASummary as any).mockResolvedValue(mockSummary);
    (getMileageEntries as any).mockResolvedValue(mockMileageEntries);
    (generateIftaAuditPacket as any).mockResolvedValue({
      packetId: "pkt-1",
      status: "generated",
      packetHash: FAKE_HASH,
      downloadUrl: FAKE_DOWNLOAD_URL,
      quarter: 4,
      taxYear: 2025,
    });
  });

  // ─── R-P1-12: control rendering ─────────────────────────────────────

  it('Tests R-P1-12 — renders "Generate Audit Packet" button', async () => {
    render(<IFTAManager loads={mockLoads} />);
    await waitFor(() => expect(getIFTASummary).toHaveBeenCalled());
    const button = await screen.findByRole("button", {
      name: /Generate Audit Packet/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("Tests R-P1-12 — renders an audit packet quarter selector with values 1..4", async () => {
    render(<IFTAManager loads={mockLoads} />);
    await waitFor(() => expect(getIFTASummary).toHaveBeenCalled());
    const quarterSelect = await screen.findByLabelText(/Audit Packet Quarter/i);
    expect(quarterSelect).toBeInTheDocument();
    const options = within(quarterSelect as HTMLSelectElement).getAllByRole(
      "option",
    );
    const optionValues = options.map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toEqual(["1", "2", "3", "4"]);
  });

  it("Tests R-P1-12 — renders an audit packet tax-year selector seeded to the current year", async () => {
    render(<IFTAManager loads={mockLoads} />);
    await waitFor(() => expect(getIFTASummary).toHaveBeenCalled());
    const yearSelect = (await screen.findByLabelText(
      /Audit Packet Tax Year/i,
    )) as HTMLSelectElement;
    expect(yearSelect).toBeInTheDocument();
    const currentYear = new Date().getFullYear();
    expect(yearSelect.value).toBe(String(currentYear));
  });

  // ─── R-P1-13: click handler dispatch ────────────────────────────────

  it("Tests R-P1-13 — clicking with Q4/2025 calls generateIftaAuditPacket exactly once with the expected args", async () => {
    const user = userEvent.setup();
    render(<IFTAManager loads={mockLoads} />);
    await waitFor(() => expect(getIFTASummary).toHaveBeenCalled());

    const quarterSelect = (await screen.findByLabelText(
      /Audit Packet Quarter/i,
    )) as HTMLSelectElement;
    const yearSelect = (await screen.findByLabelText(
      /Audit Packet Tax Year/i,
    )) as HTMLSelectElement;

    await user.selectOptions(quarterSelect, "4");
    await user.selectOptions(yearSelect, "2025");

    const button = await screen.findByRole("button", {
      name: /Generate Audit Packet/i,
    });
    await user.click(button);

    await waitFor(() =>
      expect(generateIftaAuditPacket).toHaveBeenCalledTimes(1),
    );
    expect(generateIftaAuditPacket).toHaveBeenCalledWith({
      quarter: 4,
      taxYear: 2025,
      includeDocuments: true,
    });
  });

  // ─── R-P1-14: result rendering ──────────────────────────────────────

  it("Tests R-P1-14 — after a successful response, renders the 64-char packetHash and a download link", async () => {
    const user = userEvent.setup();
    render(<IFTAManager loads={mockLoads} />);
    await waitFor(() => expect(getIFTASummary).toHaveBeenCalled());

    const quarterSelect = (await screen.findByLabelText(
      /Audit Packet Quarter/i,
    )) as HTMLSelectElement;
    const yearSelect = (await screen.findByLabelText(
      /Audit Packet Tax Year/i,
    )) as HTMLSelectElement;
    await user.selectOptions(quarterSelect, "4");
    await user.selectOptions(yearSelect, "2025");

    const button = await screen.findByRole("button", {
      name: /Generate Audit Packet/i,
    });
    await user.click(button);

    // Hash text appears on screen.
    const hashEl = await screen.findByText(FAKE_HASH);
    expect(hashEl).toBeInTheDocument();
    // It is exactly 64 characters.
    expect(hashEl.textContent?.length).toBe(64);

    // Download link points at downloadUrl.
    const downloadLink = (await screen.findByRole("link", {
      name: /Download Audit Packet/i,
    })) as HTMLAnchorElement;
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink.getAttribute("href")).toBe(FAKE_DOWNLOAD_URL);
  });
});
