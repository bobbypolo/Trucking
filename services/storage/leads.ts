/**
 * Leads domain — API-backed CRUD (migrated from local browser storage in STORY-013).
 * Uses /api/leads server routes with auth headers.
 */
import { Lead } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

export const getLeads = async (companyId: string): Promise<Lead[]> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/leads`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  const data = await res.json();
  // Server already scopes by tenant; filter client-side for safety
  const leads: Lead[] = Array.isArray(data) ? data : (data.leads ?? []);
  // Server already scopes by tenant; client-side filter guards against shape mismatches
  return leads.filter((l) => !l.companyId || l.companyId === companyId);
};

export const saveLead = async (lead: Lead): Promise<Lead> => {
  const headers = await getAuthHeaders();
  const method = lead.id ? "PATCH" : "POST";
  const url = lead.id ? `${API_URL}/leads/${lead.id}` : `${API_URL}/leads`;
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error(`Failed to save lead: ${res.status}`);
  return res.json();
};
