/**
 * Directory domain — Contacts & Providers localStorage CRUD.
 * Owner: STORY-018 (Phase 2 migration to server).
 */
import { Contact, Provider } from "../../types";
import { DEMO_MODE } from "../firebase";
import { getTenantKey } from "./core";

export const STORAGE_KEY_CONTACTS = (): string => getTenantKey("contacts_v1");
export const STORAGE_KEY_PROVIDERS = (): string => getTenantKey("providers_v1");

// --- Providers ---

export const getRawProviders = (): Provider[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PROVIDERS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveProvider = async (provider: Provider) => {
  const providers = getRawProviders();
  const idx = providers.findIndex((p) => p.id === provider.id);
  if (idx >= 0) providers[idx] = provider;
  else providers.unshift(provider);
  localStorage.setItem(STORAGE_KEY_PROVIDERS(), JSON.stringify(providers));
  return provider;
};

export const getProviders = async (): Promise<Provider[]> => {
  const providers = getRawProviders();
  if (providers.length === 0 && DEMO_MODE) {
    const seed: Provider[] = [
      {
        id: "p1",
        name: "Titan Recovery Specialists",
        type: "Recovery",
        status: "Preferred",
        is247: true,
        coverage: { regions: ["Northeast", "Mid-Atlantic"] },
        capabilities: ["Heavy Tow", "Recovery", "Transload"],
        contacts: [
          {
            id: "pc1",
            name: "Mike Titan",
            phone: "800-555-9000",
            email: "mike@titan.com",
            type: "Provider",
            preferredChannel: "Phone",
          },
        ],
        afterHoursContacts: [],
      },
      {
        id: "p2",
        name: "Rapid Tire & Service",
        type: "Tire",
        status: "Approved",
        is247: true,
        coverage: { regions: ["National"] },
        capabilities: ["Tire", "Mobile Mechanic"],
        contacts: [
          {
            id: "pc2",
            name: "Dispatch",
            phone: "800-RAPID-NOW",
            email: "service@rapid.com",
            type: "Provider",
            preferredChannel: "Phone",
          },
        ],
        afterHoursContacts: [],
      },
    ];
    localStorage.setItem(STORAGE_KEY_PROVIDERS(), JSON.stringify(seed));
    return seed;
  }
  return providers;
};

// --- Contacts ---

export const getRawContacts = (): Contact[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CONTACTS());
    const parsed = data ? JSON.parse(data) : [];
    if (parsed.length === 0 && DEMO_MODE) {
      const seed: Contact[] = [
        {
          id: "c1",
          name: "John Dispatcher",
          title: "Senior Operator",
          phone: "555-0199",
          email: "john@asset.com",
          type: "Internal",
          preferredChannel: "Phone",
          normalizedPhone: "5550199",
        },
        {
          id: "c2",
          name: "Sarah Broker",
          title: "Agent",
          phone: "555-0288",
          email: "sarah@choptank.com",
          type: "Broker",
          preferredChannel: "SMS",
          normalizedPhone: "5550288",
        },
      ];
      localStorage.setItem(STORAGE_KEY_CONTACTS(), JSON.stringify(seed));
      return seed;
    }
    if (parsed.length === 0) return [];
    return parsed;
  } catch (e) {
    return [];
  }
};

export const getContacts = async (): Promise<Contact[]> => {
  return getRawContacts();
};

export const saveContact = async (contact: Contact) => {
  const contacts = getRawContacts();
  const idx = contacts.findIndex((c) => c.id === contact.id);
  if (idx >= 0) contacts[idx] = contact;
  else contacts.unshift(contact);
  localStorage.setItem(STORAGE_KEY_CONTACTS(), JSON.stringify(contacts));
  return contact;
};

export const getDirectory = async () => {
  return {
    providers: getRawProviders(),
    contacts: getRawContacts(),
  };
};
