import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for server/firestore.ts
 *
 * This module initializes Firestore from the Firebase Admin SDK.
 * When Firebase Admin is not configured, it creates a Proxy that throws
 * descriptive errors on use.
 *
 * We mock firebase-admin at the boundary (external service).
 */

describe("server/firestore.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("when Firebase Admin is configured", () => {
    it("exports a Firestore instance with settings applied", async () => {
      const mockSettings = vi.fn();
      const mockFirestore = {
        settings: mockSettings,
        collection: vi.fn(),
      };

      vi.doMock("../../auth", () => ({
        default: {
          firestore: () => mockFirestore,
        },
      }));

      vi.doMock("../../lib/logger", () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));

      const mod = await import("../../firestore");
      expect(mod.default).toBe(mockFirestore);
      expect(mockSettings).toHaveBeenCalledWith({
        ignoreUndefinedProperties: true,
      });
    });
  });

  describe("when Firebase Admin is NOT configured", () => {
    it("exports a Proxy that throws on collection()", async () => {
      vi.doMock("../../auth", () => ({
        default: {
          firestore: () => {
            throw new Error("Firebase not initialized");
          },
        },
      }));

      vi.doMock("../../lib/logger", () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));

      const mod = await import("../../firestore");
      const db = mod.default;

      expect(db).toBeDefined();
      expect(() => (db as any).collection("test")).toThrow(
        "Firestore is not available",
      );
    });

    it("exports a Proxy that throws on doc()", async () => {
      vi.doMock("../../auth", () => ({
        default: {
          firestore: () => {
            throw new Error("Firebase not initialized");
          },
        },
      }));

      vi.doMock("../../lib/logger", () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));

      const mod = await import("../../firestore");
      const db = mod.default;

      expect(() => (db as any).doc("test/doc")).toThrow(
        "Firestore is not available",
      );
    });

    it("exports a Proxy that throws on runTransaction()", async () => {
      vi.doMock("../../auth", () => ({
        default: {
          firestore: () => {
            throw new Error("Firebase not initialized");
          },
        },
      }));

      vi.doMock("../../lib/logger", () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));

      const mod = await import("../../firestore");
      const db = mod.default;

      expect(() => (db as any).runTransaction(() => {})).toThrow(
        "Firestore is not available",
      );
    });

    it("returns undefined for non-intercepted properties", async () => {
      vi.doMock("../../auth", () => ({
        default: {
          firestore: () => {
            throw new Error("Firebase not initialized");
          },
        },
      }));

      vi.doMock("../../lib/logger", () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));

      const mod = await import("../../firestore");
      const db = mod.default;

      expect((db as any).someRandomProp).toBeUndefined();
    });

    it("logs a warning when Firestore initialization fails", async () => {
      const mockWarn = vi.fn();

      vi.doMock("../../auth", () => ({
        default: {
          firestore: () => {
            throw new Error("Firebase not initialized");
          },
        },
      }));

      vi.doMock("../../lib/logger", () => ({
        logger: {
          info: vi.fn(),
          warn: mockWarn,
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));

      await import("../../firestore");

      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining("Firestore not initialized"),
      );
    });
  });
});
