import { describe, it, expect, vi } from "vitest";

import {
  generateDriverSafeLoadDTO,
  generateDriverLoadSheet,
} from "../../../services/driverSafeService";
import type { LoadData, Company } from "../../../types";

vi.mock("jspdf", () => ({
  jsPDF: class MockJsPDF {
    setFontSize = vi.fn();
    text = vi.fn();
    save = vi.fn();
    autoTable = vi.fn();
    lastAutoTable = { finalY: 100 };
  },
}));

vi.mock("jspdf-autotable", () => ({}));

describe("driverSafeService", () => {
  const makeLoad = (): LoadData =>
    ({
      id: "load-001",
      loadNumber: "LD-5678",
      carrierRate: 2500,
      driverPay: 1800,
      broker: {
        name: "Acme Freight",
        phone: "555-123-4567",
        email: "broker@acme.com",
      },
      pickup: { facilityName: "Port of LA" },
      dropoff: { facilityName: "Dallas Hub" },
    }) as any;

  const makeCompany = (
    overrides: Partial<Company["driverVisibilitySettings"]> = {},
  ): Company =>
    ({
      id: "co-1",
      name: "Test Carrier",
      driverVisibilitySettings: {
        hideRates: false,
        hideBrokerContacts: false,
        maskCustomerName: false,
        showDriverPay: false,
        allowRateCon: false,
        enableDriverSafePack: false,
        autoRedactDocs: false,
        ...overrides,
      },
    }) as Company;

  // --- generateDriverSafeLoadDTO ---
  describe("generateDriverSafeLoadDTO", () => {
    it("returns the load data unmodified when no redaction is enabled", () => {
      const result = generateDriverSafeLoadDTO(makeLoad(), makeCompany());
      expect(result.carrierRate).toBe(2500);
      expect(result.driverPay).toBe(1800);
      expect(result.broker.name).toBe("Acme Freight");
      expect(result.broker.phone).toBe("555-123-4567");
      expect(result.pickup.facilityName).toBe("Port of LA");
    });

    it("redacts carrier rate when hideRates is true", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({ hideRates: true }),
      );
      expect(result.carrierRate).toBeUndefined();
    });

    it("hides driver pay when hideRates is true and showDriverPay is false", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({ hideRates: true, showDriverPay: false }),
      );
      expect(result.driverPay).toBeUndefined();
    });

    it("shows driver pay when hideRates is true but showDriverPay is true", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({ hideRates: true, showDriverPay: true }),
      );
      expect(result.carrierRate).toBeUndefined();
      expect(result.driverPay).toBe(1800);
    });

    it("redacts broker contacts when hideBrokerContacts is true", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({ hideBrokerContacts: true }),
      );
      expect(result.broker.phone).toBe("---");
      expect(result.broker.email).toBe("---");
      expect(result.broker.name).toBe("Acme Freight"); // name not masked
    });

    it("masks broker name when both hideBrokerContacts and maskCustomerName are true", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({
          hideBrokerContacts: true,
          maskCustomerName: true,
        }),
      );
      expect(result.broker.name).toBe("Confidential Partner");
      expect(result.broker.phone).toBe("---");
      expect(result.broker.email).toBe("---");
    });

    it("masks facility names when maskCustomerName is true", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({ maskCustomerName: true }),
      );
      expect(result.pickup.facilityName).toBe("Confidential Facility");
      expect(result.dropoff.facilityName).toBe("Confidential Facility");
    });

    it("does not mutate the original load object", () => {
      const load = makeLoad();
      const originalRate = load.carrierRate;
      generateDriverSafeLoadDTO(
        load,
        makeCompany({ hideRates: true }),
      );
      expect(load.carrierRate).toBe(originalRate);
    });

    it("applies all redactions simultaneously", () => {
      const result = generateDriverSafeLoadDTO(
        makeLoad(),
        makeCompany({
          hideRates: true,
          hideBrokerContacts: true,
          maskCustomerName: true,
          showDriverPay: false,
        }),
      );
      expect(result.carrierRate).toBeUndefined();
      expect(result.driverPay).toBeUndefined();
      expect(result.broker.name).toBe("Confidential Partner");
      expect(result.broker.phone).toBe("---");
      expect(result.broker.email).toBe("---");
      expect(result.pickup.facilityName).toBe("Confidential Facility");
      expect(result.dropoff.facilityName).toBe("Confidential Facility");
    });
  });

  // --- generateDriverLoadSheet (real PDF via jsPDF) ---
  describe("generateDriverLoadSheet", () => {
    it("generates a PDF without throwing (jsPDF mocked)", async () => {
      const load = makeLoad();
      const result = await generateDriverLoadSheet(load);
      expect(result).toBeUndefined();
    });

    it("returns void (no longer returns a path string)", async () => {
      const load = makeLoad();
      const result = await generateDriverLoadSheet(load);
      expect(result).toBeUndefined();
    });

    it("accepts optional company parameter for redaction", async () => {
      const load = makeLoad();
      const company = makeCompany({ hideRates: true });
      const result = await generateDriverLoadSheet(load, company);
      expect(result).toBeUndefined();
    });

    it("handles load without loadNumber gracefully", async () => {
      const load = { ...makeLoad(), loadNumber: undefined } as any;
      const result = await generateDriverLoadSheet(load);
      expect(result).toBeUndefined();
    });

    it("is an async function that returns a Promise", () => {
      const load = makeLoad();
      const result = generateDriverLoadSheet(load);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
