/**
 * Quotes domain — localStorage CRUD.
 * Owner: STORY-012 (Phase 2 migration to server).
 */
import { Quote } from "../../types";
import { getTenantKey } from "./core";

export const STORAGE_KEY_QUOTES = (): string => getTenantKey("quotes_v1");

export const getQuotes = async (companyId: string): Promise<Quote[]> => {
  const data = localStorage.getItem(STORAGE_KEY_QUOTES());
  const quotes: Quote[] = data ? JSON.parse(data) : [];
  return quotes.filter((q) => q.companyId === companyId);
};

export const saveQuote = async (quote: Quote) => {
  const data = localStorage.getItem(STORAGE_KEY_QUOTES());
  let quotes: Quote[] = data ? JSON.parse(data) : [];
  const idx = quotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote;
  else quotes.unshift(quote);
  localStorage.setItem(STORAGE_KEY_QUOTES(), JSON.stringify(quotes));
};
