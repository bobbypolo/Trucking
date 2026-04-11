import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoadDetailView } from "../../../components/LoadDetailView";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Mock services at the network boundary — we verify outbound fetch calls,
// not storage internals.
vi.mock("../../../services/financialService", () => ({
  getVaultDocs: vi.fn().mockResolvedValue([]),
  createARInvoice: vi.fn().mockResolvedValue({ id: "inv-1" }),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
  generateBolPDF: vi.fn(),
}));

vi.mock("../../../services/storage/vault", () => ({
  getDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ documents: [] }),
    post: vi.fn().mockResolvedValue({ id: "job-1", status: "PENDING" }),
  },
}));

vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  onUserChange: vi.fn(() => () => {}),
}));

vi.mock("../../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    id: "user-1",
    name: "Admin",
    role: "admin",
    companyId: "company-1",
  }),
}));

vi.mock("../../../hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

const mockUsers: User[] = [
  {
    id: "driver-1",
    name: "John Driver",
    role: "driver",
    companyId: "c1",
    email: "j@t.com",
    onboardingStatus: "Completed",
    safetyScore: 90,
    phone: "555-0101",
  } as User,
];

const mockBrokers: Broker[] = [
  {
    id: "broker-1",
    name: "Alpha Logistics",
    mcNumber: "MC-123",
    isShared: true,
    clientType: "Broker",
    approvedChassis: [],
    contactPhone: "555-0202",
  } as Broker,
];

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-42",
  companyId: "company-1",
  driverId: "driver-1",
  dispatcherId: null as any,
  brokerId: "broker-1",
  loadNumber: "LN-600",
  status: LOAD_STATUS.Planned,
  carrierRate: 3000,
  driverPay: 1800,
  pickupDate: "2025-12-01",
  dropoffDate: "2025-12-03",
  pickup: { city: "Los Angeles", state: "CA" },
  dropoff: { city: "Phoenix", state: "AZ" },
  commodity: "Furniture",
  freightType: "Dry Van",
  truckNumber: "T-101",
  trailerNumber: "TRL-55",
  legs: [],
  isActionRequired: false,
  ...overrides,
});

const baseProps = (load: LoadData) => ({
  load,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  canViewRates: true,
  users: mockUsers,
  brokers: mockBrokers,
});

describe("LoadDetailView Tag for Action dispatch event (STORY-006 Phase 6)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "evt-1" }),
    });
    // Install fetch mock on the window/global — LoadDetailView uses raw fetch
    // for /api/dispatch-events POSTs.
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Tests R-P6-01
  it("sends POST /api/dispatch-events with event_type ACTION_TAGGED when tagging a load", async () => {
    const user = userEvent.setup();
    render(
      <LoadDetailView {...baseProps(makeLoad({ isActionRequired: false }))} />,
    );

    const tagButton = screen.getByRole("button", { name: /tag for action/i });
    await user.click(tagButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/dispatch-events");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.event_type).toBe("ACTION_TAGGED");
    expect(body.load_id).toBe("load-42");
  });

  // Tests R-P6-02
  it("sends POST /api/dispatch-events with event_type ACTION_UNTAGGED when removing a tag", async () => {
    const user = userEvent.setup();
    render(
      <LoadDetailView {...baseProps(makeLoad({ isActionRequired: true }))} />,
    );

    // When a load is already tagged, the button label toggles to "Tagged".
    const untagButton = screen.getByRole("button", { name: /^tagged$/i });
    await user.click(untagButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/dispatch-events");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.event_type).toBe("ACTION_UNTAGGED");
    expect(body.load_id).toBe("load-42");
  });

  // Tests R-P6-03
  it("does NOT render an error toast when the dispatch event POST fails with status >= 400", async () => {
    // First call: the event POST that fails. Reject with a 500 response so the
    // component's fire-and-forget wrapper must swallow the failure silently.
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    });

    const user = userEvent.setup();
    render(
      <LoadDetailView {...baseProps(makeLoad({ isActionRequired: false }))} />,
    );

    const tagButton = screen.getByRole("button", { name: /tag for action/i });
    await user.click(tagButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // The tag itself still succeeds (saveLoad resolves), so the success toast
    // appears; the blueprint is that the dispatch-event failure does NOT
    // surface a failure toast containing "Failed".
    expect(screen.queryByText(/Failed/)).toBeNull();
  });
});
