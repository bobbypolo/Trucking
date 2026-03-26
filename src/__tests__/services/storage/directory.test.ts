/**
 * Tests for services/storage/directory.ts
 * Directory domain -- Contacts & Providers via api client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

vi.mock("../../../../services/api", () => ({
  api: mockApi,
  apiFetch: vi.fn(),
}));

import {
  getProviders,
  saveProvider,
  getContacts,
  saveContact,
  getDirectory,
} from "../../../../services/storage/directory";

describe("directory.ts — Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProviders", () => {
    it("calls api.get /providers and returns providers array", async () => {
      const fakeProviders = [
        { id: "p1", name: "Tow Co", type: "Tow" },
        { id: "p2", name: "Tire Shop", type: "Tire" },
      ];
      mockApi.get.mockResolvedValueOnce({ providers: fakeProviders });

      const result = await getProviders();

      expect(mockApi.get).toHaveBeenCalledWith("/providers");
      expect(result).toEqual(fakeProviders);
    });

    it("returns empty array when API throws", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("500"));

      const result = await getProviders();
      expect(result).toEqual([]);
    });

    it("returns empty array when json.providers is not an array", async () => {
      mockApi.get.mockResolvedValueOnce({ providers: "invalid" });

      const result = await getProviders();
      expect(result).toEqual([]);
    });

    it("returns empty array when json has no providers key", async () => {
      mockApi.get.mockResolvedValueOnce({ data: [] });

      const result = await getProviders();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("Network failure"));

      const result = await getProviders();
      expect(result).toEqual([]);
    });
  });

  describe("saveProvider", () => {
    it("sends POST for new provider (no id)", async () => {
      const newProvider = { name: "New Tow", type: "Tow" as const };
      mockApi.post.mockResolvedValueOnce({
        provider: { ...newProvider, id: "p-new" },
      });

      const result = await saveProvider(newProvider as any);

      expect(mockApi.post).toHaveBeenCalledWith("/providers", newProvider);
      expect(result.id).toBe("p-new");
    });

    it("sends PATCH for existing provider (has id)", async () => {
      const existing = {
        id: "p1",
        name: "Updated Tow",
        type: "Tow" as const,
      };
      mockApi.patch.mockResolvedValueOnce({ provider: existing });

      const result = await saveProvider(existing as any);

      expect(mockApi.patch).toHaveBeenCalledWith("/providers/p1", existing);
      expect(result).toEqual(existing);
    });

    it("throws on API error", async () => {
      mockApi.patch.mockRejectedValueOnce(new Error("API Request failed: 422"));

      await expect(saveProvider({ id: "p1" } as any)).rejects.toThrow();
    });

    it("returns original provider when json.provider is undefined", async () => {
      const provider = { id: "p1", name: "Tow Co", type: "Tow" as const };
      mockApi.patch.mockResolvedValueOnce({});

      const result = await saveProvider(provider as any);
      expect(result).toEqual(provider);
    });
  });
});

describe("directory.ts — Contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContacts", () => {
    it("calls api.get /contacts and returns contacts array", async () => {
      const fakeContacts = [
        { id: "c1", name: "John", type: "Broker" },
        { id: "c2", name: "Jane", type: "Shipper" },
      ];
      mockApi.get.mockResolvedValueOnce({ contacts: fakeContacts });

      const result = await getContacts();

      expect(mockApi.get).toHaveBeenCalledWith("/contacts");
      expect(result).toEqual(fakeContacts);
    });

    it("returns empty array when API throws", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("403"));

      const result = await getContacts();
      expect(result).toEqual([]);
    });

    it("returns empty array when json.contacts is not an array", async () => {
      mockApi.get.mockResolvedValueOnce({ contacts: null });

      const result = await getContacts();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      mockApi.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const result = await getContacts();
      expect(result).toEqual([]);
    });
  });

  describe("saveContact", () => {
    it("sends POST for new contact (no id)", async () => {
      const newContact = { name: "Alice", type: "Customer" as const };
      mockApi.post.mockResolvedValueOnce({
        contact: { ...newContact, id: "c-new" },
      });

      const result = await saveContact(newContact as any);

      expect(mockApi.post).toHaveBeenCalledWith("/contacts", newContact);
      expect(result.id).toBe("c-new");
    });

    it("sends PATCH for existing contact (has id)", async () => {
      const existing = {
        id: "c1",
        name: "Updated",
        type: "Broker" as const,
      };
      mockApi.patch.mockResolvedValueOnce({ contact: existing });

      await saveContact(existing as any);

      expect(mockApi.patch).toHaveBeenCalledWith("/contacts/c1", existing);
    });

    it("throws on API error", async () => {
      mockApi.patch.mockRejectedValueOnce(
        new Error("API Request failed: 400"),
      );

      await expect(saveContact({ id: "c1" } as any)).rejects.toThrow();
    });

    it("returns original contact when json.contact is undefined", async () => {
      const contact = { id: "c1", name: "Bob", type: "Shipper" as const };
      mockApi.patch.mockResolvedValueOnce({});

      const result = await saveContact(contact as any);
      expect(result).toEqual(contact);
    });
  });
});

describe("directory.ts — getDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns both providers and contacts in a single call", async () => {
    const providers = [{ id: "p1", name: "Tow Co", type: "Tow" }];
    const contacts = [{ id: "c1", name: "John", type: "Broker" }];

    mockApi.get
      .mockResolvedValueOnce({ providers })
      .mockResolvedValueOnce({ contacts });

    const result = await getDirectory();

    expect(mockApi.get).toHaveBeenCalledTimes(2);
    expect(result.providers).toEqual(providers);
    expect(result.contacts).toEqual(contacts);
  });

  it("returns empty arrays when both APIs fail", async () => {
    mockApi.get
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));

    const result = await getDirectory();

    expect(result.providers).toEqual([]);
    expect(result.contacts).toEqual([]);
  });
});
