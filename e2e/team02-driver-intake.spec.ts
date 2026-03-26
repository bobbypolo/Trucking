import { Buffer } from "buffer";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import {
  API_BASE,
  makeAdminRequest,
  makeDriverRequest,
} from "./fixtures/auth.fixture";

const APP_BASE = process.env.E2E_APP_URL || "http://localhost:5173";
const SERVER_RUNNING = !!process.env.E2E_SERVER_RUNNING;
const UI_EMAIL =
  process.env.E2E_DRIVER_EMAIL ||
  process.env.E2E_TEST_EMAIL ||
  "driver1@loadpilot.com";
const UI_PASSWORD =
  process.env.E2E_DRIVER_PASSWORD || process.env.E2E_TEST_PASSWORD || "User123";

async function loginAsDriver(page: Page) {
  await page.goto(APP_BASE);
  await page.locator('input[type="email"]').first().fill(UI_EMAIL);
  await page.locator('input[type="password"]').first().fill(UI_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await expect(page.getByTestId("driver-nav-loads")).toBeVisible({
    timeout: 30_000,
  });
}

async function createLoadForIntake(
  request: APIRequestContext,
  idToken: string,
) {
  const loadId = uuidv4();
  const loadNumber = `T2-INTAKE-${Date.now().toString(36).toUpperCase()}`;
  const res = await request.post(`${API_BASE}/api/loads`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: {
      id: loadId,
      load_number: loadNumber,
      status: "draft",
      freight_type: "dry_van",
      commodity: "Team 2 intake freight",
      pickup_date: new Date().toISOString().split("T")[0],
      legs: [
        {
          id: uuidv4(),
          type: "Pickup",
          facility_name: "Driver Intake Pickup",
          city: "Dallas",
          state: "TX",
          date: new Date().toISOString().split("T")[0],
          appointment_time: "07:30",
          completed: false,
          sequence_order: 0,
        },
        {
          id: uuidv4(),
          type: "Dropoff",
          facility_name: "Driver Intake Dropoff",
          city: "Memphis",
          state: "TN",
          date: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          appointment_time: "15:30",
          completed: false,
          sequence_order: 1,
        },
      ],
    },
  });

  expect([200, 201]).toContain(res.status());
  return { loadId, loadNumber };
}

test.describe("Team 2 - Driver Intake Upload Flow", () => {
  test("multipart upload stores a real driver intake document", async ({
    request,
  }) => {
    const adminAuth = await makeAdminRequest();
    const driverAuth = await makeDriverRequest();
    test.skip(
      !adminAuth.hasToken || !driverAuth.hasToken,
      "Firebase tokens unavailable for intake validation",
    );

    const seeded = await createLoadForIntake(request, adminAuth.idToken);
    const uploadRes = await request.post(`${API_BASE}/api/documents`, {
      headers: { Authorization: `Bearer ${driverAuth.idToken}` },
      multipart: {
        file: {
          name: `${seeded.loadNumber}-driver-intake.pdf`,
          mimeType: "application/pdf",
          buffer: Buffer.from(
            "%PDF-1.4\n% Team 2 driver intake evidence\n%%EOF",
            "utf8",
          ),
        },
        document_type: "BOL",
        load_id: seeded.loadId,
        description: `Driver intake upload for ${seeded.loadNumber}`,
      },
    });

    expect([200, 201]).toContain(uploadRes.status());
    const uploadBody = await uploadRes.json();
    expect(uploadBody).toHaveProperty("documentId");

    const listRes = await request.get(
      `${API_BASE}/api/documents?load_id=${seeded.loadId}`,
      {
        headers: { Authorization: `Bearer ${driverAuth.idToken}` },
      },
    );
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.documents)).toBe(true);
    expect(
      listBody.documents.some(
        (doc: Record<string, unknown>) =>
          doc.id === uploadBody.documentId || doc.loadId === seeded.loadId,
      ),
    ).toBe(true);
  });

  test.skip(!SERVER_RUNNING, "Requires E2E_SERVER_RUNNING=1");

  test("browser New Intake uploads a real document and creates a load", async ({
    page,
    request,
  }) => {
    await loginAsDriver(page);
    await page.getByTestId("driver-nav-loads").click();
    await page.getByTestId("new-intake-loads").click();
    await expect(
      page.getByRole("heading", { name: "New Load Intake" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("scanner-upload-file").setInputFiles({
      name: "team2-driver-intake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n% Team 2 browser intake evidence\n%%EOF",
        "utf8",
      ),
    });

    await expect(page.getByTestId("intake-review-form")).toBeVisible({
      timeout: 10_000,
    });

    const pickupCity = `T2 BROWSER PICKUP ${Date.now().toString(36).toUpperCase()}`;
    const dropoffCity = `T2 BROWSER DROP ${Date.now().toString(36).toUpperCase()}`;

    await page.getByTestId("intake-pickup-city").fill(pickupCity);
    await page.getByTestId("intake-pickup-state").fill("IL");
    await page.getByTestId("intake-dropoff-city").fill(dropoffCity);
    await page.getByTestId("intake-dropoff-state").fill("TX");
    await page
      .getByTestId("intake-pickup-date")
      .fill(new Date().toISOString().split("T")[0]);
    await page
      .getByTestId("intake-commodity")
      .fill("Team 2 browser intake freight");
    await page.getByTestId("intake-reference").fill("BROWSER-BOL-2");
    await page.getByTestId("intake-weight").fill("42000");
    await page
      .getByTestId("intake-instructions")
      .fill("Browser evidence intake submission.");

    await page.getByTestId("intake-submit").click();
    await expect(
      page.getByText("Intake submitted and documents uploaded"),
    ).toBeVisible({
      timeout: 15_000,
    });

    const adminAuth = await makeAdminRequest();
    test.skip(!adminAuth.hasToken, "Firebase token unavailable for admin auth");

    const loadsRes = await request.get(`${API_BASE}/api/loads`, {
      headers: { Authorization: `Bearer ${adminAuth.idToken}` },
    });
    expect(loadsRes.status()).toBe(200);
    const loads = await loadsRes.json();
    const created = loads.find(
      (row: Record<string, unknown>) =>
        (row.pickup as Record<string, unknown> | undefined)?.city ===
          pickupCity || row.commodity === "Team 2 browser intake freight",
    ) as Record<string, unknown> | undefined;
    expect(created).toBeDefined();

    const docsRes = await request.get(
      `${API_BASE}/api/documents?load_id=${created?.id}`,
      {
        headers: { Authorization: `Bearer ${adminAuth.idToken}` },
      },
    );
    expect(docsRes.status()).toBe(200);
    const docs = await docsRes.json();
    expect(Array.isArray(docs.documents)).toBe(true);
    expect(docs.documents.length).toBeGreaterThan(0);
  });
});
