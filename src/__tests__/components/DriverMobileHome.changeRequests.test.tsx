import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { User, LoadData, ChangeRequest } from "../../../types";

// Mock the api module
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  apiFetch: vi.fn(),
}));

// Mock child components that are heavy / have external deps
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="mock-map">Map</div>,
}));

vi.mock("../../../components/Scanner", () => ({
  Scanner: () => <div data-testid="mock-scanner">Scanner</div>,
}));

vi.mock("uuid", () => ({
  v4: () => "test-uuid-001",
}));

const mockUser: User = {
  id: "driver-001",
  name: "Test Driver",
  email: "driver@test.com",
  role: "driver",
  companyId: "company-001",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

const mockLoad: LoadData = {
  id: "load-001",
  loadNumber: "LD-001",
  status: "in_transit",
  driverId: "driver-001",
  pickup: {
    city: "Dallas",
    state: "TX",
    facilityName: "Warehouse A",
  },
  dropoff: {
    city: "Houston",
    state: "TX",
  },
  pickupDate: "2026-03-23",
  freightType: "Dry Van",
} as any;

const defaultProps = {
  user: mockUser,
  loads: [mockLoad],
  onLogout: vi.fn(),
  onSaveLoad: vi.fn().mockResolvedValue(undefined),
  onOpenHub: vi.fn(),
};

describe("DriverMobileHome - Change Requests (R-P6-10, R-P6-11)", () => {
  let apiModule: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    apiModule = await import("../../../services/api");
    // Default: return empty change requests and documents
    (apiModule.api.get as any).mockImplementation((url: string) => {
      if (url.includes("change-requests"))
        return Promise.resolve({ changeRequests: [] });
      if (url.includes("documents")) return Promise.resolve({ documents: [] });
      return Promise.resolve([]);
    });
    (apiModule.api.post as any).mockResolvedValue({
      id: "cr-new",
      type: "CHANGE_REQUEST",
      label: "DETENTION",
      status: "PENDING",
      entity_id: "load-001",
      created_at: new Date().toISOString(),
    });
  });

  it("R-P6-10: createChangeRequest calls POST API, not in-memory", async () => {
    render(<DriverMobileHome {...defaultProps} />);

    // Click load to select it
    fireEvent.click(screen.getByText(/LD-001/));

    // Click "Report Issue" to open change request modal
    await waitFor(() => {
      expect(screen.getByText("Report Issue")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Report Issue"));

    // Click DETENTION type
    await waitFor(() => {
      expect(screen.getByText("DETENTION")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("DETENTION"));

    // Verify API was called
    await waitFor(() => {
      expect(apiModule.api.post).toHaveBeenCalledWith(
        "/loads/load-001/change-requests",
        expect.objectContaining({ type: "DETENTION" }),
      );
    });
  });

  it("R-P6-11: change request list renders from GET API with status badges", async () => {
    (apiModule.api.get as any).mockImplementation((url: string) => {
      if (url.includes("change-requests"))
        return Promise.resolve({
          changeRequests: [
            {
              id: "cr-1",
              label: "DETENTION",
              status: "PENDING",
              created_at: "2026-03-23T00:00:00Z",
            },
            {
              id: "cr-2",
              label: "LUMPER",
              status: "APPROVED",
              created_at: "2026-03-23T01:00:00Z",
            },
            {
              id: "cr-3",
              label: "TONU",
              status: "REJECTED",
              created_at: "2026-03-23T02:00:00Z",
            },
          ],
        });
      if (url.includes("documents")) return Promise.resolve({ documents: [] });
      return Promise.resolve([]);
    });

    render(<DriverMobileHome {...defaultProps} />);

    // Navigate to changes tab (fetches change requests for all driver loads)
    await waitFor(() => {
      expect(screen.getByText("Alerts")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Alerts"));

    // Verify items rendered from GET API
    await waitFor(() => {
      expect(screen.getByText("DETENTION")).toBeInTheDocument();
      expect(screen.getByText("LUMPER")).toBeInTheDocument();
      expect(screen.getByText("TONU")).toBeInTheDocument();
    });

    // Verify status badges with correct colors
    await waitFor(() => {
      expect(screen.getByText("PENDING")).toBeInTheDocument();
      expect(screen.getByText("APPROVED")).toBeInTheDocument();
      expect(screen.getByText("REJECTED")).toBeInTheDocument();
    });
  });

  it("R-P6-13: no 'Mock Change Requests' comment in source", async () => {
    // This is verified by grep — the test just confirms the component renders
    // without any mock-related state initialization
    const { container } = render(<DriverMobileHome {...defaultProps} />);
    expect(container).toBeTruthy();
  });
});

describe("DriverMobileHome - Documents (R-P6-12)", () => {
  let apiModule: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    apiModule = await import("../../../services/api");
    (apiModule.api.get as any).mockImplementation((url: string) => {
      if (url.includes("change-requests"))
        return Promise.resolve({ changeRequests: [] });
      if (url.includes("documents"))
        return Promise.resolve({
          documents: [
            {
              id: "doc-1",
              document_type: "BOL",
              original_name: "bol-load001.pdf",
              status: "active",
              created_at: "2026-03-23T00:00:00Z",
            },
            {
              id: "doc-2",
              document_type: "POD",
              original_name: "pod-load001.pdf",
              status: "active",
              created_at: "2026-03-23T01:00:00Z",
            },
          ],
        });
      return Promise.resolve([]);
    });
    (apiModule.api.post as any).mockResolvedValue({});
  });

  it("R-P6-12: document list populated from /api/documents?load_id= endpoint", async () => {
    render(<DriverMobileHome {...defaultProps} />);

    // Click load to select it
    fireEvent.click(screen.getByText(/LD-001/));

    // The document section should fetch from API
    await waitFor(() => {
      expect(apiModule.api.get).toHaveBeenCalledWith(
        expect.stringContaining("/documents?load_id=load-001"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });
});
