/**
 * Bookings domain — API-backed CRUD.
 * Owner: STORY-014 (Phase 2 migration complete — local browser storage removed).
 * All reads/writes go through /api/bookings.
 */
import { Booking } from "../../types";
import { api } from "../api";

export const getBookings = async (companyId?: string): Promise<Booking[]> => {
  const data = await api.get("/bookings");
  // Server already scopes by tenant; companyId filter is a no-op safety guard
  if (companyId) {
    return (data as Booking[]).filter((b) => b.companyId === companyId);
  }
  return data as Booking[];
};

export const saveBooking = async (booking: Booking): Promise<Booking> => {
  // Use PATCH if id already exists on server, POST for new records
  const isUpdate = Boolean(booking.id);
  if (isUpdate) {
    return api.patch(`/bookings/${booking.id}`, booking);
  }
  return api.post("/bookings", booking);
};
