import { describe, it, expect, vi, afterEach } from "vitest";

// Mock firebase to control DEMO_MODE
vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: true,
}));

import { extractLoadData } from "../../../services/ocrService";
import * as firebase from "../../../services/firebase";

describe("ocrService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractLoadData", () => {
    it("throws in demo mode with a clear error message (no fake data returned)", async () => {
      // DEMO_MODE is mocked as true above
      const file = new File(["dummy"], "test-bol.pdf", {
        type: "application/pdf",
      });
      await expect(extractLoadData(file)).rejects.toThrow(
        "OCR extraction is not available in demo mode",
      );
    });

    it("demo mode error references server-side endpoint guidance", async () => {
      const file = new File(["dummy"], "test.pdf");
      await expect(extractLoadData(file)).rejects.toThrow(
        "server-side AI endpoint",
      );
    });

    it("throws in production mode (DEMO_MODE=false) directing to server endpoint", async () => {
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

    it("never returns fake load data in demo mode", async () => {
      const file = new File(["dummy"], "test.pdf");
      let result: unknown = undefined;
      try {
        result = await extractLoadData(file);
      } catch {
        // expected
      }
      // Should have thrown — result should never be set
      expect(result).toBeUndefined();
    });
  });
});
