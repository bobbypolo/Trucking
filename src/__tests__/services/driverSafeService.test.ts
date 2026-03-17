import { describe, it, expect } from "vitest";

import {
  generateDriverSafeLoadDTO,
  generateDriverLoadSheet,
} from "../../../services/driverSafeService";
import type { LoadData, Company } from "../../../types";

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

  // --- generateDriverLoadSheet ---
  describe("generateDriverLoadSheet", () => {
    it("returns a PDF path containing the load number", () => {
      const load = makeLoad();
      const result = generateDriverLoadSheet(load);
      expect(result).toBe("load-sheets/LD-LD-5678-safe.pdf");
    });

    it("includes 'load-sheets/' prefix and '-safe.pdf' suffix", () => {
      const load = { ...makeLoad(), loadNumber: "9999" } as any;
      const result = generateDriverLoadSheet(load);
      expect(result).toMatch(/^load-sheets\//);
      expect(result).toMatch(/-safe\.pdf$/);
    });
  });
});
