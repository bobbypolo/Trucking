/**
 * Quotes domain — server-backed CRUD via /api/quotes.
 * STORY-012: browser storage removed. All reads/writes go through the API.
 */
import { Quote } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

/**
 * Fetch all quotes for the current tenant from GET /api/quotes.
 */
export const getQuotes = async (): Promise<Quote[]> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/quotes`, { headers });
  if (!res.ok) {
    throw new Error(`GET /api/quotes failed: ${res.status}`);
  }
  return res.json();
};

/**
 * Create or update a quote via POST (new) or PATCH (existing).
 * The server owns the source of truth; we pass the full payload.
 */
export const saveQuote = async (quote: Quote): Promise<Quote> => {
  const headers = await getAuthHeaders();

  // Try PATCH first; server returns 404 if not found, then we POST.
  const patchRes = await fetch(`${API_URL}/quotes/${quote.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(quote),
  });

  if (patchRes.ok) {
    return patchRes.json();
  }

  // If 404 (not found on server), create via POST
  if (patchRes.status === 404) {
    const postRes = await fetch(`${API_URL}/quotes`, {
      method: "POST",
      headers,
      body: JSON.stringify(quote),
    });
    if (!postRes.ok) {
      throw new Error(`POST /api/quotes failed: ${postRes.status}`);
    }
    return postRes.json();
  }

  throw new Error(`PATCH /api/quotes/${quote.id} failed: ${patchRes.status}`);
};
