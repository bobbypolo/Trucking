/**
 * Date formatting utilities for the LoadPilot (DisbatchMe) UI.
 *
 * These helpers are defensive: any invalid, empty, or nullish input returns
 * the placeholder "---" instead of throwing, so they can be safely used in
 * render paths without try/catch wrappers.
 *
 * Format conventions:
 *   - formatDate        -> "MMM DD, YYYY"    e.g. "Apr 10, 2026"
 *   - formatDateTime    -> "MMM DD, YYYY HH:MM" in the user's locale time
 *   - formatRelativeDate-> "Today" / "Tomorrow" / "Yesterday" / formatted date
 */

const PLACEHOLDER = "---";

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseIsoToDate(iso: unknown): Date | null {
  if (iso === null || iso === undefined) return null;
  if (typeof iso !== "string") return null;
  const trimmed = iso.trim();
  if (trimmed === "") return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * For a plain YYYY-MM-DD string (no time component), build the Date using the
 * local-date components to avoid UTC->local shifts that would make
 * "2026-04-10" render as "Apr 9" in negative-UTC-offset timezones.
 */
function parseCalendarDate(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Format an ISO date string as "MMM DD, YYYY".
 * Returns "---" for empty, null, undefined, or otherwise unparseable input.
 */
export function formatDate(iso: string): string {
  if (iso === null || iso === undefined) return PLACEHOLDER;
  if (typeof iso !== "string") return PLACEHOLDER;
  const trimmed = iso.trim();
  if (trimmed === "") return PLACEHOLDER;

  // Calendar-date fast path: avoid timezone shifting "2026-04-10" to "Apr 9".
  const calendar = parseCalendarDate(trimmed);
  if (calendar) {
    const month = MONTH_NAMES_SHORT[calendar.getMonth()];
    const day = calendar.getDate();
    const year = calendar.getFullYear();
    return `${month} ${day} ${year}`.replace(
      `${month} ${day} ${year}`,
      `${month} ${day}, ${year}`,
    );
  }

  const d = parseIsoToDate(trimmed);
  if (!d) return PLACEHOLDER;

  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Format an ISO datetime string as "MMM DD, YYYY HH:MM" in the user's locale time.
 * Returns "---" for empty, null, undefined, or otherwise unparseable input.
 */
export function formatDateTime(iso: string): string {
  if (iso === null || iso === undefined) return PLACEHOLDER;
  if (typeof iso !== "string") return PLACEHOLDER;
  const trimmed = iso.trim();
  if (trimmed === "") return PLACEHOLDER;

  const d = parseIsoToDate(trimmed);
  if (!d) return PLACEHOLDER;

  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${year} ${hh}:${mm}`;
}

/**
 * Return a coarse relative-date label for an ISO date.
 *   - "Today" / "Tomorrow" / "Yesterday" for nearby calendar dates
 *   - "MMM DD, YYYY" via formatDate() for anything else
 * Returns "---" for empty/invalid input.
 */
export function formatRelativeDate(iso: string): string {
  if (iso === null || iso === undefined) return PLACEHOLDER;
  if (typeof iso !== "string") return PLACEHOLDER;
  const trimmed = iso.trim();
  if (trimmed === "") return PLACEHOLDER;

  const calendar = parseCalendarDate(trimmed) ?? parseIsoToDate(trimmed);
  if (!calendar) return PLACEHOLDER;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(
    calendar.getFullYear(),
    calendar.getMonth(),
    calendar.getDate(),
  );
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (targetStart.getTime() - todayStart.getTime()) / msPerDay,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return formatDate(trimmed);
}
