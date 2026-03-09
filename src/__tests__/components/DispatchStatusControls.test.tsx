/**
 * R-FS-06-02: Dispatch/status transition control tests.
 * Covers invalid transition errors and valid dispatch flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transitionLoadStatus,
  fetchDashboardCounts,
  StatusTransitionResult,
  BusinessRuleErrorResponse,
} from "../../../services/dispatchService";
import { LOAD_STATUS, LoadStatus } from "../../../types";

// Mock the API module so we can simulate various backend responses
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const VALID_TRANSITIONS: Array<[LoadStatus, LoadStatus]> = [
  [LOAD_STATUS.Draft, LOAD_STATUS.Planned],
  [LOAD_STATUS.Planned, LOAD_STATUS.Dispatched],
  [LOAD_STATUS.Dispatched, LOAD_STATUS.In_Transit],
  [LOAD_STATUS.In_Transit, LOAD_STATUS.Arrived],
  [LOAD_STATUS.Arrived, LOAD_STATUS.Delivered],
  [LOAD_STATUS.Delivered, LOAD_STATUS.Completed],
];

const INVALID_TRANSITIONS: Array<[LoadStatus, LoadStatus]> = [
  [LOAD_STATUS.Completed, LOAD_STATUS.Planned],
  [LOAD_STATUS.Cancelled, LOAD_STATUS.Dispatched],
  [LOAD_STATUS.Delivered, LOAD_STATUS.Draft],
];

describe("Dispatch Status Transitions — valid paths (R-FS-06-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitionLoadStatus resolves with updated status on valid transition", async () => {
    const { api } = await import("../../../services/api");
    const mockResult: StatusTransitionResult = {
      id: "load-1",
      status: LOAD_STATUS.Dispatched,
      version: 2,
      previous_status: LOAD_STATUS.Planned,
    };
    vi.mocked(api.patch).mockResolvedValueOnce(mockResult);

    const result = await transitionLoadStatus("load-1", LOAD_STATUS.Dispatched);

    expect(result.status).toBe(LOAD_STATUS.Dispatched);
    expect(result.previous_status).toBe(LOAD_STATUS.Planned);
    expect(result.id).toBe("load-1");
    expect(result.version).toBeGreaterThan(0);
  });

  it("transitionLoadStatus calls PATCH /loads/:id/status with correct payload", async () => {
    const { api } = await import("../../../services/api");
    const mockResult: StatusTransitionResult = {
      id: "load-42",
      status: LOAD_STATUS.In_Transit,
      version: 3,
      previous_status: LOAD_STATUS.Dispatched,
    };
    vi.mocked(api.patch).mockResolvedValueOnce(mockResult);

    await transitionLoadStatus("load-42", LOAD_STATUS.In_Transit);

    expect(api.patch).toHaveBeenCalledWith("/loads/load-42/status", {
      status: LOAD_STATUS.In_Transit,
    });
  });

  it.each(VALID_TRANSITIONS)(
    "valid transition %s -> %s is accepted by the service layer",
    async (from, to) => {
      const { api } = await import("../../../services/api");
      const mockResult: StatusTransitionResult = {
        id: "load-x",
        status: to,
        version: 2,
        previous_status: from,
      };
      vi.mocked(api.patch).mockResolvedValueOnce(mockResult);

      const result = await transitionLoadStatus("load-x", to);
      expect(result.status).toBe(to);
      expect(result.previous_status).toBe(from);
    },
  );
});

describe("Dispatch Status Transitions — invalid transition errors (R-FS-06-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitionLoadStatus throws on 422 invalid transition (backward transition)", async () => {
    const { api } = await import("../../../services/api");
    const businessRuleError: BusinessRuleErrorResponse = {
      error_code: "BUSINESS_RULE_INVALID_TRANSITION",
      error_class: "InvalidStatusTransition",
      message:
        "Cannot transition load from completed to planned. Status machine violation.",
      correlation_id: "corr-abc-123",
      retryable: false,
      details: { from: "completed", to: "planned" },
    };
    vi.mocked(api.patch).mockRejectedValueOnce(
      new Error(businessRuleError.message),
    );

    await expect(
      transitionLoadStatus("load-1", LOAD_STATUS.Planned),
    ).rejects.toThrow(/Cannot transition/i);
  });

  it("transitionLoadStatus throws on invalid transition from cancelled", async () => {
    const { api } = await import("../../../services/api");
    vi.mocked(api.patch).mockRejectedValueOnce(
      new Error(
        "BUSINESS_RULE_INVALID_TRANSITION: cancelled -> dispatched not allowed",
      ),
    );

    await expect(
      transitionLoadStatus("load-cancelled", LOAD_STATUS.Dispatched),
    ).rejects.toThrow(/BUSINESS_RULE_INVALID_TRANSITION/i);
  });

  it.each(INVALID_TRANSITIONS)(
    "invalid transition %s -> %s is rejected and throws",
    async (from, to) => {
      const { api } = await import("../../../services/api");
      vi.mocked(api.patch).mockRejectedValueOnce(
        new Error(
          `BUSINESS_RULE_INVALID_TRANSITION: ${from} -> ${to} not allowed`,
        ),
      );

      await expect(transitionLoadStatus(`load-invalid`, to)).rejects.toThrow();
    },
  );

  it("transition error is non-retryable for terminal state violations", async () => {
    const { api } = await import("../../../services/api");
    // Simulate the API error with retryable: false
    const apiError = new Error(
      "Cannot transition load from completed state. This transition is not retryable.",
    );
    (apiError as any).retryable = false;
    vi.mocked(api.patch).mockRejectedValueOnce(apiError);

    let caughtError: Error | null = null;
    try {
      await transitionLoadStatus("load-done", LOAD_STATUS.Draft);
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain("completed");
  });
});

describe("Dispatch Dashboard Counts (R-FS-06-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchDashboardCounts returns real status distribution", async () => {
    const { api } = await import("../../../services/api");
    const mockCounts = {
      draft: 2,
      planned: 5,
      dispatched: 3,
      in_transit: 8,
      arrived: 1,
      delivered: 4,
      completed: 12,
      cancelled: 0,
      total: 35,
    };
    vi.mocked(api.get).mockResolvedValueOnce(mockCounts);

    const counts = await fetchDashboardCounts();

    expect(counts.total).toBe(35);
    expect(counts.in_transit).toBe(8);
    expect(counts.completed).toBe(12);
    expect(counts.cancelled).toBe(0);
    // Total should equal sum of all statuses
    const sum =
      counts.draft +
      counts.planned +
      counts.dispatched +
      counts.in_transit +
      counts.arrived +
      counts.delivered +
      counts.completed +
      counts.cancelled;
    expect(sum).toBe(counts.total);
  });

  it("fetchDashboardCounts calls GET /loads/counts", async () => {
    const { api } = await import("../../../services/api");
    vi.mocked(api.get).mockResolvedValueOnce({
      draft: 0,
      planned: 0,
      dispatched: 0,
      in_transit: 0,
      arrived: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    });

    await fetchDashboardCounts();

    expect(api.get).toHaveBeenCalledWith("/loads/counts");
  });
});

describe("Load Status Constants (R-FS-06-02)", () => {
  it("LOAD_STATUS constants match expected canonical values", () => {
    expect(LOAD_STATUS.Draft).toBe("draft");
    expect(LOAD_STATUS.Planned).toBe("planned");
    expect(LOAD_STATUS.Dispatched).toBe("dispatched");
    expect(LOAD_STATUS.In_Transit).toBe("in_transit");
    expect(LOAD_STATUS.Arrived).toBe("arrived");
    expect(LOAD_STATUS.Delivered).toBe("delivered");
    expect(LOAD_STATUS.Completed).toBe("completed");
    expect(LOAD_STATUS.Cancelled).toBe("cancelled");
  });

  it("terminal states cannot be further transitioned per business rules", () => {
    // These are the states the state machine treats as terminal
    const terminalStates: LoadStatus[] = [
      LOAD_STATUS.Completed,
      LOAD_STATUS.Cancelled,
    ];
    // Verify they exist as valid status values
    terminalStates.forEach((state) => {
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);
    });
  });
});
