/**
 * Quotes domain — server-backed CRUD via /api/quotes.
 * STORY-012: browser storage removed. All reads/writes go through the API.
 */
import { Quote } from "../../types";
import { api } from "../api";

/**
 * Fetch all quotes for the current tenant from GET /api/quotes.
 */
export const getQuotes = async (): Promise<Quote[]> => {
  return api.get("/quotes");
};

/**
 * Create or update a quote via PATCH (existing) or POST (new).
 * The server owns the source of truth; we pass the full payload.
 */
export const saveQuote = async (quote: Quote): Promise<Quote> => {
  // Try PATCH first; api throws on non-ok, catch 404 to fall back to POST.
  try {
    return await api.patch(`/quotes/${quote.id}`, quote);
  } catch (err: any) {
    // If the error message indicates 404 (not found on server), create via POST
    if (err?.message?.includes("404")) {
      return api.post("/quotes", quote);
    }
    throw err;
  }
};
