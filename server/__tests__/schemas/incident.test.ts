import { describe, it, expect } from "vitest";
import {
  createIncidentSchema,
  createIncidentActionSchema,
  patchIncidentSchema,
  createIncidentChargeSchema,
} from "../../schemas/incident";

// Tests R-SEC-13
describe("R-SEC-13: incident.ts exports 4 schemas", () => {
  it("createIncidentSchema accepts valid incident payload", () => {
    const valid = {
      load_id: "load-001",
      type: "Safety",
      severity: "High",
      description: "Cargo spill on I-40",
    };
    const result = createIncidentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("createIncidentSchema accepts optional location fields", () => {
    const valid = {
      load_id: "load-002",
      type: "Maintenance",
      severity: "Medium",
      description: "Flat tire on trailer",
      location_lat: 35.2271,
      location_lng: -80.8431,
      recovery_plan: "Send road service",
    };
    const result = createIncidentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location_lat).toBe(35.2271);
      expect(result.data.location_lng).toBe(-80.8431);
    }
  });

  it("createIncidentSchema rejects empty body", () => {
    const result = createIncidentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("createIncidentSchema rejects missing type", () => {
    const invalid = {
      load_id: "load-001",
      severity: "High",
      description: "Missing type field",
    };
    const result = createIncidentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("type");
    }
  });

  it("createIncidentSchema rejects empty description", () => {
    const invalid = {
      load_id: "load-001",
      type: "Safety",
      severity: "High",
      description: "",
    };
    const result = createIncidentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("createIncidentActionSchema accepts valid action payload", () => {
    const valid = {
      action: "Dispatched road service",
      actor_name: "John Doe",
      notes: "ETA 30 minutes",
    };
    const result = createIncidentActionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("createIncidentActionSchema rejects missing action", () => {
    const invalid = {
      actor_name: "John Doe",
    };
    const result = createIncidentActionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("action");
    }
  });

  it("createIncidentActionSchema rejects missing actor_name", () => {
    const invalid = {
      action: "Dispatched road service",
    };
    const result = createIncidentActionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("actor_name");
    }
  });

  it("patchIncidentSchema accepts partial payload", () => {
    const valid = { severity: "Critical" };
    const result = patchIncidentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("patchIncidentSchema accepts empty object (all fields optional)", () => {
    const result = patchIncidentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("patchIncidentSchema rejects non-number location_lat", () => {
    const invalid = { location_lat: "not-a-number" };
    const result = patchIncidentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("createIncidentChargeSchema accepts valid charge payload", () => {
    const valid = {
      category: "Towing",
      amount: 250.0,
      provider_vendor: "AAA Road Service",
      status: "Pending",
    };
    const result = createIncidentChargeSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(250.0);
    }
  });

  it("createIncidentChargeSchema rejects negative amount", () => {
    const invalid = {
      category: "Towing",
      amount: -5,
    };
    const result = createIncidentChargeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const amountIssue = result.error.issues.find(
        (i) => i.path[0] === "amount",
      );
      expect(amountIssue).toBeDefined();
      expect(amountIssue!.message).toBe("amount must be >= 0");
    }
  });

  it("createIncidentChargeSchema rejects missing category", () => {
    const invalid = {
      amount: 100,
    };
    const result = createIncidentChargeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("category");
    }
  });

  it("all 4 schemas are exported and are Zod schemas", () => {
    expect(createIncidentSchema.safeParse).toBeDefined();
    expect(createIncidentActionSchema.safeParse).toBeDefined();
    expect(patchIncidentSchema.safeParse).toBeDefined();
    expect(createIncidentChargeSchema.safeParse).toBeDefined();
  });
});
