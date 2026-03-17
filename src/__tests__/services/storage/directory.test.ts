/**
 * Tests for services/storage/directory.ts
 * Directory domain -- Contacts & Providers via server API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn(),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

import {
  getProviders,
  saveProvider,
  getContacts,
  saveContact,
  getDirectory,
} from "../../../../services/storage/directory";

describe("directory.ts — Providers", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getProviders", () => {
    it("calls GET /api/providers and returns providers array", async () => {
      const fakeProviders = [
        { id: "p1", name: "Tow Co", type: "Tow" },
        { id: "p2", name: "Tire Shop", type: "Tire" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ providers: fakeProviders }),
      });

      const result = await getProviders();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/providers");
      expect(result).toEqual(fakeProviders);
    });

    it("returns empty array when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getProviders();
      expect(result).toEqual([]);
    });

    it("returns empty array when json.providers is not an array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ providers: "invalid" }),
      });

      const result = await getProviders();
      expect(result).toEqual([]);
    });

    it("returns empty array when json has no providers key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await getProviders();
      expect(result).toEqual([]);
    });

    it("returns empty array on fetch network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await getProviders();
      expect(result).toEqual([]);
    });
  });

  describe("saveProvider", () => {
    it("sends POST for new provider (no id)", async () => {
      const newProvider = { name: "New Tow", type: "Tow" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ provider: { ...newProvider, id: "p-new" } }),
      });

      const result = await saveProvider(newProvider as any);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/providers");
      expect(opts.method).toBe("POST");
      expect(result.id).toBe("p-new");
    });

    it("sends PATCH for existing provider (has id)", async () => {
      const existing = { id: "p1", name: "Updated Tow", type: "Tow" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ provider: existing }),
      });

      const result = await saveProvider(existing as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/providers/p1");
      expect(opts.method).toBe("PATCH");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
      });

      await expect(saveProvider({ id: "p1" } as any)).rejects.toThrow(
        "saveProvider failed: 422",
      );
    });

    it("returns original provider when json.provider is undefined", async () => {
      const provider = { id: "p1", name: "Tow Co", type: "Tow" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await saveProvider(provider as any);
      expect(result).toEqual(provider);
    });

    it("includes Content-Type header in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ provider: {} }),
      });

      await saveProvider({ id: "p1" } as any);

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers["Content-Type"]).toBe("application/json");
    });

    it("sends provider data as JSON body", async () => {
      const provider = { id: "p1", name: "Test", type: "Tow" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ provider }),
      });

      await saveProvider(provider as any);

      const [, opts] = mockFetch.mock.calls[0];
      expect(JSON.parse(opts.body)).toEqual(provider);
    });
  });
});

describe("directory.ts — Contacts", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getContacts", () => {
    it("calls GET /api/contacts and returns contacts array", async () => {
      const fakeContacts = [
        { id: "c1", name: "John", type: "Broker" },
        { id: "c2", name: "Jane", type: "Shipper" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: fakeContacts }),
      });

      const result = await getContacts();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/contacts");
      expect(result).toEqual(fakeContacts);
    });

    it("returns empty array when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      const result = await getContacts();
      expect(result).toEqual([]);
    });

    it("returns empty array when json.contacts is not an array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: null }),
      });

      const result = await getContacts();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const result = await getContacts();
      expect(result).toEqual([]);
    });
  });

  describe("saveContact", () => {
    it("sends POST for new contact (no id)", async () => {
      const newContact = { name: "Alice", type: "Customer" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { ...newContact, id: "c-new" } }),
      });

      const result = await saveContact(newContact as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/contacts");
      expect(opts.method).toBe("POST");
      expect(result.id).toBe("c-new");
    });

    it("sends PATCH for existing contact (has id)", async () => {
      const existing = { id: "c1", name: "Updated", type: "Broker" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: existing }),
      });

      await saveContact(existing as any);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:5000/api/contacts/c1");
      expect(opts.method).toBe("PATCH");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(saveContact({ id: "c1" } as any)).rejects.toThrow(
        "saveContact failed: 400",
      );
    });

    it("returns original contact when json.contact is undefined", async () => {
      const contact = { id: "c1", name: "Bob", type: "Shipper" as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await saveContact(contact as any);
      expect(result).toEqual(contact);
    });
  });
});

describe("directory.ts — getDirectory", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns both providers and contacts in a single call", async () => {
    const providers = [{ id: "p1", name: "Tow Co", type: "Tow" }];
    const contacts = [{ id: "c1", name: "John", type: "Broker" }];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ providers }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts }),
      });

    const result = await getDirectory();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.providers).toEqual(providers);
    expect(result.contacts).toEqual(contacts);
  });

  it("returns empty arrays when both APIs fail", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    const result = await getDirectory();

    expect(result.providers).toEqual([]);
    expect(result.contacts).toEqual([]);
  });

  it("fetches providers and contacts in parallel", async () => {
    let providerCallTime = 0;
    let contactCallTime = 0;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/providers")) {
        providerCallTime = Date.now();
        return { ok: true, json: async () => ({ providers: [] }) };
      }
      if (url.includes("/contacts")) {
        contactCallTime = Date.now();
        return { ok: true, json: async () => ({ contacts: [] }) };
      }
      return { ok: false };
    });

    await getDirectory();

    // Both calls should happen nearly simultaneously (within 50ms)
    expect(Math.abs(providerCallTime - contactCallTime)).toBeLessThan(50);
  });
});
