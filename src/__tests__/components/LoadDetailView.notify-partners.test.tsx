import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
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
  loadNumber: "LN-500",
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
  customerContact: {
    name: "Cathy Customer",
    phone: "555-0303",
    email: "cathy@cust.com",
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

describe("LoadDetailView notify partners (STORY-004 Phase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P4-01
  it("renders a 'Notify Partners' button in the action bar adjacent to 'Tag for Action'", () => {
    render(<LoadDetailView {...baseProps()} />);

    const notifyButton = screen.getByRole("button", {
      name: /notify partners/i,
    });
    expect(notifyButton).toBeInTheDocument();
    expect(notifyButton).toHaveTextContent("Notify Partners");

    const tagButton = screen.getByRole("button", {
      name: /tag for action/i,
    });
    expect(tagButton).toBeInTheDocument();

    // Verify the two buttons share a parent container (action bar)
    const notifyParent = notifyButton.parentElement;
    const tagParent = tagButton.parentElement;
    expect(notifyParent).not.toBeNull();
    expect(notifyParent).toBe(tagParent);
  });

  // Tests R-P4-02
  it("opens an inline modal with broker, driver, and customerContact checkboxes when clicked", async () => {
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    // Modal should not be present initially — assert by absence of dialog title
    expect(
      screen.queryByRole("heading", { name: /notify partners/i }),
    ).not.toBeInTheDocument();

    const notifyButton = screen.getByRole("button", {
      name: /notify partners/i,
    });
    await user.click(notifyButton);

    // Modal heading appears
    const dialog = await screen.findByRole("dialog", {
      name: /notify partners/i,
    });
    expect(dialog).toBeInTheDocument();

    // Three contact checkboxes within the dialog
    const checkboxes = within(dialog).getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3);

    // Verify each contact source is represented as a labeled checkbox
    expect(
      within(dialog).getByLabelText(/alpha logistics/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/john driver/i)).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(/cathy customer/i),
    ).toBeInTheDocument();
  });

  // Tests R-P4-03
  it("submits POST /api/notification-jobs with channel:'Multi', recipients[], and message", async () => {
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /notify partners/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /notify partners/i,
    });

    // Select broker and driver checkboxes (customerContact remains unchecked)
    const brokerCheckbox = within(dialog).getByLabelText(/alpha logistics/i);
    const driverCheckbox = within(dialog).getByLabelText(/john driver/i);
    await user.click(brokerCheckbox);
    await user.click(driverCheckbox);

    // Type a message
    const textarea = within(dialog).getByRole("textbox", {
      name: /message/i,
    });
    await user.type(textarea, "Pickup is delayed by 2 hours.");

    // Submit
    const sendButton = within(dialog).getByRole("button", {
      name: /^send notification$/i,
    });
    await user.click(sendButton);

    // Verify api.post was called with the right shape
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    const [endpoint, payload] = (api.post as any).mock.calls[0];
    expect(endpoint).toBe("/notification-jobs");
    expect(payload.channel).toBe("Multi");
    expect(payload.message).toBe("Pickup is delayed by 2 hours.");
    expect(Array.isArray(payload.recipients)).toBe(true);
    expect(payload.recipients.length).toBe(2);
    const ids = payload.recipients.map((r: any) => r.id).sort();
    expect(ids).toEqual(["broker-1", "driver-1"]);
    expect(payload.loadId).toBe("load-1");
  });

  // Tests R-P4-04
  it("shows a success toast 'Notification sent' when POST returns 200", async () => {
    (api.post as any).mockResolvedValueOnce({
      id: "job-1",
      status: "PENDING",
    });
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /notify partners/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /notify partners/i,
    });

    await user.click(within(dialog).getByLabelText(/alpha logistics/i));
    await user.type(
      within(dialog).getByRole("textbox", { name: /message/i }),
      "Hello",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /^send notification$/i }),
    );

    const toast = await screen.findByText("Notification sent");
    expect(toast).toBeInTheDocument();
  });

  // Tests R-P4-05
  it("shows an error toast when POST /api/notification-jobs fails with status >= 400", async () => {
    (api.post as any).mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    render(<LoadDetailView {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /notify partners/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /notify partners/i,
    });

    await user.click(within(dialog).getByLabelText(/alpha logistics/i));
    await user.type(
      within(dialog).getByRole("textbox", { name: /message/i }),
      "Hello",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /^send notification$/i }),
    );

    const errorToast = await screen.findByText(/failed to send notification/i);
    expect(errorToast).toBeInTheDocument();
  });
});
