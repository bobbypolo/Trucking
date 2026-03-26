/**
 * Tests for TelematicsSetup admin UI component.
 * Tests R-TELEM-01 through R-TELEM-10
 *
 * Covers:
 *  R-TELEM-01 Empty state when no providers configured
 *  R-TELEM-02 Renders provider list when configs exist
 *  R-TELEM-03 Can open provider setup form
 *  R-TELEM-04 Submits provider config via API
 *  R-TELEM-05 Shows connection test results
 *  R-TELEM-06 Renders vehicle mappings table
 *  R-TELEM-07 Can add a new vehicle mapping
 *  R-TELEM-08 Can delete a provider config
 *  R-TELEM-09 Can delete a vehicle mapping
 *  R-TELEM-10 Shows loading state
 */
import React from "react";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelematicsSetup } from "../../../components/TelematicsSetup";

// ---------------------------------------------------------------------------
// Mock the api module
// ---------------------------------------------------------------------------
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

// Mock firebase to prevent initialization errors in test environment
vi.mock("../../../services/firebase", () => ({
  auth: { currentUser: null },
  DEMO_MODE: false,
}));

// ---------------------------------------------------------------------------
// Import api after mocking so vi.mocked works
// ---------------------------------------------------------------------------
import { api } from "../../../services/api";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleProviders = [
  {
    id: "cfg-1",
    providerName: "Samsara",
    providerDisplayName: "Samsara",
    isActive: true,
    hasApiToken: true,
    hasWebhookUrl: false,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "cfg-2",
    providerName: "Generic Webhook",
    providerDisplayName: "Generic Webhook",
    isActive: false,
    hasApiToken: false,
    hasWebhookUrl: true,
    createdAt: "2026-01-02T00:00:00Z",
  },
];

const sampleMappings = [
  {
    id: "map-1",
    vehicleId: "TRUCK-001",
    providerConfigId: "cfg-1",
    providerVehicleId: "vh_abc123",
    providerName: "Samsara",
    providerDisplayName: "Samsara",
  },
  {
    id: "map-2",
    vehicleId: "TRUCK-002",
    providerConfigId: "cfg-2",
    providerVehicleId: "vh_def456",
    providerName: "Generic Webhook",
    providerDisplayName: "Generic Webhook",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupEmptyState() {
  vi.mocked(api.get).mockImplementation((endpoint: string) => {
    if (endpoint === "/tracking/providers") return Promise.resolve([]);
    if (endpoint === "/tracking/vehicles/mapping") return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

function setupPopulatedState() {
  vi.mocked(api.get).mockImplementation((endpoint: string) => {
    if (endpoint === "/tracking/providers")
      return Promise.resolve(sampleProviders);
    if (endpoint === "/tracking/vehicles/mapping")
      return Promise.resolve(sampleMappings);
    return Promise.resolve([]);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TelematicsSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // R-TELEM-10: Loading state
  // -------------------------------------------------------------------------
  describe("loading state (R-TELEM-10)", () => {
    it("shows loading indicator while data is being fetched", () => {
      // Never resolve so we stay in loading state
      vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

      render(<TelematicsSetup />);

      expect(screen.getByTestId("telematics-loading")).toBeInTheDocument();
      expect(
        screen.getByText(/loading telematics configuration/i),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-01: Empty state
  // -------------------------------------------------------------------------
  describe("empty state (R-TELEM-01)", () => {
    it("renders empty state message when no providers are configured", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("no-providers-message")).toBeInTheDocument();
      });

      expect(screen.getByTestId("no-providers-message").textContent).toMatch(
        /no telematics providers configured/i,
      );
    });

    it("empty state message mentions GPS tracking", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("no-providers-message")).toBeInTheDocument();
      });

      expect(screen.getByTestId("no-providers-message").textContent).toMatch(
        /live GPS tracking/i,
      );
    });

    it("shows 0 providers configured in overview card when empty", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(
          screen.getByTestId("providers-configured-count"),
        ).toBeInTheDocument();
      });

      expect(screen.getByTestId("providers-configured-count").textContent).toBe(
        "0",
      );
    });

    it("shows 0 vehicles mapped in overview card when empty", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("vehicles-mapped-count")).toBeInTheDocument();
      });

      expect(screen.getByTestId("vehicles-mapped-count").textContent).toBe("0");
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-02: Renders provider list when configs exist
  // -------------------------------------------------------------------------
  describe("provider list (R-TELEM-02)", () => {
    it("renders provider list section when configs exist", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("provider-list")).toBeInTheDocument();
      });
    });

    it("shows Samsara provider config card", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("provider-config-cfg-1")).toBeInTheDocument();
      });

      const card = screen.getByTestId("provider-config-cfg-1");
      expect(within(card).getByText("Samsara")).toBeInTheDocument();
    });

    it("shows Generic Webhook provider config card", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("provider-config-cfg-2")).toBeInTheDocument();
      });

      const card = screen.getByTestId("provider-config-cfg-2");
      expect(within(card).getByText("Generic Webhook")).toBeInTheDocument();
    });

    it("shows Active badge for active provider", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("provider-config-cfg-1")).toBeInTheDocument();
      });

      const card = screen.getByTestId("provider-config-cfg-1");
      expect(within(card).getByText("Active")).toBeInTheDocument();
    });

    it("shows Inactive badge for inactive provider", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("provider-config-cfg-2")).toBeInTheDocument();
      });

      const card = screen.getByTestId("provider-config-cfg-2");
      expect(within(card).getByText("Inactive")).toBeInTheDocument();
    });

    it("shows correct provider count in overview card", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(
          screen.getByTestId("providers-configured-count"),
        ).toBeInTheDocument();
      });

      expect(screen.getByTestId("providers-configured-count").textContent).toBe(
        "2",
      );
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-03: Can open provider setup form
  // -------------------------------------------------------------------------
  describe("provider setup form (R-TELEM-03)", () => {
    it("opens Samsara form when configure-samsara button is clicked", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-samsara"));

      expect(screen.getByTestId("provider-form-samsara")).toBeInTheDocument();
    });

    it("opens Generic Webhook form when configure button is clicked", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(
          screen.getByTestId("configure-generic-webhook"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-generic-webhook"));

      expect(
        screen.getByTestId("provider-form-generic-webhook"),
      ).toBeInTheDocument();
    });

    it("does not render unsupported provider buttons", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      expect(screen.queryByText(/motive/i)).not.toBeInTheDocument();
    });

    it("toggles the form closed when the same provider button is clicked again", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      // Open
      await user.click(screen.getByTestId("configure-samsara"));
      expect(screen.getByTestId("provider-form-samsara")).toBeInTheDocument();

      // Close
      await user.click(screen.getByTestId("configure-samsara"));
      expect(
        screen.queryByTestId("provider-form-samsara"),
      ).not.toBeInTheDocument();
    });

    it("Samsara form contains an API Token password field", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-samsara"));

      const form = screen.getByTestId("provider-form-samsara");
      const tokenInput = within(form).getByPlaceholderText(/enter api token/i);
      expect(tokenInput).toBeInTheDocument();
      expect(tokenInput).toHaveAttribute("type", "password");
    });

    it("Generic Webhook form shows webhook secret field instead of API token", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(
          screen.getByTestId("configure-generic-webhook"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-generic-webhook"));

      const form = screen.getByTestId("provider-form-generic-webhook");
      expect(
        within(form).getByPlaceholderText(/signing secret/i),
      ).toBeInTheDocument();
      expect(
        within(form).queryByPlaceholderText(/enter api token/i),
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-04: Submits provider config via API
  // -------------------------------------------------------------------------
  describe("submitting provider config (R-TELEM-04)", () => {
    it("calls POST /tracking/providers with correct payload on save", async () => {
      setupEmptyState();
      vi.mocked(api.post).mockResolvedValue({
        id: "cfg-new",
        providerName: "Samsara",
      });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-samsara"));

      const form = screen.getByTestId("provider-form-samsara");
      const tokenInput = within(form).getByPlaceholderText(/enter api token/i);
      await user.type(tokenInput, "tok_test_abc");

      // Click Save
      await user.click(within(form).getByText(/save configuration/i));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/tracking/providers",
          expect.objectContaining({
            providerName: "Samsara",
            apiToken: "tok_test_abc",
            isActive: true,
          }),
        );
      });
    });

    it("refetches provider list after successful save", async () => {
      setupEmptyState();
      vi.mocked(api.post).mockResolvedValue({ id: "cfg-new" });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-samsara"));
      const form = screen.getByTestId("provider-form-samsara");
      await user.click(within(form).getByText(/save configuration/i));

      await waitFor(() => {
        // api.get should be called at least twice: initial load + refresh
        expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThanOrEqual(4);
      });
    });

    it("shows error message when provider save fails", async () => {
      setupEmptyState();
      vi.mocked(api.post).mockRejectedValue(new Error("Save failed: 500"));
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("configure-samsara"));
      const form = screen.getByTestId("provider-form-samsara");
      await user.click(within(form).getByText(/save configuration/i));

      await waitFor(() => {
        expect(within(form).getByText(/save failed: 500/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-05: Shows connection test results
  // -------------------------------------------------------------------------
  describe("connection test results (R-TELEM-05)", () => {
    it("calls POST /tracking/providers/:id/test when Test button is clicked", async () => {
      setupPopulatedState();
      vi.mocked(api.post).mockResolvedValue({
        status: "success",
        message: "Connected",
        latencyMs: 42,
      });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("test-btn-cfg-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("test-btn-cfg-1"));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/tracking/providers/cfg-1/test",
          {},
        );
      });
    });

    it("shows green Connected indicator after successful test", async () => {
      setupPopulatedState();
      vi.mocked(api.post).mockResolvedValue({
        status: "success",
        message: "Connected",
        latencyMs: 42,
      });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("test-btn-cfg-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("test-btn-cfg-1"));

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("shows latency in ms after successful test", async () => {
      setupPopulatedState();
      vi.mocked(api.post).mockResolvedValue({
        status: "success",
        message: "Connected",
        latencyMs: 87,
      });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("test-btn-cfg-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("test-btn-cfg-1"));

      await waitFor(() => {
        expect(screen.getByText("(87ms)")).toBeInTheDocument();
      });
    });

    it("shows error message after failed test", async () => {
      setupPopulatedState();
      vi.mocked(api.post).mockResolvedValue({
        status: "failed",
        message: "Timeout after 5000ms",
      });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("test-btn-cfg-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("test-btn-cfg-1"));

      await waitFor(() => {
        expect(screen.getByText(/timeout after 5000ms/i)).toBeInTheDocument();
      });
    });

    it("shows no_credentials warning when credentials are missing", async () => {
      setupPopulatedState();
      vi.mocked(api.post).mockResolvedValue({
        status: "no_credentials",
        message: "No API token or webhook configured",
      });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("test-btn-cfg-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("test-btn-cfg-1"));

      await waitFor(() => {
        expect(
          screen.getByText(/no credentials configured/i),
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-06: Renders vehicle mappings table
  // -------------------------------------------------------------------------
  describe("vehicle mappings table (R-TELEM-06)", () => {
    it("renders mappings table when mappings exist", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("mappings-table")).toBeInTheDocument();
      });
    });

    it("shows vehicle ID TRUCK-001 in the mappings table", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("mapping-row-map-1")).toBeInTheDocument();
      });

      const row = screen.getByTestId("mapping-row-map-1");
      expect(within(row).getByText("TRUCK-001")).toBeInTheDocument();
    });

    it("shows provider vehicle ID vh_abc123 in the mappings table", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("mapping-row-map-1")).toBeInTheDocument();
      });

      const row = screen.getByTestId("mapping-row-map-1");
      expect(within(row).getByText("vh_abc123")).toBeInTheDocument();
    });

    it("shows correct vehicles mapped count in overview", async () => {
      setupPopulatedState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("vehicles-mapped-count")).toBeInTheDocument();
      });

      expect(screen.getByTestId("vehicles-mapped-count").textContent).toBe("2");
    });

    it("shows empty message when no mappings exist", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("no-mappings-message")).toBeInTheDocument();
      });

      expect(screen.getByTestId("no-mappings-message").textContent).toMatch(
        /no vehicle mappings configured/i,
      );
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-07: Can add a new vehicle mapping
  // -------------------------------------------------------------------------
  describe("add vehicle mapping (R-TELEM-07)", () => {
    it("shows mapping form when Add Mapping button is clicked", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("add-mapping-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("add-mapping-btn"));

      expect(screen.getByTestId("mapping-form")).toBeInTheDocument();
    });

    it("calls POST /tracking/vehicles/mapping with correct payload", async () => {
      // Provide providers so we can select one
      vi.mocked(api.get).mockImplementation((endpoint: string) => {
        if (endpoint === "/tracking/providers")
          return Promise.resolve([sampleProviders[0]]);
        if (endpoint === "/tracking/vehicles/mapping")
          return Promise.resolve([]);
        return Promise.resolve([]);
      });
      vi.mocked(api.post).mockResolvedValue({ id: "map-new" });
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("add-mapping-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("add-mapping-btn"));

      // Fill in the form
      await user.type(screen.getByTestId("mapping-vehicle-id"), "TRUCK-999");
      fireEvent.change(screen.getByTestId("mapping-provider-select"), {
        target: { value: "cfg-1" },
      });
      await user.type(
        screen.getByTestId("mapping-provider-vehicle-id"),
        "vh_xyz789",
      );

      await user.click(screen.getByTestId("mapping-submit-btn"));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/tracking/vehicles/mapping",
          expect.objectContaining({
            vehicleId: "TRUCK-999",
            providerConfigId: "cfg-1",
            providerVehicleId: "vh_xyz789",
          }),
        );
      });
    });

    it("shows validation error when required mapping fields are empty", async () => {
      setupEmptyState();
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("add-mapping-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("add-mapping-btn"));
      // Submit without filling in fields
      await user.click(screen.getByTestId("mapping-submit-btn"));

      expect(
        screen.getByText(/all mapping fields are required/i),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-08: Can delete a provider config
  // -------------------------------------------------------------------------
  describe("delete provider config (R-TELEM-08)", () => {
    it("calls DELETE /tracking/providers/:id when delete button is clicked", async () => {
      setupPopulatedState();
      vi.mocked(api.delete).mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("delete-provider-cfg-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("delete-provider-cfg-1"));

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith("/tracking/providers/cfg-1");
      });
    });

    it("refetches data after provider deletion", async () => {
      setupPopulatedState();
      vi.mocked(api.delete).mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("delete-provider-cfg-1")).toBeInTheDocument();
      });

      const getCallCountBefore = vi.mocked(api.get).mock.calls.length;

      await user.click(screen.getByTestId("delete-provider-cfg-1"));

      await waitFor(() => {
        expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(
          getCallCountBefore,
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // R-TELEM-09: Can delete a vehicle mapping
  // -------------------------------------------------------------------------
  describe("delete vehicle mapping (R-TELEM-09)", () => {
    it("calls DELETE /tracking/vehicles/mapping/:id when delete button is clicked", async () => {
      setupPopulatedState();
      vi.mocked(api.delete).mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("delete-mapping-map-1")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("delete-mapping-map-1"));

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith(
          "/tracking/vehicles/mapping/map-1",
        );
      });
    });

    it("refetches data after mapping deletion", async () => {
      setupPopulatedState();
      vi.mocked(api.delete).mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("delete-mapping-map-2")).toBeInTheDocument();
      });

      const getCallCountBefore = vi.mocked(api.get).mock.calls.length;

      await user.click(screen.getByTestId("delete-mapping-map-2"));

      await waitFor(() => {
        expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(
          getCallCountBefore,
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Additional: Error state
  // -------------------------------------------------------------------------
  describe("error state", () => {
    it("shows error message when API fetch fails", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Network error: 503"));

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("telematics-error")).toBeInTheDocument();
      });

      expect(screen.getByText(/network error: 503/i)).toBeInTheDocument();
    });

    it("error element has role=alert for accessibility", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Connection refused"));

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("shows Retry button in error state", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Server error"));

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Additional: Overview card
  // -------------------------------------------------------------------------
  describe("overview card", () => {
    it("renders Telematics Overview heading", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByText("Telematics Overview")).toBeInTheDocument();
      });
    });

    it("renders Provider Configuration heading", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByText("Provider Configuration")).toBeInTheDocument();
      });
    });

    it("renders Vehicle Mappings heading", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByText("Vehicle Mappings")).toBeInTheDocument();
      });
    });

    it("shows the two supported provider buttons", async () => {
      setupEmptyState();

      render(<TelematicsSetup />);

      await waitFor(() => {
        expect(screen.getByTestId("configure-samsara")).toBeInTheDocument();
        expect(
          screen.getByTestId("configure-generic-webhook"),
        ).toBeInTheDocument();
      });
    });
  });
});
