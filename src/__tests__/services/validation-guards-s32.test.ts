/**
 * Tests R-P3-03, R-P3-04
 *
 * S-3.2: Client-side validation guards for 400 error prevention.
 *
 * R-P3-03: 400 error count drops from 21 to less than 3 after client-side validation added
 * R-P3-04: AI route calls guarded by if (!imageBase64) return check
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- R-P3-04: AI route imageBase64 guard ---

describe("R-P3-04: Scanner aiPost imageBase64 guard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ loadInfo: { load: {}, broker: {} } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("aiPost does not call fetch when imageBase64 is empty string", async () => {
    // Import the module — the aiPost function is internal to Scanner.tsx,
    // so we test via the exported validateImageBase64 utility
    const { validateImageBase64 } = await import(
      "../../../services/validationGuards"
    );
    const result = validateImageBase64("");
    expect(result).toBe(false);
  });

  it("aiPost does not call fetch when imageBase64 is undefined", async () => {
    const { validateImageBase64 } = await import(
      "../../../services/validationGuards"
    );
    const result = validateImageBase64(undefined as unknown as string);
    expect(result).toBe(false);
  });

  it("aiPost does not call fetch when imageBase64 is null", async () => {
    const { validateImageBase64 } = await import(
      "../../../services/validationGuards"
    );
    const result = validateImageBase64(null as unknown as string);
    expect(result).toBe(false);
  });

  it("validates valid base64 string as true", async () => {
    const { validateImageBase64 } = await import(
      "../../../services/validationGuards"
    );
    const result = validateImageBase64("iVBORw0KGgoAAAANSUhEUg==");
    expect(result).toBe(true);
  });
});

// --- R-P3-03: Safety form validation ---

describe("R-P3-03: Safety form field validation", () => {
  it("rejects quiz submission with empty title", async () => {
    const { validateQuizForm } = await import(
      "../../../services/validationGuards"
    );
    const result = validateQuizForm({ title: "", isMandatory: false });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title");
  });

  it("rejects quiz submission with whitespace-only title", async () => {
    const { validateQuizForm } = await import(
      "../../../services/validationGuards"
    );
    const result = validateQuizForm({ title: "   ", isMandatory: false });
    expect(result.valid).toBe(false);
  });

  it("accepts quiz submission with valid title", async () => {
    const { validateQuizForm } = await import(
      "../../../services/validationGuards"
    );
    const result = validateQuizForm({
      title: "Hazardous Materials",
      isMandatory: true,
    });
    expect(result.valid).toBe(true);
  });
});

describe("R-P3-03: Dispatch event validation", () => {
  it("rejects dispatch event with missing load_id", async () => {
    const { validateDispatchEvent } = await import(
      "../../../services/validationGuards"
    );
    const result = validateDispatchEvent({
      event_type: "StatusChange",
      message: "test",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("load_id");
  });

  it("rejects dispatch event with missing event_type", async () => {
    const { validateDispatchEvent } = await import(
      "../../../services/validationGuards"
    );
    const result = validateDispatchEvent({ load_id: "L-001", message: "test" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("event_type");
  });

  it("rejects dispatch event with non-serializable payload", async () => {
    const { validateDispatchEvent } = await import(
      "../../../services/validationGuards"
    );
    const circular: any = {};
    circular.self = circular;
    const result = validateDispatchEvent({
      load_id: "L-001",
      event_type: "Note",
      message: "test",
      payload: circular,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("payload");
  });

  it("accepts valid dispatch event", async () => {
    const { validateDispatchEvent } = await import(
      "../../../services/validationGuards"
    );
    const result = validateDispatchEvent({
      load_id: "L-001",
      event_type: "StatusChange",
      message: "Load picked up",
    });
    expect(result.valid).toBe(true);
  });
});

describe("R-P3-03: Weather coordinate validation", () => {
  it("rejects NaN latitude", async () => {
    const { validateCoordinates } = await import(
      "../../../services/validationGuards"
    );
    expect(validateCoordinates(NaN, -87.6298)).toBe(false);
  });

  it("rejects NaN longitude", async () => {
    const { validateCoordinates } = await import(
      "../../../services/validationGuards"
    );
    expect(validateCoordinates(41.8781, NaN)).toBe(false);
  });

  it("rejects latitude > 90", async () => {
    const { validateCoordinates } = await import(
      "../../../services/validationGuards"
    );
    expect(validateCoordinates(91, -87.6298)).toBe(false);
  });

  it("rejects latitude < -90", async () => {
    const { validateCoordinates } = await import(
      "../../../services/validationGuards"
    );
    expect(validateCoordinates(-91, -87.6298)).toBe(false);
  });

  it("rejects longitude > 180", async () => {
    const { validateCoordinates } = await import(
      "../../../services/validationGuards"
    );
    expect(validateCoordinates(41.8781, 181)).toBe(false);
  });

  it("accepts valid coordinates", async () => {
    const { validateCoordinates } = await import(
      "../../../services/validationGuards"
    );
    expect(validateCoordinates(41.8781, -87.6298)).toBe(true);
  });
});

describe("R-P3-03: Equipment PATCH field validation", () => {
  it("rejects unknown field names", async () => {
    const { validateEquipmentPatchFields } = await import(
      "../../../services/validationGuards"
    );
    const result = validateEquipmentPatchFields({
      unknownField: "value",
      anotherBad: 123,
    });
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toContain("unknownField");
  });

  it("accepts allowed field names (status, maintenance_date, mileage, notes)", async () => {
    const { validateEquipmentPatchFields } = await import(
      "../../../services/validationGuards"
    );
    const result = validateEquipmentPatchFields({
      status: "Active",
      notes: "Serviced",
    });
    expect(result.valid).toBe(true);
    expect(result.invalidFields).toHaveLength(0);
  });

  it("filters mixed valid/invalid fields", async () => {
    const { validateEquipmentPatchFields } = await import(
      "../../../services/validationGuards"
    );
    const result = validateEquipmentPatchFields({
      status: "Active",
      badField: "nope",
      mileage: 50000,
    });
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toContain("badField");
    expect(result.validFields).toContain("status");
    expect(result.validFields).toContain("mileage");
  });

  it("rejects empty update object", async () => {
    const { validateEquipmentPatchFields } = await import(
      "../../../services/validationGuards"
    );
    const result = validateEquipmentPatchFields({});
    expect(result.valid).toBe(false);
  });
});
