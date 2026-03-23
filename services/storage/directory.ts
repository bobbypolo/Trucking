/**
 * Directory domain -- Contacts & Providers via server API.
 * Migrated by STORY-018 (Phase 2 cutover from browser storage to server API).
 * All CRUD goes through /api/contacts and /api/providers.
 */
import { Contact, Provider } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

// --- Providers ---

export const getProviders = async (): Promise<Provider[]> => {
  try {
    const res = await fetch(API_URL + "/providers", {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.providers) ? json.providers : [];
  } catch {
    return [];
  }
};

export const saveProvider = async (provider: Provider): Promise<Provider> => {
  const isNew = !provider.id;
  const method = isNew ? "POST" : "PATCH";
  const url = isNew
    ? API_URL + "/providers"
    : API_URL + "/providers/" + provider.id;
  const res = await fetch(url, {
    method,
    headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(provider),
  });
  if (!res.ok) throw new Error("saveProvider failed: " + res.status);
  const json = await res.json();
  return json.provider ?? provider;
};

// --- Contacts ---

export const getContacts = async (): Promise<Contact[]> => {
  try {
    const res = await fetch(API_URL + "/contacts", {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.contacts) ? json.contacts : [];
  } catch {
    return [];
  }
};

export const saveContact = async (contact: Contact): Promise<Contact> => {
  const isNew = !contact.id;
  const method = isNew ? "POST" : "PATCH";
  const url = isNew
    ? API_URL + "/contacts"
    : API_URL + "/contacts/" + contact.id;
  const res = await fetch(url, {
    method,
    headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });
  if (!res.ok) throw new Error("saveContact failed: " + res.status);
  const json = await res.json();
  return json.contact ?? contact;
};

export const getDirectory = async () => {
  const [providers, contacts] = await Promise.all([
    getProviders(),
    getContacts(),
  ]);
  return { providers, contacts };
};
