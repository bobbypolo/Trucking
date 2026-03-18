/**
 * Tests for services/storage/index.ts
 * Barrel export verification -- ensures all domains are re-exported.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("../../../../services/firebase", () => ({
  storage: {},
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("test-uuid"),
}));

describe("storage/index.ts — barrel exports", () => {
  it("re-exports core utilities", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getTenantKey).toBeTypeOf("function");
    expect(storage.migrateKey).toBeTypeOf("function");
  });

  it("re-exports quotes domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getQuotes).toBeTypeOf("function");
    expect(storage.saveQuote).toBeTypeOf("function");
  });

  it("re-exports leads domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getLeads).toBeTypeOf("function");
    expect(storage.saveLead).toBeTypeOf("function");
  });

  it("re-exports bookings domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getBookings).toBeTypeOf("function");
    expect(storage.saveBooking).toBeTypeOf("function");
  });

  it("re-exports messages domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getMessages).toBeTypeOf("function");
    expect(storage.saveMessage).toBeTypeOf("function");
  });

  it("re-exports calls domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getRawCalls).toBeTypeOf("function");
    expect(storage.saveCallSession).toBeTypeOf("function");
    expect(storage.attachToRecord).toBeTypeOf("function");
    expect(storage.linkSessionToRecord).toBeTypeOf("function");
  });

  it("re-exports tasks domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getRawTasks).toBeTypeOf("function");
    expect(storage.saveTask).toBeTypeOf("function");
    expect(storage.getRawWorkItems).toBeTypeOf("function");
    expect(storage.getWorkItems).toBeTypeOf("function");
    expect(storage.saveWorkItem).toBeTypeOf("function");
  });

  it("re-exports recovery domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.getRawCrisisActions).toBeTypeOf("function");
    expect(storage.saveCrisisAction).toBeTypeOf("function");
    expect(storage.getRawRequests).toBeTypeOf("function");
    expect(storage.getRequests).toBeTypeOf("function");
    expect(storage.saveRequest).toBeTypeOf("function");
    expect(storage.updateRequestStatus).toBeTypeOf("function");
    expect(storage.getUnresolvedRequests).toBeTypeOf("function");
    expect(storage.getRawServiceTickets).toBeTypeOf("function");
    expect(storage.saveServiceTicket).toBeTypeOf("function");
  });

  it("re-exports directory domain", async () => {
    const storage = await import("../../../../services/storage/index");
    expect(storage.saveProvider).toBeTypeOf("function");
    expect(storage.getProviders).toBeTypeOf("function");
    expect(storage.getContacts).toBeTypeOf("function");
    expect(storage.saveContact).toBeTypeOf("function");
    expect(storage.getDirectory).toBeTypeOf("function");
  });

  it("re-exports vault domain", async () => {
    const storage = await import("../../../../services/storage/index");
    // STORAGE_KEY_VAULT_DOCS removed — vault.ts now uses API (STORY-105)
    expect(
      (storage as Record<string, unknown>).STORAGE_KEY_VAULT_DOCS,
    ).toBeUndefined();
    expect(storage.getRawVaultDocs).toBeTypeOf("function");
    expect(storage.saveVaultDoc).toBeTypeOf("function");
    expect(storage.uploadVaultDoc).toBeTypeOf("function");
  });

  it("re-exports notifications domain", async () => {
    const storage = await import("../../../../services/storage/index");
    // STORAGE_KEY_NOTIFICATION_JOBS removed — notifications.ts now uses API (STORY-103)
    expect(
      (storage as Record<string, unknown>).STORAGE_KEY_NOTIFICATION_JOBS,
    ).toBeUndefined();
    expect(storage.getRawNotificationJobs).toBeTypeOf("function");
    expect(storage.saveNotificationJob).toBeTypeOf("function");
  });
});
