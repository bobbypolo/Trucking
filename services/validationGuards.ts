/**
 * Client-side validation guards for S-3.2.
 *
 * These utilities prevent 400 errors by validating payloads before
 * API calls are made. Each guard corresponds to a category of 400
 * errors found during the QA audit.
 */

// ── R-P3-04: AI route imageBase64 guard ──────────────────────────────────

/**
 * Validates that imageBase64 is a non-empty string before sending to
 * AI extraction endpoints (/api/ai/extract-*).
 *
 * Prevents 8 of the 21 observed 400 errors.
 */
export function validateImageBase64(imageBase64: unknown): boolean {
  if (typeof imageBase64 !== "string") return false;
  if (!imageBase64.trim()) return false;
  return true;
}

// ── R-P3-03: Safety form validation ──────────────────────────────────────

interface QuizFormData {
  title?: string;
  isMandatory?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates quiz form data before calling POST /api/safety/quizzes.
 * Prevents 400 errors from missing required fields (title).
 */
export function validateQuizForm(data: QuizFormData): ValidationResult {
  const errors: string[] = [];

  if (!data.title || !data.title.trim()) {
    errors.push("title");
  }

  return { valid: errors.length === 0, errors };
}

// ── R-P3-03: Dispatch event validation ───────────────────────────────────

interface DispatchEventData {
  load_id?: string;
  loadId?: string;
  event_type?: string;
  eventType?: string;
  message?: string;
  dispatcher_id?: string;
  dispatcherId?: string;
  payload?: unknown;
}

/**
 * Validates dispatch event data before calling POST /api/dispatch-events.
 * Prevents 2 of the 21 observed 400 errors (JSON.stringify failures).
 */
export function validateDispatchEvent(data: DispatchEventData): ValidationResult {
  const errors: string[] = [];

  const loadId = data.load_id || data.loadId;
  if (!loadId || !String(loadId).trim()) {
    errors.push("load_id");
  }

  const eventType = data.event_type || data.eventType;
  if (!eventType || !String(eventType).trim()) {
    errors.push("event_type");
  }

  // Validate payload is serializable (prevents JSON.stringify failures)
  if (data.payload !== undefined && data.payload !== null) {
    try {
      JSON.stringify(data.payload);
    } catch {
      errors.push("payload");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── R-P3-03: Weather coordinate validation ───────────────────────────────

/**
 * Validates lat/lng coordinates before calling weather API.
 * Prevents 2 of the 21 observed 400 errors (missing coordinates).
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

// ── R-P3-03: Equipment PATCH field validation ────────────────────────────

/** Allowed columns for PATCH /api/equipment/:id (mirrors server PATCH_ALLOWED_COLUMNS) */
const PATCH_ALLOWED_COLUMNS = ["status", "maintenance_date", "mileage", "notes"] as const;

interface EquipmentPatchResult {
  valid: boolean;
  invalidFields: string[];
  validFields: string[];
}

/**
 * Validates equipment PATCH fields against the server's PATCH_ALLOWED_COLUMNS.
 * Prevents 2 of the 21 observed 400 errors (invalid field names in PATCH body).
 */
export function validateEquipmentPatchFields(
  data: Record<string, unknown>,
): EquipmentPatchResult {
  const keys = Object.keys(data);
  const validFields: string[] = [];
  const invalidFields: string[] = [];

  for (const key of keys) {
    if ((PATCH_ALLOWED_COLUMNS as readonly string[]).includes(key)) {
      validFields.push(key);
    } else {
      invalidFields.push(key);
    }
  }

  return {
    valid: invalidFields.length === 0 && validFields.length > 0,
    invalidFields,
    validFields,
  };
}
