import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import DataMigrationBanner from "../../../components/DataMigrationBanner";

// Mock the migration service
vi.mock("../../../services/storage/migrationService", () => ({
  getLocalDataSummary: vi.fn(),
  isMigrationComplete: vi.fn(),
  markMigrationComplete: vi.fn(),
  importDomain: vi.fn(),
  exportDomainAsJson: vi.fn(),
  discardDomain: vi.fn(),
}));

import {
  getLocalDataSummary,
  isMigrationComplete,
  markMigrationComplete,
  importDomain,
  exportDomainAsJson,
  discardDomain,
} from "../../../services/storage/migrationService";

const mockGetLocalDataSummary = getLocalDataSummary as ReturnType<typeof vi.fn>;
const mockIsMigrationComplete = isMigrationComplete as ReturnType<typeof vi.fn>;
const mockMarkMigrationComplete = markMigrationComplete as ReturnType<typeof vi.fn>;
const mockImportDomain = importDomain as ReturnType<typeof vi.fn>;
const mockExportDomainAsJson = exportDomainAsJson as ReturnType<typeof vi.fn>;
const mockDiscardDomain = discardDomain as ReturnType<typeof vi.fn>;

describe("DataMigrationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMigrationComplete.mockReturnValue(false);
    mockGetLocalDataSummary.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when migration is complete", () => {
    mockIsMigrationComplete.mockReturnValue(true);
    const { container } = render(<DataMigrationBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no local data found", () => {
    mockGetLocalDataSummary.mockReturnValue([]);
    const { container } = render(<DataMigrationBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders banner when local data exists", () => {
    mockGetLocalDataSummary.mockReturnValue([
      { domain: "contacts", count: 5, key: "loadpilot_contacts_v1" },
      { domain: "leads", count: 3, key: "loadpilot_leads_v1" },
    ]);

    render(<DataMigrationBanner />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Local Data Found (8 items)")).toBeInTheDocument();
    expect(screen.getByText(/contacts: 5 items/)).toBeInTheDocument();
    expect(screen.getByText(/leads: 3 items/)).toBeInTheDocument();
  });

  it("shows Import All and Discard All buttons", () => {
    mockGetLocalDataSummary.mockReturnValue([
      { domain: "contacts", count: 5, key: "k1" },
    ]);

    render(<DataMigrationBanner />);

    expect(screen.getByText("Import All")).toBeInTheDocument();
    expect(screen.getByText("Discard All")).toBeInTheDocument();
  });

  it("shows Export JSON button for each domain", () => {
    mockGetLocalDataSummary.mockReturnValue([
      { domain: "contacts", count: 5, key: "k1" },
      { domain: "leads", count: 3, key: "k2" },
    ]);

    render(<DataMigrationBanner />);

    const exportBtns = screen.getAllByText("Export JSON");
    expect(exportBtns).toHaveLength(2);
  });

  it("calls exportDomainAsJson when Export JSON is clicked", () => {
    mockGetLocalDataSummary.mockReturnValue([
      { domain: "contacts", count: 5, key: "k1" },
    ]);

    render(<DataMigrationBanner />);

    fireEvent.click(screen.getByText("Export JSON"));
    expect(mockExportDomainAsJson).toHaveBeenCalledWith("contacts");
  });

  it("hides banner and marks migration complete on Discard All", () => {
    mockGetLocalDataSummary.mockReturnValue([
      { domain: "contacts", count: 5, key: "k1" },
      { domain: "leads", count: 3, key: "k2" },
    ]);

    render(<DataMigrationBanner />);

    fireEvent.click(screen.getByText("Discard All"));

    expect(mockDiscardDomain).toHaveBeenCalledWith("contacts");
    expect(mockDiscardDomain).toHaveBeenCalledWith("leads");
    expect(mockMarkMigrationComplete).toHaveBeenCalled();
  });

  it("imports all domains on Import All click", async () => {
    mockGetLocalDataSummary
      .mockReturnValueOnce([
        { domain: "contacts", count: 5, key: "k1" },
      ])
      .mockReturnValueOnce([]); // After import, no data left

    mockImportDomain.mockResolvedValue({
      domain: "contacts",
      found: 5,
      imported: 5,
      skipped: 0,
      failed: 0,
      errors: [],
    });

    render(<DataMigrationBanner />);

    await act(async () => {
      fireEvent.click(screen.getByText("Import All"));
    });

    await waitFor(() => {
      expect(mockImportDomain).toHaveBeenCalledWith(
        "contacts",
        expect.any(Function),
      );
      expect(mockMarkMigrationComplete).toHaveBeenCalled();
    });
  });

  it("shows import results after import completes", async () => {
    mockGetLocalDataSummary
      .mockReturnValueOnce([
        { domain: "contacts", count: 5, key: "k1" },
      ])
      .mockReturnValueOnce([
        { domain: "contacts", count: 2, key: "k1" },
      ]); // 2 still left (failed)

    mockImportDomain.mockResolvedValue({
      domain: "contacts",
      found: 5,
      imported: 3,
      skipped: 1,
      failed: 1,
      errors: ["Item abc: server returned 500"],
    });

    render(<DataMigrationBanner />);

    await act(async () => {
      fireEvent.click(screen.getByText("Import All"));
    });

    await waitFor(() => {
      expect(screen.getByText(/3 imported/)).toBeInTheDocument();
      expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
      expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    });
  });
});
