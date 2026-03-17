/**
 * Leads domain — localStorage CRUD.
 * Owner: STORY-013 (Phase 2 migration to server).
 */
import { Lead } from "../../types";
import { getTenantKey } from "./core";

export const STORAGE_KEY_LEADS = (): string => getTenantKey("leads_v1");

export const getLeads = async (companyId: string): Promise<Lead[]> => {
  const data = localStorage.getItem(STORAGE_KEY_LEADS());
  const leads: Lead[] = data ? JSON.parse(data) : [];
  return leads.filter((l) => l.companyId === companyId);
};

export const saveLead = async (lead: Lead) => {
  const leads = await getLeads(lead.companyId);
  const idx = leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) leads[idx] = lead;
  else leads.unshift(lead);
  localStorage.setItem(STORAGE_KEY_LEADS(), JSON.stringify(leads));
};
