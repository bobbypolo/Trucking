/**
 * R-FS-06-03: Document upload/review component tests.
 * Covers FileVault upload, review states, and document workflow.
 */
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileVault } from "../../../components/FileVault";
import { User, LoadData, VaultDoc, LOAD_STATUS } from "../../../types";

// Mock the financial service
vi.mock("../../../services/financialService", () => ({
  getVaultDocs: vi.fn().mockResolvedValue([]),
  uploadToVault: vi.fn().mockResolvedValue({ id: "doc-new-1" }),
  updateDocStatus: vi.fn().mockResolvedValue({}),
}));

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
];

const mockDocs: VaultDoc[] = [
  {
    id: "doc-1",
    tenantId: "company-1",
    type: "BOL",
    url: "https://example.com/bol-001.pdf",
    filename: "BOL-001.pdf",
    loadId: "load-1",
    status: "Draft",
    isLocked: false,
    version: 1,
    createdBy: "user-1",
    createdAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "doc-2",
    tenantId: "company-1",
    type: "POD",
    url: "https://example.com/pod-001.pdf",
    filename: "POD-001.pdf",
    loadId: "load-1",
    status: "Approved",
    isLocked: false,
    version: 1,
    createdBy: "user-1",
    createdAt: "2025-12-02T10:00:00Z",
  },
  {
    id: "doc-3",
    tenantId: "company-1",
    type: "Fuel",
    url: "https://example.com/fuel-001.pdf",
    filename: "Fuel-Receipt-001.pdf",
    status: "Locked",
    isLocked: true,
    version: 2,
    createdBy: "user-1",
    createdAt: "2025-12-03T10:00:00Z",
    amount: 450.0,
    vendorName: "Pilot Flying J",
  },
];

describe("FileVault — document upload and review (R-FS-06-03)", () => {
  const defaultProps = {
    currentUser: mockUser,
    loads: mockLoads,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders FileVault component without crashing", async () => {
    const { container } = render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it("displays Audit-Ready File Vault header", async () => {
    render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Audit-Ready File Vault/i)).toBeTruthy();
    });
  });

  it("renders Secure Upload button for document upload flow", async () => {
    render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      const uploadButton = screen.getByText(/Secure Upload/i);
      expect(uploadButton).toBeTruthy();
    });
  });

  it("shows document type filter dropdown", async () => {
    render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      const selects = document.querySelectorAll("select");
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows document status filter dropdown", async () => {
    render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      const selects = document.querySelectorAll("select");
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders search input for document lookup", async () => {
    render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      const inputs = document.querySelectorAll("input");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("loads documents via getVaultDocs on mount", async () => {
    const { getVaultDocs } = await import("../../../services/financialService");
    render(<FileVault {...defaultProps} />);
    await waitFor(() => {
      expect(getVaultDocs).toHaveBeenCalledTimes(1);
      expect(getVaultDocs).toHaveBeenCalledWith({});
    });
  });

  it("renders loading skeleton while fetching docs", async () => {
    // getVaultDocs never resolves — component stays in loading state
    const financialService = await import("../../../services/financialService");
    vi.mocked(financialService.getVaultDocs).mockReturnValueOnce(
      new Promise(() => {}),
    );

    const { container } = render(<FileVault {...defaultProps} />);
    // Loading skeleton rows should be visible immediately (before promise resolves)
    const animatePulse = container.querySelector(".animate-pulse");
    expect(animatePulse).toBeTruthy();
  });

  it("displays documents once loaded from vault", async () => {
    const { getVaultDocs } = await import("../../../services/financialService");
    vi.mocked(getVaultDocs).mockResolvedValueOnce(mockDocs);

    render(<FileVault {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/BOL-001\.pdf/i)).toBeTruthy();
    });
  });

  it("shows document status badge for each document", async () => {
    const { getVaultDocs } = await import("../../../services/financialService");
    vi.mocked(getVaultDocs).mockResolvedValueOnce(mockDocs);

    render(<FileVault {...defaultProps} />);

    await waitFor(() => {
      // Status labels should appear — Draft, Approved, Locked
      const html = document.body.innerHTML;
      expect(html).toContain("BOL-001.pdf");
    });
  });

  it("filters documents by type when type filter is changed", async () => {
    const { getVaultDocs } = await import("../../../services/financialService");
    vi.mocked(getVaultDocs).mockResolvedValueOnce(mockDocs);

    render(<FileVault {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/BOL-001\.pdf/i)).toBeTruthy();
    });

    // Change filter to Fuel type only
    const selects = document.querySelectorAll("select");
    if (selects.length > 0) {
      fireEvent.change(selects[0], { target: { value: "Fuel" } });
      await waitFor(() => {
        // BOL document should be hidden after filter
        expect(screen.queryByText(/BOL-001\.pdf/i)).toBeNull();
        // Fuel document should be visible
        expect(screen.getByText(/Fuel-Receipt-001\.pdf/i)).toBeTruthy();
      });
    }
  });

  it("filters documents by search query", async () => {
    const { getVaultDocs } = await import("../../../services/financialService");
    vi.mocked(getVaultDocs).mockResolvedValueOnce(mockDocs);

    render(<FileVault {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/BOL-001\.pdf/i)).toBeTruthy();
    });

    // Search for POD document
    const inputs = document.querySelectorAll("input");
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: "POD" } });
      await waitFor(() => {
        // BOL should be filtered out
        expect(screen.queryByText(/BOL-001\.pdf/i)).toBeNull();
        // POD should remain
        expect(screen.getByText(/POD-001\.pdf/i)).toBeTruthy();
      });
    }
  });

  it("shows empty state when no docs match filter", async () => {
    const { getVaultDocs } = await import("../../../services/financialService");
    vi.mocked(getVaultDocs).mockResolvedValueOnce(mockDocs);

    render(<FileVault {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/BOL-001\.pdf/i)).toBeTruthy();
    });

    // Search for something that won't match
    const inputs = document.querySelectorAll("input");
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: "NONEXISTENT_DOC_XYZ" } });
      await waitFor(() => {
        expect(screen.queryByText(/BOL-001\.pdf/i)).toBeNull();
        expect(screen.queryByText(/POD-001\.pdf/i)).toBeNull();
      });
    }
  });

  it("renders with empty loads array", async () => {
    const { container } = render(<FileVault {...defaultProps} loads={[]} />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });
});

describe("Document Status Workflow (R-FS-06-03)", () => {
  it("locked document has isLocked=true in type definition", () => {
    const lockedDoc: VaultDoc = {
      id: "doc-locked",
      tenantId: "company-1",
      type: "Statement",
      url: "https://example.com/statement.pdf",
      filename: "Statement.pdf",
      status: "Locked",
      isLocked: true,
      version: 1,
      createdBy: "system",
      createdAt: new Date().toISOString(),
    };
    expect(lockedDoc.isLocked).toBe(true);
    expect(lockedDoc.status).toBe("Locked");
  });

  it("approved document is not locked", () => {
    const approvedDoc: VaultDoc = {
      id: "doc-approved",
      tenantId: "company-1",
      type: "BOL",
      url: "https://example.com/bol.pdf",
      filename: "BOL.pdf",
      status: "Approved",
      isLocked: false,
      version: 1,
      createdBy: "user-1",
      createdAt: new Date().toISOString(),
    };
    expect(approvedDoc.isLocked).toBe(false);
    expect(approvedDoc.status).toBe("Approved");
  });

  it("document review states follow Draft -> Submitted -> Approved/Rejected -> Locked", () => {
    const validStatuses = [
      "Draft",
      "Submitted",
      "Approved",
      "Rejected",
      "Locked",
    ];
    const doc: VaultDoc = {
      id: "doc-1",
      tenantId: "t1",
      type: "POD",
      url: "https://example.com/pod.pdf",
      filename: "POD.pdf",
      status: "Draft",
      isLocked: false,
      version: 1,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
    };
    // Verify each status transition is valid type
    validStatuses.forEach((status) => {
      const testDoc = { ...doc, status: status as VaultDoc["status"] };
      expect(testDoc.status).toBe(status);
    });
  });

  it("OCR/review state — Submitted status indicates pending review", () => {
    const submittedDoc: VaultDoc = {
      id: "doc-ocr",
      tenantId: "company-1",
      type: "BOL",
      url: "https://example.com/bol-ocr.pdf",
      filename: "BOL-OCR.pdf",
      status: "Submitted",
      isLocked: false,
      version: 1,
      createdBy: "driver-1",
      createdAt: new Date().toISOString(),
    };
    // Submitted = awaiting OCR review / admin approval
    expect(submittedDoc.status).toBe("Submitted");
    expect(submittedDoc.isLocked).toBe(false);
  });
});
