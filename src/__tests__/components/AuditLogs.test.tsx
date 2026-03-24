import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock boundaries: config (API_URL) and auth (token provider)
vi.mock("../../../services/config", () => ({
  API_URL: "/api",
}));

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("refreshed-jwt-token"),
}));

import { AuditLogs } from "../../../components/AuditLogs";

// Mock fetch at the network boundary
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeAuditEntry = (overrides: Record<string, unknown> = {}) => ({
  id: `audit-${Math.random().toString(36).slice(2, 8)}`,
  event_type: "StatusChange",
  message: "Load status changed to in_transit",
  created_at: "2026-03-15T10:30:00Z",
  load_id: "load-1",
  load_number: "LD-001",
  actor_name: "Test Dispatcher",
  ...overrides,
});

const successResponse = (entries: unknown[], total?: number) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ entries, total: total ?? entries.length }),
  });

const errorResponse = (status: number, body?: Record<string, unknown>) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body ?? { error: `HTTP ${status}` }),
  });

describe("AuditLogs component", () => {
  const user = userEvent.setup();

  it("renders the header with correct title", async () => {
    mockFetch.mockReturnValue(successResponse([]));
    render(<AuditLogs />);
    expect(screen.getByText("Load Activity Audit")).toBeInTheDocument();
    expect(
      screen.getByText(/Dispatch & Load State Audit/i),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", async () => {
    // Create a fetch that never resolves immediately
    mockFetch.mockReturnValue(
      new Promise(() => {
        /* never resolves */
      }),
    );
    render(<AuditLogs />);
    expect(screen.getByText("Loading Audit Log")).toBeInTheDocument();
  });

  it("renders audit entries after successful fetch", async () => {
    const entries = [
      makeAuditEntry({
        message: "Load dispatched to driver",
        event_type: "StatusChange",
        load_number: "LD-100",
      }),
      makeAuditEntry({
        message: "Alert: detention risk",
        event_type: "Alert",
        load_number: "LD-200",
      }),
    ];
    mockFetch.mockReturnValue(successResponse(entries));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("Load dispatched to driver")).toBeInTheDocument();
    });
    expect(screen.getByText("Alert: detention risk")).toBeInTheDocument();
    expect(screen.getByText("LD-100")).toBeInTheDocument();
    expect(screen.getByText("LD-200")).toBeInTheDocument();
  });

  it("renders actor name for each entry", async () => {
    const entries = [
      makeAuditEntry({ actor_name: "Jane Smith" }),
      makeAuditEntry({ actor_name: undefined }),
    ];
    mockFetch.mockReturnValue(successResponse(entries));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText(/ACTOR: Jane Smith/)).toBeInTheDocument();
    });
    // Entries without actor_name show "System"
    expect(screen.getByText(/ACTOR: System/)).toBeInTheDocument();
  });

  it("shows error banner when fetch fails", async () => {
    mockFetch.mockReturnValue(errorResponse(500, { error: "Server error" }));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load audit data: Server error/),
      ).toBeInTheDocument();
    });
    // RETRY button should be visible
    expect(screen.getByText("RETRY")).toBeInTheDocument();
  });

  it("shows error banner for network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load audit data: Network failure/),
      ).toBeInTheDocument();
    });
  });

  it("retries fetch when RETRY button is clicked", async () => {
    // First call: error
    mockFetch.mockReturnValueOnce(
      errorResponse(500, { error: "Server error" }),
    );

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("RETRY")).toBeInTheDocument();
    });

    // Second call: success
    const entries = [makeAuditEntry({ message: "Retry success" })];
    mockFetch.mockReturnValueOnce(successResponse(entries));

    await user.click(screen.getByText("RETRY"));

    await waitFor(() => {
      expect(screen.getByText("Retry success")).toBeInTheDocument();
    });
  });

  it("retries fetch when refresh button is clicked", async () => {
    mockFetch.mockReturnValueOnce(successResponse([]));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("No Activity Detected")).toBeInTheDocument();
    });

    const entries = [makeAuditEntry({ message: "Refreshed data" })];
    mockFetch.mockReturnValueOnce(successResponse(entries));

    // Click the refresh button (RefreshCw icon button with title "Refresh")
    const refreshBtn = screen.getByTitle("Refresh");
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText("Refreshed data")).toBeInTheDocument();
    });
  });

  it("renders filter buttons for event types", async () => {
    mockFetch.mockReturnValue(successResponse([]));
    render(<AuditLogs />);

    expect(screen.getByText("ALL EVENTS")).toBeInTheDocument();
    expect(screen.getByText("StatusChange")).toBeInTheDocument();
    expect(screen.getByText("Assignment")).toBeInTheDocument();
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("changes filter when filter button is clicked and refetches", async () => {
    mockFetch.mockReturnValue(successResponse([]));
    render(<AuditLogs />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // The initial fetch should NOT include a type param
    const initialUrl = mockFetch.mock.calls[0][0] as string;
    expect(initialUrl).not.toContain("type=");

    mockFetch.mockClear();
    mockFetch.mockReturnValue(successResponse([]));

    // Click "StatusChange" filter
    await user.click(screen.getByText("StatusChange"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const filteredUrl = mockFetch.mock.calls[0][0] as string;
    expect(filteredUrl).toContain("type=StatusChange");
  });

  it("filters entries by search term (client-side)", async () => {
    const entries = [
      makeAuditEntry({ message: "Load picked up", load_number: "LD-AAA" }),
      makeAuditEntry({ message: "Load delivered", load_number: "LD-BBB" }),
    ];
    mockFetch.mockReturnValue(successResponse(entries));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("Load picked up")).toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByPlaceholderText("SEARCH AUDIT...");
    await user.clear(searchInput);
    await user.type(searchInput, "delivered");

    // "Load picked up" should be hidden, "Load delivered" visible
    expect(screen.queryByText("Load picked up")).not.toBeInTheDocument();
    expect(screen.getByText("Load delivered")).toBeInTheDocument();
  });

  it("searches by load number", async () => {
    const entries = [
      makeAuditEntry({ message: "Event A", load_number: "LD-100" }),
      makeAuditEntry({ message: "Event B", load_number: "LD-200" }),
    ];
    mockFetch.mockReturnValue(successResponse(entries));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("Event A")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("SEARCH AUDIT...");
    await user.clear(searchInput);
    await user.type(searchInput, "LD-200");

    expect(screen.queryByText("Event A")).not.toBeInTheDocument();
    expect(screen.getByText("Event B")).toBeInTheDocument();
  });

  it("searches by actor name", async () => {
    const entries = [
      makeAuditEntry({ message: "Event A", actor_name: "Alice" }),
      makeAuditEntry({ message: "Event B", actor_name: "Bob" }),
    ];
    mockFetch.mockReturnValue(successResponse(entries));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("Event A")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("SEARCH AUDIT...");
    await user.clear(searchInput);
    await user.type(searchInput, "bob");

    expect(screen.queryByText("Event A")).not.toBeInTheDocument();
    expect(screen.getByText("Event B")).toBeInTheDocument();
  });

  it("shows empty state when no entries and no error", async () => {
    mockFetch.mockReturnValue(successResponse([]));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("No Activity Detected")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Adjust filters or search criteria."),
    ).toBeInTheDocument();
  });

  it("shows load more button when total > entries.length", async () => {
    const entries = Array.from({ length: 3 }, (_, i) =>
      makeAuditEntry({ message: `Event ${i}` }),
    );
    mockFetch.mockReturnValue(successResponse(entries, 10));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText(/LOAD MORE/)).toBeInTheDocument();
    });
    expect(screen.getByText(/7 remaining/)).toBeInTheDocument();
  });

  it("appends entries when load more is clicked", async () => {
    const firstPage = [makeAuditEntry({ message: "First page event" })];
    mockFetch.mockReturnValueOnce(successResponse(firstPage, 2));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("First page event")).toBeInTheDocument();
    });

    const secondPage = [makeAuditEntry({ message: "Second page event" })];
    mockFetch.mockReturnValueOnce(successResponse(secondPage, 2));

    await user.click(screen.getByText(/LOAD MORE/));

    await waitFor(() => {
      expect(screen.getByText("Second page event")).toBeInTheDocument();
    });
    // First page event should still be visible
    expect(screen.getByText("First page event")).toBeInTheDocument();
  });

  it("does not show load more when all entries are loaded", async () => {
    const entries = [makeAuditEntry({ message: "Only entry" })];
    mockFetch.mockReturnValue(successResponse(entries, 1));

    render(<AuditLogs />);

    await waitFor(() => {
      expect(screen.getByText("Only entry")).toBeInTheDocument();
    });
    expect(screen.queryByText(/LOAD MORE/)).not.toBeInTheDocument();
  });

  it("sends Authorization header via api client", async () => {
    mockFetch.mockReturnValue(successResponse([]));
    render(<AuditLogs />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = fetchOptions.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer mock-jwt-token");
  });
});
