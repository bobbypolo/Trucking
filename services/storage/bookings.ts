/**
 * Bookings domain — API-backed CRUD.
 * Owner: STORY-014 (Phase 2 migration complete — local browser storage removed).
 * All reads/writes go through /api/bookings.
 */
import { Booking } from "../../types";
import { API_URL } from "../config";
import { getAuthHeaders } from "../authService";

export const getBookings = async (companyId?: string): Promise<Booking[]> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/bookings`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch bookings: ${res.status}`);
  const data = await res.json();
  // Server already scopes by tenant; companyId filter is a no-op safety guard
  if (companyId) {
    return (data as Booking[]).filter((b) => b.companyId === companyId);
  }
  return data as Booking[];
};

export const saveBooking = async (booking: Booking): Promise<Booking> => {
  const headers = await getAuthHeaders();
  // Use PATCH if id already exists on server, POST for new records
  const isUpdate = Boolean(booking.id);
  const url = isUpdate
    ? `${API_URL}/bookings/${booking.id}`
    : `${API_URL}/bookings`;
  const method = isUpdate ? "PATCH" : "POST";
  const res = await fetch(url, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  if (!res.ok) throw new Error(`Failed to save booking: ${res.status}`);
  return res.json();
};
