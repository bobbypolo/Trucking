import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import {
  makeLoadDraft,
  makeLoadStatusTransition,
} from "./fixtures/data-factory";

/**
 * QA-01 Acceptance: Quote Conversion (COM-01, COM-02)
 *
 * Covers:
 *   COM-01: Quotes & Bookings loads real data or a clean empty state
 *   COM-02: Quote/booking conversion creates or seeds a real load
 *
 * Tests the full quote -> booking -> load conversion pipeline through the API,
 * verifying data integrity, status transitions, and auth enforcement.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

// -- COM-01: Quotes endpoint returns data or empty array --

test.describe("COM-01: Quotes Endpoint — Real Data or Empty State", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; quote tests require real Firebase token",
  );

  test("GET /api/quotes returns 200 with array (not error)", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/quotes`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Must be an array (real data or empty state) — not an error object
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/bookings returns 200 with array (not error)", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/bookings`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Quotes response does not contain fake/hardcoded business data", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/quotes`, request);
    expect(res.status()).toBe(200);

    const quotes = await res.json();
    // If data exists, verify it does not contain known fake patterns
    for (const q of quotes) {
      if (q.customerName) {
        expect(q.customerName).not.toContain("DEMO");
        expect(q.customerName).not.toContain("FAKE");
        expect(q.customerName).not.toContain("SAMPLE");
      }
    }
  });
});

// -- COM-02: Quote CRUD and conversion pipeline --

test.describe("COM-02: Quote Creation and CRUD", () => {
  let admin: AuthContext;
  let quoteId: string;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Step 1: Create a new quote with required fields", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    quoteId = uuidv4();
    const quotePayload = {
      id: quoteId,
      quoteNumber: `QTE-QA-${Date.now()}`,
      customerName: "QA Journey Customer",
      customerEmail: "qa-quote@loadpilot-e2e.dev",
      origin: "Dallas, TX",
      destination: "Houston, TX",
      weight: 22000,
      commodity: "QA quote conversion test freight",
      equipmentType: "dry_van",
      pickupDate: new Date(Date.now() + 5 * 86400000)
        .toISOString()
        .split("T")[0],
      deliveryDate: new Date(Date.now() + 6 * 86400000)
        .toISOString()
        .split("T")[0],
      rate: 2200.0,
      status: "pending",
    };

    const res = await admin.post(
      `${API_BASE}/api/quotes`,
      quotePayload,
      request,
    );
    expect([200, 201]).toContain(res.status());

    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      if (body.id) quoteId = body.id;
    }
  });

  test("Step 2: Retrieve quote by listing", async ({ request }) => {
    test.skip(!admin.hasToken || !quoteId, "Requires prior step");

    const res = await admin.get(`${API_BASE}/api/quotes`, request);
    expect(res.status()).toBe(200);

    const quotes = await res.json();
    expect(Array.isArray(quotes)).toBe(true);
  });

  test("Step 3: Update quote status to approved", async ({ request }) => {
    test.skip(!admin.hasToken || !quoteId, "Requires prior step");

    const res = await admin.patch(
      `${API_BASE}/api/quotes/${quoteId}`,
      { status: "approved" },
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 4: Retrieve single quote by ID", async ({ request }) => {
    test.skip(!admin.hasToken || !quoteId, "Requires prior step");

    const res = await admin.get(`${API_BASE}/api/quotes/${quoteId}`, request);
    expect(res.status()).toBe(200);

    const quote = await res.json();
    expect(quote.id).toBe(quoteId);
  });

  test("Step 5: Archive quote (soft-delete)", async ({ request }) => {
    test.skip(!admin.hasToken || !quoteId, "Requires prior step");

    const archiveQuoteId = uuidv4();
    // Create a disposable quote to archive
    const createRes = await admin.post(
      `${API_BASE}/api/quotes`,
      {
        id: archiveQuoteId,
        quoteNumber: `QTE-ARCHIVE-${Date.now()}`,
        customerName: "QA Archive Customer",
        origin: "Atlanta, GA",
        destination: "Nashville, TN",
        rate: 1500.0,
        status: "pending",
      },
      request,
    );
    expect([200, 201]).toContain(createRes.status());

    const archiveRes = await admin.patch(
      `${API_BASE}/api/quotes/${archiveQuoteId}/archive`,
      {},
      request,
    );
    expect([200, 201]).toContain(archiveRes.status());
  });
});

// -- COM-02: Full conversion pipeline: quote -> booking -> load --

test.describe("COM-02: Quote to Booking to Load Conversion Pipeline", () => {
  let admin: AuthContext;
  let pipelineQuoteId: string;
  let pipelineBookingId: string;
  let pipelineLoadId: string;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Step 1: Create quote for conversion pipeline", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    pipelineQuoteId = uuidv4();
    const payload = {
      id: pipelineQuoteId,
      quoteNumber: `QTE-PIPELINE-${Date.now()}`,
      customerName: "QA Pipeline Customer",
      customerEmail: "qa-pipeline@loadpilot-e2e.dev",
      origin: "Chicago, IL",
      destination: "Indianapolis, IN",
      weight: 18000,
      commodity: "QA pipeline conversion freight",
      equipmentType: "flatbed",
      pickupDate: new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .split("T")[0],
      deliveryDate: new Date(Date.now() + 8 * 86400000)
        .toISOString()
        .split("T")[0],
      rate: 2800.0,
      status: "pending",
    };

    const res = await admin.post(`${API_BASE}/api/quotes`, payload, request);
    expect([200, 201]).toContain(res.status());

    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      if (body.id) pipelineQuoteId = body.id;
    }
  });

  test("Step 2: Approve quote", async ({ request }) => {
    test.skip(!admin.hasToken || !pipelineQuoteId, "Requires prior step");

    const res = await admin.patch(
      `${API_BASE}/api/quotes/${pipelineQuoteId}`,
      { status: "approved" },
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 3: Create booking from approved quote", async ({ request }) => {
    test.skip(!admin.hasToken || !pipelineQuoteId, "Requires prior step");

    pipelineBookingId = uuidv4();
    const bookingPayload = {
      id: pipelineBookingId,
      quoteId: pipelineQuoteId,
      status: "Accepted",
      requiresAppt: false,
      specialInstructions: "QA pipeline conversion test",
      origin: "Chicago, IL",
      destination: "Indianapolis, IN",
      weight: 18000,
      commodity: "QA pipeline converted freight",
      pickupDate: new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .split("T")[0],
      rate: 2800.0,
    };

    const res = await admin.post(
      `${API_BASE}/api/bookings`,
      bookingPayload,
      request,
    );
    expect([200, 201]).toContain(res.status());

    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      if (body.id) pipelineBookingId = body.id;
    }
  });

  test("Step 4: Update booking to Ready_for_Dispatch", async ({ request }) => {
    test.skip(!admin.hasToken || !pipelineBookingId, "Requires prior step");

    const res = await admin.patch(
      `${API_BASE}/api/bookings/${pipelineBookingId}`,
      { status: "Ready_for_Dispatch" },
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 5: Create load from booking data", async ({ request }) => {
    test.skip(!admin.hasToken || !pipelineBookingId, "Requires prior step");

    pipelineLoadId = uuidv4();
    const loadPayload = makeLoadDraft({
      id: pipelineLoadId,
      load_number: `QA-PIPELINE-${Date.now()}`,
      commodity: "QA freight converted from quote/booking pipeline",
      weight: 18000,
      freight_type: "flatbed",
      booking_id: pipelineBookingId,
      legs: [
        { type: "pickup", city: "Chicago", state: "IL", sequence_order: 0 },
        {
          type: "delivery",
          city: "Indianapolis",
          state: "IN",
          sequence_order: 1,
        },
      ],
    });

    const res = await admin.post(`${API_BASE}/api/loads`, loadPayload, request);
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    pipelineLoadId = body.id || pipelineLoadId;
  });

  test("Step 6: Transition load through planned -> dispatched", async ({
    request,
  }) => {
    test.skip(!admin.hasToken || !pipelineLoadId, "Requires prior step");

    // Plan the load
    const planRes = await admin.patch(
      `${API_BASE}/api/loads/${pipelineLoadId}/status`,
      makeLoadStatusTransition("planned"),
      request,
    );
    expect([200, 201]).toContain(planRes.status());

    // Dispatch the load
    const dispatchRes = await admin.patch(
      `${API_BASE}/api/loads/${pipelineLoadId}/status`,
      makeLoadStatusTransition("dispatched"),
      request,
    );
    expect([200, 201]).toContain(dispatchRes.status());
  });

  test("Step 7: Verify dispatched load persists", async ({ request }) => {
    test.skip(!admin.hasToken || !pipelineLoadId, "Requires prior step");

    const res = await admin.get(`${API_BASE}/api/loads`, request);
    expect(res.status()).toBe(200);

    const loads = await res.json();
    const found = loads.find(
      (l: Record<string, unknown>) => l.id === pipelineLoadId,
    );
    expect(found).toBeDefined();
    expect(found.status).toBe("dispatched");
  });
});

// -- Auth enforcement on quote and booking endpoints (always runs) --

test.describe("Quote Conversion: Auth Boundary Enforcement", () => {
  test("GET /api/quotes — unauthenticated access is rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/quotes`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET /api/bookings — unauthenticated access is rejected", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/bookings`);
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("POST /api/quotes — unauthenticated quote creation is rejected", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/quotes`, {
      data: {
        id: uuidv4(),
        quoteNumber: "UNAUTH-QTE-001",
        customerName: "Attacker",
        rate: 9999,
        status: "pending",
      },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("POST /api/bookings — unauthenticated booking creation is rejected", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/bookings`, {
      data: {
        id: uuidv4(),
        quoteId: "stolen-quote-id",
        status: "Accepted",
      },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(201);
  });

  test("PATCH /api/quotes/:id — unauthenticated update is rejected", async ({
    request,
  }) => {
    const res = await request.patch(`${API_BASE}/api/quotes/${uuidv4()}`, {
      data: { status: "approved" },
    });
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("PATCH /api/bookings/:id — unauthenticated update is rejected", async ({
    request,
  }) => {
    const res = await request.patch(`${API_BASE}/api/bookings/${uuidv4()}`, {
      data: { status: "Ready_for_Dispatch" },
    });
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Invalid Bearer token rejected on quotes endpoint", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/quotes`, {
      headers: { Authorization: "Bearer invalid-token-qa-quotes" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Unauthenticated request does not leak quote data", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/quotes`);
    expect([401, 403, 500]).toContain(res.status());
    if (res.status() === 401 || res.status() === 403) {
      const body = await res.json();
      // Error response must not contain quote business data
      expect(body).not.toHaveProperty("quoteNumber");
      expect(body).not.toHaveProperty("customerName");
      expect(body).not.toHaveProperty("rate");
    }
  });
});
