import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase to control DEMO_MODE
vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: true,
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

import { extractLoadData } from "../../../services/ocrService";
import * as firebase from "../../../services/firebase";

describe("ocrService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractLoadData", () => {
    it("returns OCR result with load data in demo mode", async () => {
      const file = new File(["dummy"], "test-bol.pdf", {
        type: "application/pdf",
      });
      const result = await extractLoadData(file);
      expect(result.confidence).toBe(0.94);
      expect(result.loadData).toBeDefined();
      expect(result.loadData.carrierRate).toBe(1850.0);
      expect(result.loadData.containerNumber).toBe("SZLU 928374");
      expect(result.loadData.containerSize).toBe("40' High Cube");
      expect(result.loadData.chassisProvider).toBe("DCLI");
      expect(result.loadData.commodity).toBe("ELECTRONICS - FLAT PANEL TVS");
      expect(result.loadData.weight).toBe(42500);
    });

    it("generates a load number with LD- prefix", async () => {
      const file = new File(["dummy"], "test.pdf");
      const result = await extractLoadData(file);
      expect(result.loadData.loadNumber).toMatch(/^LD-\d{4}$/);
    });

    it("includes pickup and dropoff legs", async () => {
      const file = new File(["dummy"], "test.pdf");
      const result = await extractLoadData(file);
      const legs = result.loadData.legs!;
      expect(legs).toHaveLength(2);
      expect(legs[0].type).toBe("Pickup");
      expect(legs[0].location!.facilityName).toBe(
        "APM TERMINALS - PIER 400",
      );
      expect(legs[0].location!.city).toBe("Los Angeles");
      expect(legs[0].location!.state).toBe("CA");
      expect(legs[0].completed).toBe(false);
      expect(legs[1].type).toBe("Dropoff");
      expect(legs[1].location!.facilityName).toBe("KCI WHSE - RIVERSIDE");
      expect(legs[1].location!.city).toBe("Riverside");
    });

    it("sets pickupDate to today", async () => {
      const file = new File(["dummy"], "test.pdf");
      const result = await extractLoadData(file);
      const today = new Date().toISOString().split("T")[0];
      expect(result.loadData.pickupDate).toBe(today);
    });

    it("throws in production mode (DEMO_MODE=false)", async () => {
      // Override DEMO_MODE for this test
      Object.defineProperty(firebase, "DEMO_MODE", {
        value: false,
        writable: true,
      });
      const file = new File(["dummy"], "test.pdf");
      await expect(extractLoadData(file)).rejects.toThrow(
        "OCR extraction requires the server-side AI endpoint",
      );
      // Restore
      Object.defineProperty(firebase, "DEMO_MODE", {
        value: true,
        writable: true,
      });
    });
  });
});
