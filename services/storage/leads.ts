/**
 * Leads domain — API-backed CRUD (migrated from local browser storage in STORY-013).
 * Uses /api/leads server routes with auth headers.
 */
import { Lead } from "../../types";
import { api } from "../api";

export const getLeads = async (companyId: string): Promise<Lead[]> => {
  const data = await api.get("/leads");
  // Server already scopes by tenant; filter client-side for safety
  const leads: Lead[] = Array.isArray(data) ? data : (data.leads ?? []);
  // Server already scopes by tenant; client-side filter guards against shape mismatches
  return leads.filter((l) => !l.companyId || l.companyId === companyId);
};

export const saveLead = async (lead: Lead): Promise<Lead> => {
  if (lead.id) {
    return api.patch(`/leads/${lead.id}`, lead);
  }
  return api.post("/leads", lead);
};
