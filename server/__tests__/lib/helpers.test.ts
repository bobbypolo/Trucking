import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for server/helpers.ts
 *
 * Functions:
 * - redactData: redacts sensitive fields based on role and visibility settings
 * - sendNotification: logs email notifications
 * - checkBreakdownLateness: calculates breakdown lateness risk
 * - getVisibilitySettings: fetches driver visibility settings from company
 */

const { mockQuery, mockDeliverNotification } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockDeliverNotification: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../services/notification-delivery.service", () => ({
  deliverNotification: mockDeliverNotification,
}));

import {
  redactData,
  sendNotification,
  checkBreakdownLateness,
  getVisibilitySettings,
} from "../../helpers";
import { logger } from "../../lib/logger";

describe("helpers.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("redactData", () => {
    const settings = {
      hideRates: true,
      showDriverPay: false,
      maskCustomerName: true,
      hideBrokerContacts: true,
    };

    it("returns data unchanged for non-driver roles", () => {
      const data = { carrier_rate: 1500, daily_cost: 200 };
      expect(redactData(data, "admin", settings)).toEqual(data);
      expect(redactData(data, "dispatcher", settings)).toEqual(data);
      expect(redactData(data, "owner", settings)).toEqual(data);
    });

    it("returns data unchanged when settings is null/undefined", () => {
      const data = { carrier_rate: 1500 };
      expect(redactData(data, "driver", null)).toEqual(data);
      expect(redactData(data, "driver", undefined)).toEqual(data);
    });

    it("redacts rate fields for driver when hideRates is true", () => {
      const data = {
        id: "load-1",
        carrier_rate: 1500,
        daily_cost: 200,
        base_amount: 1000,
        unit_amount: 50,
        driver_pay: 800,
        description: "Test load",
      };

      const result = redactData(data, "driver", settings);

      expect(result.carrier_rate).toBeUndefined();
      expect(result.daily_cost).toBeUndefined();
      expect(result.base_amount).toBeUndefined();
      expect(result.unit_amount).toBeUndefined();
      expect(result.driver_pay).toBeUndefined();
      expect(result.id).toBe("load-1");
      expect(result.description).toBe("Test load");
    });

    it("keeps driver_pay when showDriverPay is true", () => {
      const settingsWithPay = { ...settings, showDriverPay: true };
      const data = {
        carrier_rate: 1500,
        driver_pay: 800,
      };

      const result = redactData(data, "driver", settingsWithPay);

      expect(result.carrier_rate).toBeUndefined();
      expect(result.driver_pay).toBe(800);
    });

    it("masks facility_name when maskCustomerName is true", () => {
      const data = {
        facility_name: "Acme Corp Warehouse",
      };

      const result = redactData(data, "driver", settings);
      expect(result.facility_name).toBe("Confidential Facility");
    });

    it("masks customer/broker name when maskCustomerName is true", () => {
      const brokerData = { name: "Big Broker Inc", type: "Broker" };
      const customerData = { name: "Direct Corp", type: "Direct Customer" };
      const carrierData = { name: "Carrier Co", type: "Carrier" };

      expect(redactData(brokerData, "driver", settings).name).toBe(
        "Confidential Client",
      );
      expect(redactData(customerData, "driver", settings).name).toBe(
        "Confidential Client",
      );
      // Carrier type should NOT be masked
      expect(redactData(carrierData, "driver", settings).name).toBe("Carrier Co");
    });

    it("hides broker contact fields when hideBrokerContacts is true", () => {
      const data = {
        id: "broker-1",
        email: "broker@test.com",
        phone: "555-1234",
        address: "123 Main St",
        name: "My Broker",
      };

      const result = redactData(data, "driver", settings);
      expect(result.email).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.id).toBe("broker-1");
    });

    it("redacts array of items (loads list)", () => {
      const data = [
        { id: "load-1", carrier_rate: 1500, facility_name: "Warehouse A" },
        { id: "load-2", carrier_rate: 2000, facility_name: "Warehouse B" },
      ];

      const result = redactData(data, "driver", settings);

      expect(result).toHaveLength(2);
      expect(result[0].carrier_rate).toBeUndefined();
      expect(result[0].facility_name).toBe("Confidential Facility");
      expect(result[1].carrier_rate).toBeUndefined();
      expect(result[1].facility_name).toBe("Confidential Facility");
    });

    it("redacts nested legs within array items", () => {
      const data = [
        {
          id: "load-1",
          carrier_rate: 1500,
          legs: [
            {
              carrier_rate: 500,
              facility_name: "Pickup A",
            },
            {
              carrier_rate: 1000,
              facility_name: "Dropoff B",
            },
          ],
        },
      ];

      const result = redactData(data, "driver", settings);

      expect(result[0].carrier_rate).toBeUndefined();
      expect(result[0].legs[0].carrier_rate).toBeUndefined();
      expect(result[0].legs[0].facility_name).toBe("Confidential Facility");
      expect(result[0].legs[1].carrier_rate).toBeUndefined();
      expect(result[0].legs[1].facility_name).toBe("Confidential Facility");
    });

    it("redacts nested legs within a single object", () => {
      const data = {
        id: "load-1",
        carrier_rate: 1500,
        legs: [
          { carrier_rate: 500, facility_name: "Pickup" },
        ],
      };

      const result = redactData(data, "driver", settings);

      expect(result.carrier_rate).toBeUndefined();
      expect(result.legs[0].carrier_rate).toBeUndefined();
      expect(result.legs[0].facility_name).toBe("Confidential Facility");
    });

    it("handles data with no redactable fields", () => {
      const data = { id: "load-1", status: "in_transit" };
      const result = redactData(data, "driver", settings);
      expect(result.id).toBe("load-1");
      expect(result.status).toBe("in_transit");
    });

    it("handles object with no legs array", () => {
      const data = { id: "load-1", carrier_rate: 1500 };
      const result = redactData(data, "driver", settings);
      expect(result.carrier_rate).toBeUndefined();
      expect(result.legs).toBeUndefined();
    });
  });

  describe("sendNotification", () => {
    beforeEach(() => {
      mockDeliverNotification.mockResolvedValue({ status: "SENT", sent_at: new Date().toISOString() });
    });

    it("calls deliverNotification with channel email and correct recipients (R-P3-12)", () => {
      sendNotification(
        ["admin@test.com", "driver@test.com"],
        "Load Update",
        "Load #123 status changed",
      );

      expect(mockDeliverNotification).toHaveBeenCalledWith({
        channel: "email",
        subject: "Load Update",
        message: "Load #123 status changed",
        recipients: [
          { email: "admin@test.com" },
          { email: "driver@test.com" },
        ],
      });
    });

    it("logs notification info when emails are provided", () => {
      sendNotification(
        ["admin@test.com", "driver@test.com"],
        "Load Update",
        "Load #123 status changed",
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@test.com, driver@test.com",
          subject: "Load Update",
          message: "Load #123 status changed",
        }),
        "Email notification dispatched",
      );
    });

    it("does not throw when deliverNotification rejects (R-P3-13)", () => {
      mockDeliverNotification.mockRejectedValue(new Error("SMTP down"));

      // fire-and-forget: sendNotification must not throw
      expect(() => {
        sendNotification(["fail@test.com"], "Subject", "Body");
      }).not.toThrow();
    });

    it("does nothing when emails array is empty (R-P3-14)", () => {
      sendNotification([], "Subject", "Message");
      expect(mockDeliverNotification).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("does nothing when emails is null/undefined", () => {
      sendNotification(null as any, "Subject", "Message");
      expect(mockDeliverNotification).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();

      sendNotification(undefined as any, "Subject", "Message");
      expect(mockDeliverNotification).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("checkBreakdownLateness", () => {
    it("returns isLate: false when no dropoff legs exist", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await checkBreakdownLateness("load-1", 32.0, -96.0);
      expect(result.isLate).toBe(false);
    });

    it("calculates lateness risk based on distance to destination", async () => {
      const dropoffLeg = {
        id: "leg-1",
        load_id: "load-1",
        type: "Dropoff",
        sequence_order: 1,
      };
      mockQuery.mockResolvedValueOnce([[dropoffLeg], []]);

      // Point near Denver (the hardcoded destination)
      const result = await checkBreakdownLateness("load-1", 39.5, -105.0);

      expect(result).toHaveProperty("dist");
      expect(result).toHaveProperty("required");
      expect(result).toHaveProperty("isLate");
      expect(typeof result.dist).toBe("number");
      expect(typeof result.required).toBe("number");
    });

    it("returns isLate: true for far-away breakdown location", async () => {
      const dropoffLeg = { id: "leg-1", type: "Dropoff", sequence_order: 1 };
      mockQuery.mockResolvedValueOnce([[dropoffLeg], []]);

      // Point very far from Denver (e.g., Miami at 25.7617, -80.1918)
      const result = await checkBreakdownLateness("load-1", 25.7617, -80.1918);

      // Distance ~1700 miles, transit ~34h + 4h recovery = ~38h > 12h threshold
      expect(result.isLate).toBe(true);
      expect(result.dist).toBeGreaterThan(1500);
    });

    it("returns isLate: false for nearby breakdown location", async () => {
      const dropoffLeg = { id: "leg-1", type: "Dropoff", sequence_order: 1 };
      mockQuery.mockResolvedValueOnce([[dropoffLeg], []]);

      // Very close to Denver
      const result = await checkBreakdownLateness("load-1", 39.7, -105.0);

      // Distance < 30 miles, transit < 1h + 4h = ~5h < 12h
      expect(result.isLate).toBe(false);
    });

    it("returns isLate: false on DB query error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB error"));

      const result = await checkBreakdownLateness("load-1", 32.0, -96.0);
      expect(result.isLate).toBe(false);
    });
  });

  describe("getVisibilitySettings", () => {
    it("returns parsed settings when stored as JSON string", async () => {
      const settingsObj = { hideRates: true, maskCustomerName: false };
      mockQuery.mockResolvedValueOnce([
        [{ driver_visibility_settings: JSON.stringify(settingsObj) }],
        [],
      ]);

      const result = await getVisibilitySettings("company-abc");
      expect(result).toEqual(settingsObj);
    });

    it("returns object directly when stored as object (not string)", async () => {
      const settingsObj = { hideRates: true };
      mockQuery.mockResolvedValueOnce([
        [{ driver_visibility_settings: settingsObj }],
        [],
      ]);

      const result = await getVisibilitySettings("company-abc");
      expect(result).toEqual(settingsObj);
    });

    it("returns null when company has no settings", async () => {
      mockQuery.mockResolvedValueOnce([[{ driver_visibility_settings: null }], []]);

      const result = await getVisibilitySettings("company-abc");
      expect(result).toBeNull();
    });

    it("returns null when company not found", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await getVisibilitySettings("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null and logs error on invalid JSON", async () => {
      mockQuery.mockResolvedValueOnce([
        [{ driver_visibility_settings: "not-json{" }],
        [],
      ]);

      const result = await getVisibilitySettings("company-abc");
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
