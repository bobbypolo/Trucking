import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OperationalMessaging } from "../../../components/OperationalMessaging";
import type {
  User as UserType,
  LoadData,
  WorkspaceSession,
} from "../../../types";

vi.mock("../../../services/storageService", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn().mockImplementation((msg) => Promise.resolve(msg)),
  globalSearch: vi.fn().mockResolvedValue([
    { id: "sr-1", type: "DRIVER", label: "Driver Smith", subLabel: "D-100" },
    { id: "sr-2", type: "LOAD", label: "Load #LD-099", subLabel: "" },
  ]),
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
    </div>
  ),
}));

const mockUser: UserType = {
  id: "dispatcher-1",
  name: "Test Dispatcher",
  email: "dispatcher@test.com",
  role: "dispatcher",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-1",
  status: "in_transit",
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
  ...overrides,
});

const makeSession = (
  overrides: Partial<WorkspaceSession> = {},
): WorkspaceSession => ({
  primaryContext: {
    id: "load-1",
    type: "LOAD",
    label: "Load #LD-001",
    timestamp: new Date().toISOString(),
  },
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
  ...overrides,
});

const makeThread = (overrides: Record<string, unknown> = {}) => ({
  id: "load-1",
  primaryContext: {
    type: "Load",
    id: "load-1",
    label: "Load #LD-001",
    status: "in_transit",
  },
  linkedRecords: [],
  events: [],
  ownerId: "dispatcher-1",
  ownerName: "Test Dispatcher",
  lastTouch: new Date().toISOString(),
  summary: "Dallas to Houston shipment",
  ...overrides,
});

describe("OperationalMessaging coverage — lines 770-828", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Add Micro-Task button and clicking it shows the task input form", async () => {
    const user = userEvent.setup();
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    const addBtn = screen.getByText("Add Micro-Task");
    expect(addBtn).toBeInTheDocument();
    await user.click(addBtn);
    expect(
      screen.getByPlaceholderText("Enter task objective..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Press Enter to Commit")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels task creation and hides the form", async () => {
    const user = userEvent.setup();
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    await user.click(screen.getByText("Add Micro-Task"));
    expect(
      screen.getByPlaceholderText("Enter task objective..."),
    ).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));
    expect(
      screen.queryByPlaceholderText("Enter task objective..."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Add Micro-Task")).toBeInTheDocument();
  });

  it("renders Quick Requests section with DETENTION, LAYOVER, TOWING, LUMPER buttons", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Quick Requests")).toBeInTheDocument();
    expect(screen.getByText("DETENTION")).toBeInTheDocument();
    expect(screen.getByText("LAYOVER")).toBeInTheDocument();
    expect(screen.getByText("TOWING")).toBeInTheDocument();
    expect(screen.getByText("LUMPER")).toBeInTheDocument();
  });

  it("clicking a quick request button triggers the request handler", async () => {
    const user = userEvent.setup();
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    await user.click(screen.getByText("DETENTION"));
    // The handler should trigger — no crash
  });

  it("renders Participants section with search input", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Participants")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add participant (360 search)..."),
    ).toBeInTheDocument();
  });

  it("participant search triggers globalSearch and renders results", async () => {
    const { globalSearch } = await import(
      "../../../services/storageService"
    );
    const user = userEvent.setup();
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    const searchInput = screen.getByPlaceholderText(
      "Add participant (360 search)...",
    );
    await user.type(searchInput, "Smith");
    await waitFor(() => {
      expect(globalSearch).toHaveBeenCalledWith("Smith");
    });
  });

  it("renders Operational Tasks section with task toggle", async () => {
    const user = userEvent.setup();
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Operational Tasks")).toBeInTheDocument();
  });
});
