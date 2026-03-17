/**
 * Bookings domain — localStorage CRUD.
 * Owner: STORY-014 (Phase 2 migration to server).
 */
import { Booking } from "../../types";
import { getTenantKey } from "./core";

export const STORAGE_KEY_BOOKINGS = (): string => getTenantKey("bookings_v1");

export const getBookings = async (companyId: string): Promise<Booking[]> => {
  const data = localStorage.getItem(STORAGE_KEY_BOOKINGS());
  const bookings: Booking[] = data ? JSON.parse(data) : [];
  return bookings.filter((b) => b.companyId === companyId);
};

export const saveBooking = async (booking: Booking) => {
  const data = localStorage.getItem(STORAGE_KEY_BOOKINGS());
  let bookings: Booking[] = data ? JSON.parse(data) : [];
  const idx = bookings.findIndex((b) => b.id === booking.id);
  if (idx >= 0) bookings[idx] = booking;
  else bookings.unshift(booking);
  localStorage.setItem(STORAGE_KEY_BOOKINGS(), JSON.stringify(bookings));
};
