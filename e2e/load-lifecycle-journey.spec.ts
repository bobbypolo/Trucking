import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  makeDriverRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import { makeLoadDraft, makeLoadStatusTransition } from "./fixtures/data-factory";

/**
 * E2E Canonical Journey: Full Load Lifecycle
 *
 * Journey: Create load -> assign driver -> dispatch -> in-transit ->
 *          arrived -> delivered -> completed
 *
 * This tests the complete 8-state load lifecycle through the API,
 * verifying each status transition persists and the load reaches
 * terminal state.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

test.describe("Canonical Journey: Full Load Lifecycle", () => {
  let admin: AuthContext;
  let loadId: string;
  let loadNumber: string;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; full lifecycle requires real Firebase token",
  );

  test("Step 1: Create a draft load", async ({ request }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    loadId = uuidv4();
    loadNumber = `JOURNEY-LIFECYCLE-${Date.now()}`;
    const payload = makeLoadDraft({
      id: loadId,
      load_number: loadNumber,
      commodity: "Full lifecycle journey test freight",
      weight: 18000,
      freight_type: "dry_van",
      legs: [
        { type: "pickup", city: "Atlanta", state: "GA", sequence_order: 0 },
        { type: "delivery", city: "Nashville", state: "TN", sequence_order: 1 },
      ],
    });

    const res = await admin.post(`${API_BASE}/api/loads`, payload, request);
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    expect(body).toHaveProperty("id");
    loadId = body.id || loadId;
  });

  test("Step 2: Verify draft load persists", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.get(`${API_BASE}/api/loads`, request);
    expect(res.status()).toBe(200);

    const loads = await res.json();
    const found = loads.find(
      (l: Record<string, unknown>) =>
        l.id === loadId || l.load_number === loadNumber,
    );
    expect(found).toBeDefined();
    expect(found.status).toBe("draft");
  });

  test("Step 3: Transition draft -> planned", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("planned"),
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 4: Transition planned -> dispatched", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("dispatched"),
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 5: Transition dispatched -> in_transit", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("in_transit"),
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 6: Transition in_transit -> arrived", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("arrived"),
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 7: Transition arrived -> delivered", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("delivered"),
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 8: Transition delivered -> completed (terminal state)", async ({
    request,
  }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("completed"),
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 9: Verify completed load is in terminal state", async ({
    request,
  }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.get(`${API_BASE}/api/loads`, request);
    expect(res.status()).toBe(200);

    const loads = await res.json();
    const found = loads.find(
      (l: Record<string, unknown>) => l.id === loadId,
    );
    expect(found).toBeDefined();
    expect(found.status).toBe("completed");
  });

  test("Step 10: Completed load rejects further transitions", async ({
    request,
  }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("draft"),
      request,
    );
    // Terminal state: must reject backward transition
    expect([400, 403, 409, 422]).toContain(res.status());
  });
});

// -- Cancellation path --

test.describe("Canonical Journey: Load Cancellation Path", () => {
  let admin: AuthContext;
  let loadId: string;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Create and cancel a draft load", async ({ request }) => {
    test.skip(!admin.hasToken, "SKIP:NO_TOKEN:admin");

    loadId = uuidv4();
    const payload = makeLoadDraft({
      id: loadId,
      load_number: `JOURNEY-CANCEL-${Date.now()}`,
    });

    const createRes = await admin.post(
      `${API_BASE}/api/loads`,
      payload,
      request,
    );
    expect([200, 201]).toContain(createRes.status());
    const body = await createRes.json();
    loadId = body.id || loadId;

    // Cancel the draft
    const cancelRes = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("cancelled"),
      request,
    );
    expect([200, 201]).toContain(cancelRes.status());
  });

  test("Cancelled load rejects all transitions", async ({ request }) => {
    test.skip(!admin.hasToken || !loadId, "SKIP:NO_PRIOR_STATE");

    const res = await admin.patch(
      `${API_BASE}/api/loads/${loadId}/status`,
      makeLoadStatusTransition("planned"),
      request,
    );
    // Cancelled is terminal
    expect([400, 403, 409, 422]).toContain(res.status());
  });
});
