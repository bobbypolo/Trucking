import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User, Company } from "../../../types";

// Mock Scanner to avoid camera/AI API calls
vi.mock("../../../components/Scanner", () => ({
  Scanner: ({
    onDataExtracted,
    onCancel,
  }: {
    onDataExtracted: (data: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="scanner-mock">
      <button
        data-testid="scanner-extract"
        onClick={() => onDataExtracted({ docType: "BOL", confidence: 0.95 })}
      >
        Extract
      </button>
      <button data-testid="scanner-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

// Mock GlobalMapViewEnhanced to avoid Google Maps API
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock">Map</div>,
}));

// Mock api to prevent real API calls from useEffect hooks
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes("change-requests"))
        return Promise.resolve({ changeRequests: [] });
      if (url.includes("documents")) return Promise.resolve({ documents: [] });
      return Promise.resolve([]);
    }),
    post: vi.fn().mockResolvedValue({
      id: "cr-new",
      type: "CHANGE_REQUEST",
      label: "DETENTION",
      status: "PENDING",
      entity_id: "load-1",
      created_at: new Date().toISOString(),
    }),
  },
  apiFetch: vi.fn(),
}));

// Mock Toast to render visible content
vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
    onDismiss,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
      <button data-testid="toast-dismiss" onClick={onDismiss}>
        dismiss
      </button>
    </div>
  ),
}));

// Mock ConfirmDialog to render real buttons when open
vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div
        data-testid={`confirm-dialog-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>{confirmLabel || "Confirm"}</button>
        <button onClick={onCancel}>{cancelLabel || "Cancel"}</button>
      </div>
    ) : null,
}));

// Mock InputDialog to render input + submit when open
vi.mock("../../../components/ui/InputDialog", () => ({
  InputDialog: ({
    open,
    title,
    placeholder,
    submitLabel,
    onSubmit,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    placeholder?: string;
    submitLabel?: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div
        data-testid={`input-dialog-${title.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span>{title}</span>
        <input
          data-testid="breakdown-notes-input"
          placeholder={placeholder}
          defaultValue=""
        />
        <button onClick={() => onSubmit("Engine overheating on I-40")}>
          {submitLabel || "Submit"}
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const mockUser: User = {
  id: "driver-1",
  name: "Test Driver",
  email: "driver@test.com",
  role: "driver",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-1",
  status: "planned",
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
  ...overrides,
});

describe("DriverMobileHome deep coverage — lines 741-749, 861-949", () => {
  let onSaveLoad: MockedFunction<(load: LoadData) => Promise<void>>;
  let onLogout: MockedFunction<() => void>;
  let onOpenHub: MockedFunction<
    (tab?: "feed" | "messaging" | "intelligence" | "reports") => void
  >;

  beforeEach(() => {
    onSaveLoad = vi
      .fn<(load: LoadData) => Promise<void>>()
      .mockResolvedValue(undefined);
    onLogout = vi.fn<() => void>();
    onOpenHub =
      vi.fn<
        (tab?: "feed" | "messaging" | "intelligence" | "reports") => void
      >();
    localStorage.clear();
  });

  describe("change requests tab — add button and display (lines 741-749)", () => {
    it("renders the add change request button on changes tab", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Alerts"));
      expect(screen.getByText("Change Requests")).toBeInTheDocument();
    });

    it("shows created change requests after creating one from detail view", async () => {
      const { api: apiMock } = await import("../../../services/api");
      // After a POST, simulate GET returning the created item
      let createdRequests: any[] = [];
      (apiMock.post as any).mockImplementation(
        async (_url: string, body: any) => {
          const item = {
            id: "cr-new",
            type: "CHANGE_REQUEST",
            label: body.type,
            status: "PENDING",
            entity_id: "load-1",
            created_at: new Date().toISOString(),
          };
          createdRequests.push(item);
          return item;
        },
      );
      (apiMock.get as any).mockImplementation((url: string) => {
        if (url.includes("change-requests"))
          return Promise.resolve({ changeRequests: [...createdRequests] });
        if (url.includes("documents"))
          return Promise.resolve({ documents: [] });
        return Promise.resolve([]);
      });

      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      // Navigate to detail, open report issue modal, create a DETENTION request
      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("DETENTION")).toBeInTheDocument();
      });
      await user.click(screen.getByText("DETENTION"));

      // Navigate to changes tab to see the created change request
      await user.click(screen.getByText("Back"));
      await user.click(screen.getByText("Alerts"));
      await waitFor(() => {
        expect(screen.getByText("DETENTION")).toBeInTheDocument();
        expect(screen.getByText("PENDING")).toBeInTheDocument();
      });
    });

    it("shows LUMPER change request type and date after creation", async () => {
      const { api: apiMock } = await import("../../../services/api");
      let createdRequests: any[] = [];
      (apiMock.post as any).mockImplementation(
        async (_url: string, body: any) => {
          const item = {
            id: "cr-new-2",
            type: "CHANGE_REQUEST",
            label: body.type,
            status: "PENDING",
            entity_id: "load-1",
            created_at: new Date().toISOString(),
          };
          createdRequests.push(item);
          return item;
        },
      );
      (apiMock.get as any).mockImplementation((url: string) => {
        if (url.includes("change-requests"))
          return Promise.resolve({ changeRequests: [...createdRequests] });
        if (url.includes("documents"))
          return Promise.resolve({ documents: [] });
        return Promise.resolve([]);
      });

      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("LUMPER")).toBeInTheDocument();
      });
      await user.click(screen.getByText("LUMPER"));

      // Go to changes tab
      await user.click(screen.getByText("Back"));
      await user.click(screen.getByText("Alerts"));
      await waitFor(() => {
        expect(screen.getByText("LUMPER")).toBeInTheDocument();
      });
    });
  });

  describe("breakdown flow — InputDialog notes (lines 861-877)", () => {
    it("opens Report Breakdown notes InputDialog from detail view", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));

      // InputDialog should appear for notes
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
    });

    it("cancels breakdown notes dialog and returns to idle", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });

      // Cancel the dialog
      await user.click(screen.getByText("Cancel"));
      expect(
        screen.queryByTestId("input-dialog-report-breakdown"),
      ).not.toBeInTheDocument();
    });
  });

  describe("breakdown flow — tow truck step (lines 878-893)", () => {
    it("advances to tow truck ConfirmDialog after submitting notes", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });

      // Submit breakdown notes
      await user.click(screen.getByText("Next"));

      // Tow truck dialog should appear
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });
    });

    it("selects 'Yes — Tow Needed' and advances to cargo step", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });

      // Click Yes — Tow Needed
      await user.click(screen.getByText("Yes — Tow Needed"));

      // Cargo at risk dialog should appear
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });
    });

    it("selects 'No Tow' and advances to cargo step", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });

      // Click No Tow
      await user.click(screen.getByText("No Tow"));

      // Cargo at risk dialog should appear
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("breakdown flow — cargo at risk with HIGH risk (lines 894-927)", () => {
    it("confirms high-risk cargo and calls onSaveLoad with HIGH risk issue", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      // Navigate through entire breakdown flow
      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Yes — Tow Needed"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });

      // Confirm high risk cargo
      await user.click(screen.getByText("Yes — High Risk"));

      await waitFor(() => {
        expect(onSaveLoad).toHaveBeenCalledTimes(1);
      });

      const savedLoad = onSaveLoad.mock.calls[0][0] as LoadData;
      expect(savedLoad.status).toBe("in_transit");
      expect(savedLoad.isActionRequired).toBe(true);
      expect(savedLoad.issues).toHaveLength(1);
      expect(savedLoad.issues![0].category).toBe("Maintenance");
      expect(savedLoad.issues![0].description).toContain("Risk: HIGH");
      expect(savedLoad.issues![0].description).toContain("Tow: YES");
      expect(savedLoad.issues![0].status).toBe("Open");
    });

    it("shows emergency toast after high-risk breakdown report", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Yes — Tow Needed"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Yes — High Risk"));

      await waitFor(() => {
        expect(screen.getByTestId("toast-mock")).toBeInTheDocument();
        expect(
          screen.getByText(/EMERGENCY PROTOCOL ACTIVATED/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("breakdown flow — cargo at risk with LOW risk (lines 928-949)", () => {
    it("declines cargo risk and calls onSaveLoad with LOW risk issue", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });
      // No tow needed
      await user.click(screen.getByText("No Tow"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });

      // Decline cargo risk (No Risk)
      await user.click(screen.getByText("No Risk"));

      await waitFor(() => {
        expect(onSaveLoad).toHaveBeenCalledTimes(1);
      });

      const savedLoad = onSaveLoad.mock.calls[0][0] as LoadData;
      expect(savedLoad.status).toBe("in_transit");
      expect(savedLoad.isActionRequired).toBe(true);
      expect(savedLoad.issues).toHaveLength(1);
      expect(savedLoad.issues![0].description).toContain("Risk: LOW");
      expect(savedLoad.issues![0].description).toContain("Tow: NO");
    });

    it("shows emergency toast after low-risk breakdown report", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("No Tow"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("No Risk"));

      await waitFor(() => {
        expect(screen.getByTestId("toast-mock")).toBeInTheDocument();
        expect(
          screen.getByText(/EMERGENCY PROTOCOL ACTIVATED/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("breakdown flow — toast dismiss resets state (line 861)", () => {
    it("dismisses toast notification after breakdown flow completes", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      // Complete the full breakdown flow
      await user.click(screen.getByText("Dallas → Houston"));
      await user.click(screen.getByText("Report Issue"));
      await waitFor(() => {
        expect(screen.getByText("Report Breakdown")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Report Breakdown"));
      await waitFor(() => {
        expect(
          screen.getByTestId("input-dialog-report-breakdown"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Next"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-tow-truck-required?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("No Tow"));
      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-dialog-cargo-at-risk?"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("No Risk"));

      await waitFor(() => {
        expect(screen.getByTestId("toast-mock")).toBeInTheDocument();
      });

      // Dismiss the toast
      await user.click(screen.getByTestId("toast-dismiss"));

      await waitFor(() => {
        expect(screen.queryByTestId("toast-mock")).not.toBeInTheDocument();
      });
    });
  });

  describe("profile tab — truck assignment and compliance (lines 789-822)", () => {
    it("shows truck assignment with unit number from active load", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad({ truckNumber: "TRK-5501" })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Me"));
      expect(screen.getByText("Assigned Truck")).toBeInTheDocument();
      expect(screen.getByText("Unit: TRK-5501")).toBeInTheDocument();
    });

    it("shows 'No truck assigned' when load has no truck number", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad({ truckNumber: undefined })]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Me"));
      expect(screen.getByText("No truck assigned")).toBeInTheDocument();
    });

    it("shows compliance tasks section with passing status", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Me"));
      expect(screen.getByText("Compliance Tasks")).toBeInTheDocument();
      expect(screen.getByText("All Records Pass")).toBeInTheDocument();
    });

    it("displays user initial avatar on profile tab", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Me"));
      // User initial "T" from "Test Driver"
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    it("displays user role on profile tab", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Me"));
      // Role "driver" should be displayed (with underscore replaced)
      expect(screen.getByText("driver")).toBeInTheDocument();
    });
  });

  describe("map tab — fleet tracking overlay (lines 834-853)", () => {
    it("shows GPS Connection Stable status on map tab", async () => {
      const user = userEvent.setup();
      render(
        <DriverMobileHome
          user={mockUser}
          loads={[makeLoad()]}
          onLogout={onLogout}
          onSaveLoad={onSaveLoad}
          onOpenHub={onOpenHub}
        />,
      );

      await user.click(screen.getByText("Live Map"));
      expect(screen.getByText("Fleet Tracking")).toBeInTheDocument();
      expect(screen.getByText("GPS Connection Stable")).toBeInTheDocument();
    });
  });
});
