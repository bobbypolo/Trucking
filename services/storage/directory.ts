/**
 * Directory domain -- Contacts & Providers via server API.
 * Migrated by STORY-018 (Phase 2 cutover from browser storage to server API).
 * All CRUD goes through /api/contacts and /api/providers.
 */
import { Contact, Provider } from "../../types";
import { api, apiFetch } from "../api";

// --- Providers ---

export const getProviders = async (): Promise<Provider[]> => {
  try {
    const json = await api.get("/providers");
    return Array.isArray(json?.providers) ? json.providers : [];
  } catch {
    return [];
  }
};

export const saveProvider = async (provider: Provider): Promise<Provider> => {
  const isNew = !provider.id;
  if (isNew) {
    const json = await api.post("/providers", provider);
    return json.provider ?? provider;
  }
  const json = await api.patch(`/providers/${provider.id}`, provider);
  return json.provider ?? provider;
};

// --- Contacts ---

export const getContacts = async (): Promise<Contact[]> => {
  try {
    const json = await api.get("/contacts");
    return Array.isArray(json?.contacts) ? json.contacts : [];
  } catch {
    return [];
  }
};

export const saveContact = async (contact: Contact): Promise<Contact> => {
  const isNew = !contact.id;
  if (isNew) {
    const json = await api.post("/contacts", contact);
    return json.contact ?? contact;
  }
  const json = await api.patch(`/contacts/${contact.id}`, contact);
  return json.contact ?? contact;
};

export const getDirectory = async () => {
  const [providers, contacts] = await Promise.all([
    getProviders(),
    getContacts(),
  ]);
  return { providers, contacts };
};
