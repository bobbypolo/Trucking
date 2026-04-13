import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests R-P9-06
 *
 * Mobile integration test: mock push received, load detail, stops rendered,
 * arrive action, issue report, verify all API calls in correct sequence.
 *
 * Mocks at the api boundary to verify the full mobile driver trip loop
 * exercises the correct API calls in the correct order.
 */

// Mock the firebase config to avoid initialization errors
vi.mock("../../src/config/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue("test-token"),
    },
  },
}));

// Mock fetch globally for api.ts
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock connectivity for issues service
vi.mock("../../src/services/connectivity", () => ({
  getIsOnline: () => true,
}));

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

/** Helper: create a mock fetch Response */
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic" as ResponseType,
    url: "",
    clone: () => mockResponse(body, status) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// Track API call order
const apiCallLog: string[] = [];

describe("R-P9-06: Mobile driver trip loop integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiCallLog.length = 0;

    // Set up mock fetch to track calls and return appropriate responses
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method || "GET";
      const path = url.replace(/^.*\/api/, "");
      apiCallLog.push(`${method} ${path}`);

      // GET /loads - fetch active loads
      if (method === "GET" && path === "/loads") {
        return Promise.resolve(
          mockResponse([
            {
              id: "load-100",
              status: "dispatched",
              pickup_date: "2026-04-10",
              legs: [
                {
                  type: "Pickup",
                  city: "Dallas",
                  state: "TX",
                  facility_name: "Warehouse A",
                  date: "2026-04-10",
                  sequence_order: 1,
                },
              ],
            },
          ]),
        );
      }

      // GET /loads/load-100/stops - fetch stops
      if (method === "GET" && path === "/loads/load-100/stops") {
        return Promise.resolve(
          mockResponse({
            stops: [
              {
                id: "stop-1",
                load_id: "load-100",
                type: "Pickup",
                facility_name: "Warehouse A",
                city: "Dallas",
                state: "TX",
                date: "2026-04-10",
                appointment_time: "08:00 AM",
                completed: false,
                sequence_order: 1,
                status: "pending",
                arrived_at: null,
                departed_at: null,
              },
            ],
          }),
        );
      }

      // PATCH /loads/load-100/stops/stop-1 - arrive at stop
      if (method === "PATCH" && path === "/loads/load-100/stops/stop-1") {
        return Promise.resolve(
          mockResponse({
            stop: {
              id: "stop-1",
              load_id: "load-100",
              type: "Pickup",
              facility_name: "Warehouse A",
              city: "Dallas",
              state: "TX",
              date: "2026-04-10",
              appointment_time: "08:00 AM",
              completed: false,
              sequence_order: 1,
              status: "arrived",
              arrived_at: "2026-04-10T08:05:00Z",
              departed_at: null,
            },
          }),
        );
      }

      // POST /driver/exceptions - report issue
      if (method === "POST" && path === "/driver/exceptions") {
        return Promise.resolve(mockResponse({ id: "exc-001" }, 201));
      }

      // GET /driver/exceptions - fetch exceptions
      if (method === "GET" && path.startsWith("/driver/exceptions")) {
        return Promise.resolve(mockResponse({ exceptions: [] }));
      }

      // GET /accounting/settlements - fetch settlements
      if (method === "GET" && path === "/accounting/settlements") {
        return Promise.resolve(mockResponse([]));
      }

      // GET /notification-jobs - fetch notifications
      if (method === "GET" && path === "/notification-jobs") {
        return Promise.resolve(mockResponse([]));
      }

      // Default: return empty 200
      return Promise.resolve(mockResponse({}));
    });
  });

  // # Tests R-P9-06
  it("executes full driver trip loop: load fetch, stops, arrive, issue report in correct sequence", async () => {
    // Step 1: Simulate push notification received (just context - the push triggers load fetch)
    // In real app, push notification navigates to load detail, which triggers data fetch

    // Step 2: Fetch loads (simulating what happens after push received)
    const { fetchLoads } = await import("../../src/services/loads");
    const loads = await fetchLoads();
    expect(loads).toHaveLength(1);
    expect(loads[0].id).toBe("load-100");
    expect(loads[0].status).toBe("dispatched");

    // Step 3: Fetch stops for the load
    const { fetchStops } = await import("../../src/services/stops");
    const stops = await fetchStops("load-100");
    expect(stops).toHaveLength(1);
    expect(stops[0].facility_name).toBe("Warehouse A");
    expect(stops[0].status).toBe("pending");

    // Step 4: Arrive at the stop
    const { updateStopStatus } = await import("../../src/services/stops");
    const arrivedStop = await updateStopStatus("load-100", "stop-1", {
      status: "arrived",
      arrived_at: "2026-04-10T08:05:00Z",
    });
    expect(arrivedStop.status).toBe("arrived");
    expect(arrivedStop.arrived_at).toBe("2026-04-10T08:05:00Z");

    // Step 5: Report an issue
    const { reportIssue } = await import("../../src/services/issues");
    const issueResult = await reportIssue({
      issue_type: "Delay",
      load_id: "load-100",
      description: "Waiting for dock assignment",
    });
    expect(issueResult.id).toBe("exc-001");

    // Step 6: Verify API calls happened in correct sequence
    expect(apiCallLog).toEqual([
      "GET /loads",
      "GET /loads/load-100/stops",
      "PATCH /loads/load-100/stops/stop-1",
      "POST /driver/exceptions",
    ]);

    // Verify the exact number of calls (no extra calls)
    expect(apiCallLog).toHaveLength(4);
  });
});
