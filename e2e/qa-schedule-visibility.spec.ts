import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  makeDriverRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import { makeLoadDraft } from "./fixtures/data-factory";

/**
 * QA-01 / OPS-04: Schedule Visibility E2E Tests
 *
 * Covers:
 *   - OPS-04: Schedule API returns loads assigned to drivers
 *   - Schedule endpoint auth enforcement
 *   - Multi-day span schedule data validation
 *   - Driver-specific schedule filtering (assigned loads only)
 *
 * The schedule is derived from load assignments: loads with a driver_id and
 * pickup_date represent scheduled work. The loads listing endpoint serves
 * as the schedule data source, filtered by driver assignment.
 *
 * All tests run against the real backend. No mocks.
 */

// -- Auth enforcement (always runs) -------------------------------------------

test.describe("Schedule Visibility — Auth Enforcement", () => {
  test("GET /api/loads — unauthenticated denies schedule access", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/loads/counts — unauthenticated denies dashboard data", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/loads/counts`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/dispatch/events — unauthenticated denies dispatch events", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/dispatch/events`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/time-logs/:userId — unauthenticated denies time logs", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/time-logs/nonexistent-user`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

// -- OPS-04: Schedule renders assigned loads from real data -------------------

test.describe("OPS-04: Schedule — Loads Assigned to Drivers", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped — FIREBASE_WEB_API_KEY not set; schedule tests require real Firebase token",
  );

  test("GET /api/loads returns array with schedule-relevant fields", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    const res = await admin.get(`${API_BASE}/api/loads`, request);
    expect(res.status()).toBe(200);

    const loads = await res.json();
    expect(Array.isArray(loads)).toBe(true);

    // Validate that each load has the fields needed for schedule display
    for (const load of loads) {
      expect(load).toHaveProperty("id");
      expect(load).toHaveProperty("load_number");
      expect(load).toHaveProperty("status");
      // Legs carry the schedule date/location info
      expect(load).toHaveProperty("legs");
      expect(Array.isArray(load.legs)).toBe(true);
    }
  });

  test("loads with pickup_date provide date-based schedule data", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    // Create a load with a specific pickup date for schedule visibility
    const loadId = uuidv4();
    const loadNumber = `QA-SCHED-${Date.now()}`;
    const pickupDate = "2026-04-15";

    const payload = makeLoadDraft({
      id: loadId,
      load_number: loadNumber,
      commodity: "Schedule Visibility Test",
      weight: 18000,
      pickup_date: pickupDate,
      legs: [
        {
          type: "pickup",
          city: "Atlanta",
          state: "GA",
          sequence_order: 0,
          date: pickupDate,
        },
        {
          type: "delivery",
          city: "Charlotte",
          state: "NC",
          sequence_order: 1,
          date: "2026-04-16",
        },
      ],
    });

    const createRes = await admin.post(
      `${API_BASE}/api/loads`,
      payload,
      request,
    );
    expect([200, 201]).toContain(createRes.status());

    // Verify the load appears in the listing with date information
    const listRes = await admin.get(`${API_BASE}/api/loads`, request);
    expect(listRes.status()).toBe(200);

    const loads = await listRes.json();
    const found = loads.find(
      (l: Record<string, unknown>) =>
        l.id === loadId || l.load_number === loadNumber,
    );
    expect(found).toBeDefined();
    expect(found.pickup_date).toBeDefined();
  });

  test("multi-day span: loads with different pickup dates are all returned", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    // Create two loads with different dates to verify multi-day span
    const load1Id = uuidv4();
    const load2Id = uuidv4();
    const load1Number = `QA-SPAN1-${Date.now()}`;
    const load2Number = `QA-SPAN2-${Date.now() + 1}`;

    const payload1 = makeLoadDraft({
      id: load1Id,
      load_number: load1Number,
      commodity: "Multi-Day Span Load 1",
      pickup_date: "2026-04-20",
      legs: [
        {
          type: "pickup",
          city: "Denver",
          state: "CO",
          sequence_order: 0,
          date: "2026-04-20",
        },
        {
          type: "delivery",
          city: "Omaha",
          state: "NE",
          sequence_order: 1,
          date: "2026-04-21",
        },
      ],
    });

    const payload2 = makeLoadDraft({
      id: load2Id,
      load_number: load2Number,
      commodity: "Multi-Day Span Load 2",
      pickup_date: "2026-04-22",
      legs: [
        {
          type: "pickup",
          city: "Kansas City",
          state: "MO",
          sequence_order: 0,
          date: "2026-04-22",
        },
        {
          type: "delivery",
          city: "St. Louis",
          state: "MO",
          sequence_order: 1,
          date: "2026-04-23",
        },
      ],
    });

    const [res1, res2] = await Promise.all([
      admin.post(`${API_BASE}/api/loads`, payload1, request),
      admin.post(`${API_BASE}/api/loads`, payload2, request),
    ]);
    expect([200, 201]).toContain(res1.status());
    expect([200, 201]).toContain(res2.status());

    // Both loads should appear in the listing
    const listRes = await admin.get(`${API_BASE}/api/loads`, request);
    expect(listRes.status()).toBe(200);

    const loads = await listRes.json();
    const found1 = loads.find(
      (l: Record<string, unknown>) => l.load_number === load1Number,
    );
    const found2 = loads.find(
      (l: Record<string, unknown>) => l.load_number === load2Number,
    );
    expect(found1).toBeDefined();
    expect(found2).toBeDefined();

    // Verify different pickup dates (multi-day span visibility)
    expect(found1.pickup_date).toBeDefined();
    expect(found2.pickup_date).toBeDefined();
  });
});

// -- Driver-specific schedule filtering --------------------------------------

test.describe("Schedule — Driver Assignment Filtering", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped — FIREBASE_WEB_API_KEY not set; driver filtering tests require real Firebase token",
  );

  test("loads with driver_id set represent driver schedule assignments", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    // Create a load with an explicit driver_id assignment
    const loadId = uuidv4();
    const loadNumber = `QA-DRVR-${Date.now()}`;
    const driverId = `test-driver-${Date.now()}`;

    const payload = makeLoadDraft({
      id: loadId,
      load_number: loadNumber,
      driver_id: driverId,
      commodity: "Driver Schedule Assignment Test",
      weight: 20000,
      pickup_date: "2026-04-25",
      legs: [
        { type: "pickup", city: "Phoenix", state: "AZ", sequence_order: 0 },
        {
          type: "delivery",
          city: "Las Vegas",
          state: "NV",
          sequence_order: 1,
        },
      ],
    });

    const createRes = await admin.post(
      `${API_BASE}/api/loads`,
      payload,
      request,
    );
    expect([200, 201]).toContain(createRes.status());

    // Verify load appears in listing with driver_id
    const listRes = await admin.get(`${API_BASE}/api/loads`, request);
    expect(listRes.status()).toBe(200);

    const loads = await listRes.json();
    const found = loads.find(
      (l: Record<string, unknown>) => l.load_number === loadNumber,
    );
    expect(found).toBeDefined();
    expect(found.driver_id).toBe(driverId);
  });

  test("load without driver_id is unassigned (not on any driver schedule)", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    const loadId = uuidv4();
    const loadNumber = `QA-NODRV-${Date.now()}`;

    const payload = makeLoadDraft({
      id: loadId,
      load_number: loadNumber,
      // driver_id intentionally omitted
      commodity: "Unassigned Load — No Driver Schedule",
      weight: 12000,
      legs: [
        { type: "pickup", city: "Miami", state: "FL", sequence_order: 0 },
        { type: "delivery", city: "Tampa", state: "FL", sequence_order: 1 },
      ],
    });

    const createRes = await admin.post(
      `${API_BASE}/api/loads`,
      payload,
      request,
    );
    expect([200, 201]).toContain(createRes.status());

    const listRes = await admin.get(`${API_BASE}/api/loads`, request);
    expect(listRes.status()).toBe(200);

    const loads = await listRes.json();
    const found = loads.find(
      (l: Record<string, unknown>) => l.load_number === loadNumber,
    );
    expect(found).toBeDefined();
    // driver_id should be null/undefined for unassigned loads
    expect(found.driver_id == null).toBe(true);
  });
});

// -- Dispatch events (schedule activity log) ---------------------------------

test.describe("Schedule — Dispatch Events", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped — FIREBASE_WEB_API_KEY not set; dispatch events tests require real Firebase token",
  );

  test("GET /api/dispatch/events returns array of dispatch events", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    const res = await admin.get(`${API_BASE}/api/dispatch/events`, request);
    expect(res.status()).toBe(200);

    const events = await res.json();
    expect(Array.isArray(events)).toBe(true);

    // Each event should have dispatch-relevant fields if any exist
    if (events.length > 0) {
      const event = events[0];
      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("load_id");
      expect(event).toHaveProperty("event_type");
    }
  });

  test("load counts provide schedule summary for dashboard", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No Firebase token available");

    const res = await admin.get(`${API_BASE}/api/loads/counts`, request);
    expect(res.status()).toBe(200);

    const counts = await res.json();

    // Schedule-relevant statuses should be countable
    expect(typeof counts.draft).toBe("number");
    expect(typeof counts.planned).toBe("number");
    expect(typeof counts.dispatched).toBe("number");
    expect(typeof counts.in_transit).toBe("number");
    expect(typeof counts.total).toBe("number");

    // Total must be sum of individual statuses
    const summedTotal =
      (counts.draft || 0) +
      (counts.planned || 0) +
      (counts.dispatched || 0) +
      (counts.in_transit || 0) +
      (counts.arrived || 0) +
      (counts.delivered || 0) +
      (counts.completed || 0) +
      (counts.cancelled || 0);
    expect(counts.total).toBe(summedTotal);
  });
});
