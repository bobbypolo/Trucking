/**
 * BookingPortal.extraction-mapping.test.tsx — STORY-005 Phase 5
 *
 * Verifies that after an AI extraction response, BookingPortal maps the 3
 * new fields (freightType → equipmentType, dropoffDate, specialInstructions)
 * into its state and surfaces them on the quote form.
 *
 * # Tests R-P5-04
 * @vitest-environment jsdom
 * describe(BookingPortal extraction mapping)
 */
import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BookingPortal } from "../../../components/BookingPortal";
import type { User, Company } from "../../../types";

// ---- service mocks -------------------------------------------------------

const mockGetBrokers = vi
  .fn()
  .mockResolvedValue([
    { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
  ]);
const mockGetContracts = vi.fn().mockResolvedValue([]);

vi.mock("../../../services/brokerService", () => ({
  getBrokers: (...args: unknown[]) => mockGetBrokers(...args),
  getContracts: (...args: unknown[]) => mockGetContracts(...args),
}));

const mockSaveLoad = vi.fn().mockResolvedValue(undefined);
const mockGenerateNextLoadNumber = vi.fn().mockReturnValue("LP-100");
const mockSaveQuote = vi.fn().mockResolvedValue(undefined);
const mockSaveBooking = vi.fn().mockResolvedValue(undefined);
const mockSaveLead = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../services/storageService", () => ({
  saveLoad: (...args: unknown[]) => mockSaveLoad(...args),
  generateNextLoadNumber: (...args: unknown[]) =>
    mockGenerateNextLoadNumber(...args),
  saveQuote: (...args: unknown[]) => mockSaveQuote(...args),
  saveBooking: (...args: unknown[]) => mockSaveBooking(...args),
  saveLead: (...args: unknown[]) => mockSaveLead(...args),
}));

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Co",
    loadNumberingConfig: { prefix: "LP", nextNumber: 100 },
  }),
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
}));

const mockFetch = vi.fn();

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockCompany: Company = {
  id: "company-1",
  name: "Test Co",
  accountType: "fleet",
  subscriptionTier: "Fleet Core",
  operatingMode: "Small Team",
} as Company;

// Polyfill FileReader for jsdom so BookingPortal's fileToBase64 resolves.
class FakeFileReader {
  public result: string = "";
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  readAsDataURL(_file: Blob) {
    // Simulate async success
    setTimeout(() => {
      this.result = "data:image/png;base64,ZmFrZWRhdGE=";
      this.onload?.();
    }, 0);
  }
}

const originalFileReader = (
  globalThis as unknown as { FileReader?: typeof FileReader }
).FileReader;

describe("BookingPortal extraction mapping (STORY-005)", () => {
  const defaultProps = {
    user: mockUser,
    company: mockCompany,
    onBookingComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBrokers.mockResolvedValue([
      { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
    ]);
    mockGetContracts.mockResolvedValue([]);
    // Default AI extraction response — includes all 3 new fields under load.
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        loadInfo: {
          load: {
            pickup: { city: "Denver", state: "CO" },
            dropoff: { city: "Phoenix", state: "AZ" },
            carrierRate: 2500,
            freightType: "Reefer",
            dropoffDate: "2026-04-20",
            specialInstructions: "Driver assist unload; call 2hr out",
          },
          broker: { name: "Alpha Logistics" },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
    (globalThis as unknown as { FileReader: typeof FileReader }).FileReader =
      FakeFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalFileReader) {
      (globalThis as unknown as { FileReader: typeof FileReader }).FileReader =
        originalFileReader;
    }
  });

  /**
   * Helper that renders the portal and drives the AI extraction flow by
   * firing a synthetic file-upload event on the hidden file input. Returns
   * once the flow has advanced to the quote step.
   */
  const runExtractionFlow = async () => {
    const { container } = render(<BookingPortal {...defaultProps} />);
    await screen.findByText("Intake & Quotes");
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    const file = new File(["fake"], "rate-con.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } });
    });
    return { container };
  };

  // Tests R-P5-04
  it("R-P5-04: maps data.freightType to equipmentType select on the quote form", async () => {
    await runExtractionFlow();
    // After extraction succeeds the quote step is rendered. The equipment
    // select should reflect the extracted freightType value.
    const equipmentSelect = (await screen.findByLabelText(
      /Equipment Type/i,
    )) as HTMLSelectElement;
    expect(equipmentSelect.value).toBe("Reefer");
  });

  it("R-P5-04: maps data.dropoffDate from extraction into component state", async () => {
    const { container } = await runExtractionFlow();
    await screen.findByLabelText(/Equipment Type/i);
    // The component exposes the extracted dropoff date via a data attribute
    // on a dedicated element so tests do not depend on visual layout.
    const el = container.querySelector(
      '[data-testid="extracted-dropoff-date"]',
    );
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("2026-04-20");
  });

  it("R-P5-04: maps data.specialInstructions from extraction into component state", async () => {
    const { container } = await runExtractionFlow();
    await screen.findByLabelText(/Equipment Type/i);
    const el = container.querySelector(
      '[data-testid="extracted-special-instructions"]',
    );
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("Driver assist unload; call 2hr out");
  });

  // Regression — legacy fields (pickup/dropoff/rate) are still mapped so we
  // do not regress earlier phases by adding the new fields.
  it("regression: existing pickup/dropoff/rate mapping still works", async () => {
    await runExtractionFlow();
    // The pickup input renders city and state combined as "Denver, CO"
    await waitFor(() => {
      expect(screen.getByDisplayValue("Denver, CO")).toBeTruthy();
    });
  });
});
