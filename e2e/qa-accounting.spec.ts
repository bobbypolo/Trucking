import { test, expect } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  type AuthContext,
} from "./fixtures/auth.fixture";
import {
  makeFinSettlement,
  makeFinInvoiceItem,
  makeFinAccountingEntry,
} from "./fixtures/data-factory";

/**
 * QA-01 Acceptance: Accounting (COM-06)
 *
 * Covers:
 *   COM-06: Accounting reflects real backend data or honest empty states
 *   COM-05 (partial): Verify Accounting is separate from Driver Pay in API structure
 *
 * Tests accounting CRUD operations (chart of accounts, invoices, bills,
 * journal entries), data integrity, and auth enforcement across all
 * accounting endpoints.
 *
 * Requires: FIREBASE_WEB_API_KEY for authenticated requests
 */

// -- COM-06: Accounting endpoints return real data or empty state --

test.describe("COM-06: Accounting — Real Data or Empty State", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set; accounting tests require real Firebase token",
  );

  test("GET /api/accounting/accounts returns real chart of accounts or empty array", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/accounts`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Must be an array — real GL accounts or empty state
    expect(Array.isArray(body)).toBe(true);

    // If accounts exist, they should have standard GL fields
    if (body.length > 0) {
      const account = body[0];
      expect(account).toHaveProperty("account_number");
      expect(account).toHaveProperty("tenant_id");
    }
  });

  test("GET /api/accounting/invoices returns real invoices or empty array", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/invoices`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    // If invoices exist, verify they have real AR fields
    if (body.length > 0) {
      const invoice = body[0];
      expect(invoice).toHaveProperty("invoice_number");
      expect(invoice).toHaveProperty("total_amount");
      expect(invoice).toHaveProperty("status");
    }
  });

  test("GET /api/accounting/bills returns real bills or empty array", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/bills`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    // If bills exist, verify they have real AP fields
    if (body.length > 0) {
      const bill = body[0];
      expect(bill).toHaveProperty("bill_number");
      expect(bill).toHaveProperty("total_amount");
      expect(bill).toHaveProperty("status");
    }
  });

  test("Accounting data does not contain fake/hardcoded values", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const invoicesRes = await admin.get(
      `${API_BASE}/api/accounting/invoices`,
      request,
    );
    const invoices = await invoicesRes.json();

    for (const inv of invoices) {
      if (inv.invoice_number) {
        expect(inv.invoice_number).not.toContain("DEMO");
        expect(inv.invoice_number).not.toContain("FAKE");
        expect(inv.invoice_number).not.toContain("SAMPLE");
      }
    }

    const billsRes = await admin.get(
      `${API_BASE}/api/accounting/bills`,
      request,
    );
    const bills = await billsRes.json();

    for (const bill of bills) {
      if (bill.bill_number) {
        expect(bill.bill_number).not.toContain("DEMO");
        expect(bill.bill_number).not.toContain("FAKE");
      }
    }
  });
});

// -- Accounting CRUD operations --

test.describe("COM-06: Accounting CRUD — Invoice Lifecycle", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Step 1: Create a draft AR invoice", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const invoicePayload = {
      id: uuidv4(),
      customerId: `qa-acct-cust-${Date.now()}`,
      loadId: `qa-acct-load-${Date.now()}`,
      invoiceNumber: `INV-QA-${Date.now()}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "Draft",
      totalAmount: 3200.0,
      lines: [
        makeFinInvoiceItem({
          description: "QA E2E freight charge",
          unit_price: 3200.0,
          total: 3200.0,
        }),
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/accounting/invoices`,
      invoicePayload,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 2: Create a draft AP bill", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const billPayload = {
      id: uuidv4(),
      vendorId: `qa-acct-vendor-${Date.now()}`,
      billNumber: `BILL-QA-${Date.now()}`,
      billDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "Draft",
      totalAmount: 2100.0,
      lines: [
        makeFinInvoiceItem({
          description: "QA E2E carrier payment",
          unit_price: 2100.0,
          total: 2100.0,
        }),
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/accounting/bills`,
      billPayload,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Step 3: Retrieve invoices list after creation", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/invoices`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Step 4: Retrieve bills list after creation", async ({ request }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/bills`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Step 5: Invoice response includes enriched line items", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/invoices`, request);
    expect(res.status()).toBe(200);

    const invoices = await res.json();
    if (invoices.length > 0) {
      const invoice = invoices[0];
      expect(invoice).toHaveProperty("lines");
      expect(Array.isArray(invoice.lines)).toBe(true);
    }
  });
});

// -- Journal entry validation --

test.describe("COM-06: Journal Entry — GL Posting", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Create a balanced journal entry (debits = credits)", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const entryId = uuidv4();
    const entry = {
      id: entryId,
      entryDate: new Date().toISOString().split("T")[0],
      referenceNumber: `JE-QA-${Date.now()}`,
      description: "QA E2E balanced journal entry test",
      sourceDocumentType: "Manual",
      sourceDocumentId: `qa-manual-${Date.now()}`,
      createdBy: "qa-e2e-admin",
      lines: [
        {
          glAccountId: "GL-4000",
          debit: 0,
          credit: 5000.0,
          allocationType: "Load",
          allocationId: `qa-je-load-${Date.now()}`,
          notes: "QA revenue credit",
        },
        {
          glAccountId: "GL-1200",
          debit: 5000.0,
          credit: 0,
          allocationType: "Load",
          allocationId: `qa-je-load-${Date.now()}`,
          notes: "QA AR debit",
        },
      ],
    };

    const res = await admin.post(
      `${API_BASE}/api/accounting/journal`,
      entry,
      request,
    );
    expect([200, 201]).toContain(res.status());
  });

  test("Load P&L endpoint returns financial data structure", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(
      `${API_BASE}/api/accounting/load-pl/qa-test-load`,
      request,
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    // P&L response should have financial summary fields
    expect(body).toHaveProperty("loadId");
    expect(body).toHaveProperty("revenue");
    expect(body).toHaveProperty("costs");
    expect(body).toHaveProperty("margin");
    expect(body).toHaveProperty("marginPercent");
    expect(body).toHaveProperty("details");
  });

  test("IFTA summary returns tax calculation structure", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(
      `${API_BASE}/api/accounting/ifta-summary?quarter=1&year=2026`,
      request,
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("quarter");
    expect(body).toHaveProperty("year");
    expect(body).toHaveProperty("rows");
    expect(body).toHaveProperty("totalMiles");
    expect(body).toHaveProperty("totalGallons");
    expect(body).toHaveProperty("fleetAvgMpg");
    expect(body).toHaveProperty("netTaxDue");
    expect(Array.isArray(body.rows)).toBe(true);
  });

  test("Document vault endpoint returns data or empty array", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const res = await admin.get(`${API_BASE}/api/accounting/docs`, request);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// -- Accounting vs Driver Pay structural separation --

test.describe("COM-05/COM-06: Accounting vs Driver Pay — Structural Separation", () => {
  let admin: AuthContext;

  test.beforeAll(async () => {
    admin = await makeAdminRequest();
  });

  test.skip(
    !process.env.FIREBASE_WEB_API_KEY,
    "Skipped -- FIREBASE_WEB_API_KEY not set",
  );

  test("Invoices and settlements return different data structures", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const [invoicesRes, settlementsRes] = await Promise.all([
      admin.get(`${API_BASE}/api/accounting/invoices`, request),
      admin.get(`${API_BASE}/api/accounting/settlements`, request),
    ]);

    expect(invoicesRes.status()).toBe(200);
    expect(settlementsRes.status()).toBe(200);

    const invoices = await invoicesRes.json();
    const settlements = await settlementsRes.json();

    // Both return arrays
    expect(Array.isArray(invoices)).toBe(true);
    expect(Array.isArray(settlements)).toBe(true);

    // If both have data, verify they have non-overlapping primary keys
    if (invoices.length > 0 && settlements.length > 0) {
      const invoiceKeys = Object.keys(invoices[0]);
      const settlementKeys = Object.keys(settlements[0]);

      // Settlements have driver_id, invoices have customer_id
      expect(settlementKeys).toContain("driver_id");
      expect(invoiceKeys).not.toContain("driver_id");
    }
  });

  test("Bills and settlements return different data structures", async ({
    request,
  }) => {
    test.skip(!admin.hasToken, "No admin Firebase token available");

    const [billsRes, settlementsRes] = await Promise.all([
      admin.get(`${API_BASE}/api/accounting/bills`, request),
      admin.get(`${API_BASE}/api/accounting/settlements`, request),
    ]);

    expect(billsRes.status()).toBe(200);
    expect(settlementsRes.status()).toBe(200);

    const bills = await billsRes.json();
    const settlements = await settlementsRes.json();

    expect(Array.isArray(bills)).toBe(true);
    expect(Array.isArray(settlements)).toBe(true);

    if (bills.length > 0 && settlements.length > 0) {
      const billKeys = Object.keys(bills[0]);
      const settlementKeys = Object.keys(settlements[0]);

      // Bills have vendor_id, settlements have driver_id
      expect(billKeys).not.toContain("driver_id");
      expect(settlementKeys).not.toContain("vendor_id");
    }
  });
});

// -- Auth enforcement on all accounting endpoints (always runs) --

test.describe("Accounting: Auth Boundary Enforcement", () => {
  const accountingEndpoints = [
    { method: "GET" as const, path: "/api/accounting/accounts" },
    { method: "GET" as const, path: "/api/accounting/invoices" },
    { method: "GET" as const, path: "/api/accounting/bills" },
    { method: "GET" as const, path: "/api/accounting/settlements" },
    { method: "GET" as const, path: "/api/accounting/docs" },
    {
      method: "GET" as const,
      path: "/api/accounting/ifta-summary?quarter=1&year=2026",
    },
    { method: "GET" as const, path: "/api/accounting/mileage" },
    {
      method: "GET" as const,
      path: "/api/accounting/load-pl/test-load-id",
    },
  ];

  for (const ep of accountingEndpoints) {
    test(`${ep.method} ${ep.path} — unauthenticated access rejected`, async ({
      request,
    }) => {
      const res = await request.get(`${API_BASE}${ep.path}`);
      expect(
        [401, 403, 500],
        `${ep.path} should reject unauthenticated GET`,
      ).toContain(res.status());
      expect(res.status()).not.toBe(200);
    });
  }

  const writeEndpoints = [
    { method: "POST" as const, path: "/api/accounting/invoices" },
    { method: "POST" as const, path: "/api/accounting/bills" },
    { method: "POST" as const, path: "/api/accounting/settlements" },
    { method: "POST" as const, path: "/api/accounting/journal" },
    { method: "POST" as const, path: "/api/accounting/docs" },
    { method: "POST" as const, path: "/api/accounting/mileage" },
    { method: "POST" as const, path: "/api/accounting/adjustments" },
    { method: "POST" as const, path: "/api/accounting/batch-import" },
  ];

  for (const ep of writeEndpoints) {
    test(`${ep.method} ${ep.path} — unauthenticated write rejected`, async ({
      request,
    }) => {
      const res = await request.post(`${API_BASE}${ep.path}`, {
        data: {},
      });
      expect(
        [400, 401, 403, 500],
        `${ep.path} should reject unauthenticated POST`,
      ).toContain(res.status());
      expect(res.status()).not.toBe(200);
      expect(res.status()).not.toBe(201);
    });
  }

  test("Invalid Bearer token rejected on accounting endpoints", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/accounts`, {
      headers: { Authorization: "Bearer invalid-token-qa-accounting" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Malformed Authorization header rejected", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/accounting/invoices`, {
      headers: { Authorization: "NotBearer invalid-scheme" },
    });
    expect([401, 403, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("PATCH /api/accounting/docs/:id — unauthenticated status update rejected", async ({
    request,
  }) => {
    const res = await request.patch(
      `${API_BASE}/api/accounting/docs/qa-doc-001`,
      { data: { status: "Posted", is_locked: true } },
    );
    expect([401, 403, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("Accounting error responses are structured JSON, not HTML", async ({
    request,
  }) => {
    const endpoints = [
      "/api/accounting/accounts",
      "/api/accounting/invoices",
      "/api/accounting/bills",
    ];

    for (const ep of endpoints) {
      const res = await request.get(`${API_BASE}${ep}`);
      expect([401, 403, 500]).toContain(res.status());
      if (res.status() !== 500) {
        const contentType = res.headers()["content-type"] ?? "";
        expect(
          contentType,
          `${ep} should return JSON error, not HTML`,
        ).toContain("json");
      }
    }
  });

  test("No accounting endpoint leaks financial data without auth", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/accounting/settlements`);
    expect([401, 403, 500]).toContain(res.status());
    if (res.status() === 401 || res.status() === 403) {
      const body = await res.json();
      expect(body).not.toHaveProperty("net_pay");
      expect(body).not.toHaveProperty("total_amount");
      expect(body).not.toHaveProperty("lines");
      expect(body).not.toHaveProperty("data");
      expect(body).not.toHaveProperty("account_number");
    }
  });
});
