/**
 * Tests R-P9-06: LoadDetailView renders a "Generate Agreement" button that
 * sends POST /api/agreements on click.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoadDetailView } from "../../../components/LoadDetailView";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Mock services at the network boundary
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
    post: vi.fn().mockResolvedValue({ id: "agr-1", status: "DRAFT" }),
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

import { api } from "../../../services/api";

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

const mockLoad: LoadData = {
  id: "load-1",
  companyId: "company-1",
  driverId: "driver-1",
  dispatcherId: null as any,
  brokerId: "broker-1",
  loadNumber: "LN-909",
  status: LOAD_STATUS.Planned,
  carrierRate: 3200,
  driverPay: 1900,
  pickupDate: "2025-12-05",
  dropoffDate: "2025-12-07",
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  commodity: "Electronics",
  freightType: "Dry Van",
  truckNumber: "T-202",
  trailerNumber: "TRL-77",
  legs: [],
  customerContact: {
    name: "Carl Customer",
    phone: "555-0404",
    email: "carl@cust.com",
  },
};

const baseProps = () => ({
  load: mockLoad,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  canViewRates: true,
  users: mockUsers,
  brokers: mockBrokers,
});

describe("LoadDetailView Generate Agreement button (STORY-009 Phase 9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P9-06
  it("renders a 'Generate Agreement' button in the action bar", () => {
    render(<LoadDetailView {...baseProps()} />);

    const btn = screen.getByRole("button", {
      name: /generate agreement/i,
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/generate agreement/i);
  });

  // Tests R-P9-06
  it("button sits in the same action bar as Notify Partners and Tag for Action", () => {
    render(<LoadDetailView {...baseProps()} />);
    const generateBtn = screen.getByRole("button", {
      name: /generate agreement/i,
    });
    const notifyBtn = screen.getByRole("button", {
      name: /notify partners/i,
    });
    const tagBtn = screen.getByRole("button", {
      name: /tag for action|tagged/i,
    });
    expect(generateBtn.parentElement).toBe(notifyBtn.parentElement);
    expect(generateBtn.parentElement).toBe(tagBtn.parentElement);
  });

  // Tests R-P9-06
  it("clicking the button sends POST /api/agreements with load_id and rate_con_data", async () => {
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    const btn = screen.getByRole("button", {
      name: /generate agreement/i,
    });
    await user.click(btn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    const [endpoint, payload] = (api.post as any).mock.calls[0];
    expect(endpoint).toBe("/agreements");
    expect(payload).toHaveProperty("load_id", "load-1");
    expect(payload).toHaveProperty("rate_con_data");
    expect(payload.rate_con_data).toMatchObject({
      carrierRate: 3200,
      loadNumber: "LN-909",
    });
  });

  // Tests R-P9-06
  it("shows a success toast after successful POST", async () => {
    (api.post as any).mockResolvedValueOnce({
      id: "agr-1",
      status: "DRAFT",
    });
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    await user.click(
      screen.getByRole("button", { name: /generate agreement/i }),
    );

    const toast = await screen.findByText("Agreement generated");
    expect(toast).toBeInTheDocument();
  });

  // Tests R-P9-06
  it("shows an error toast when POST /api/agreements fails", async () => {
    (api.post as any).mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    await user.click(
      screen.getByRole("button", { name: /generate agreement/i }),
    );

    const errorToast = await screen.findByText(/failed to generate agreement/i);
    expect(errorToast).toBeInTheDocument();
  });
});
