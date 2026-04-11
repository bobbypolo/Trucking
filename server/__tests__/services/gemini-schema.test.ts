/**
 * gemini-schema.test.ts — STORY-005 Phase 5 (AI Extraction Enhancement)
 *
 * Verifies that extractLoadInfo schema has been expanded with 10 new fields
 * and that the prompt contains explicit extraction guidance keywords.
 *
 * # Tests R-P5-01, R-P5-02, R-P5-03
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the @google/genai package so importing gemini.service does not need
// a real API key or network access. We capture the config passed to
// generateContent so the schema + prompt can be asserted directly.
type CapturedCall = {
  model: string;
  contents: unknown;
  config: { responseSchema: Record<string, unknown>; [k: string]: unknown };
};
const captured: CapturedCall[] = [];

const mockGenerateContent = vi.fn(async (payload: CapturedCall) => {
  captured.push(payload);
  return { text: '{"load": {}, "broker": {}}' };
});

vi.mock("@google/genai", () => {
  class GoogleGenAI {
    models = { generateContent: mockGenerateContent };
    constructor(_: unknown) {}
  }
  const Type = {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    ARRAY: "ARRAY",
    BOOLEAN: "BOOLEAN",
  };
  return { GoogleGenAI, Type };
});

describe("extractLoadInfo schema + prompt (STORY-005)", () => {
  beforeEach(() => {
    captured.length = 0;
    mockGenerateContent.mockClear();
    process.env.GEMINI_API_KEY = "test-key-for-unit-test";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  /**
   * Helper — run extractLoadInfo once, return the schema + prompt that were
   * sent to the Gemini client. We bust the require cache so each test gets
   * a fresh import and captures its own call.
   */
  const invokeAndCapture = async (): Promise<{
    schema: Record<string, unknown>;
    prompt: string;
  }> => {
    const mod = await import("../../services/gemini.service");
    await mod.extractLoadInfo("base64-data", "image/jpeg");
    const call = captured[captured.length - 1];
    expect(call).toBeDefined();
    const schema = call.config.responseSchema as Record<string, unknown>;
    const contents = call.contents as {
      parts: Array<{ text?: string; inlineData?: unknown }>;
    };
    const textPart = contents.parts.find(
      (p): p is { text: string } => typeof p.text === "string",
    );
    expect(textPart).toBeDefined();
    return { schema, prompt: textPart!.text };
  };

  // Tests R-P5-01
  it("R-P5-01: schema.properties.load.properties includes 5 scheduling + pay fields", async () => {
    const { schema } = await invokeAndCapture();
    const loadSchema = schema.properties as {
      load: { properties: Record<string, { type: string }> };
    };
    const loadProps = loadSchema.load.properties;

    expect(loadProps).toHaveProperty("freightType");
    expect(loadProps.freightType.type).toBe("STRING");

    expect(loadProps).toHaveProperty("driverPay");
    expect(loadProps.driverPay.type).toBe("NUMBER");

    expect(loadProps).toHaveProperty("dropoffDate");
    expect(loadProps.dropoffDate.type).toBe("STRING");

    expect(loadProps).toHaveProperty("pickupAppointmentTime");
    expect(loadProps.pickupAppointmentTime.type).toBe("STRING");

    expect(loadProps).toHaveProperty("dropoffAppointmentTime");
    expect(loadProps.dropoffAppointmentTime.type).toBe("STRING");
  });

  // Tests R-P5-02
  it("R-P5-02: schema.properties.load.properties includes 5 document + container fields", async () => {
    const { schema } = await invokeAndCapture();
    const loadSchema = schema.properties as {
      load: { properties: Record<string, { type: string }> };
    };
    const loadProps = loadSchema.load.properties;

    expect(loadProps).toHaveProperty("bolNumber");
    expect(loadProps.bolNumber.type).toBe("STRING");

    expect(loadProps).toHaveProperty("specialInstructions");
    expect(loadProps.specialInstructions.type).toBe("STRING");

    expect(loadProps).toHaveProperty("palletCount");
    expect(loadProps.palletCount.type).toBe("NUMBER");

    expect(loadProps).toHaveProperty("containerNumber");
    expect(loadProps.containerNumber.type).toBe("STRING");

    expect(loadProps).toHaveProperty("chassisNumber");
    expect(loadProps.chassisNumber.type).toBe("STRING");
  });

  // Tests R-P5-03
  it("R-P5-03: prompt contains all 8 extraction guidance keywords", async () => {
    const { prompt } = await invokeAndCapture();

    expect(prompt).toContain("equipment type");
    expect(prompt).toContain("delivery date");
    expect(prompt).toContain("appointment");
    expect(prompt).toContain("BOL");
    expect(prompt).toContain("special");
    expect(prompt).toContain("pallet");
    expect(prompt).toContain("container");
    expect(prompt).toContain("chassis");
  });

  // Regression guard — existing fields must still be present.
  it("regression: existing schema fields are preserved after expansion", async () => {
    const { schema } = await invokeAndCapture();
    const loadSchema = schema.properties as {
      load: {
        properties: Record<string, { type: string }>;
        required: string[];
      };
      broker: { properties: Record<string, { type: string }> };
    };
    const loadProps = loadSchema.load.properties;

    expect(loadProps).toHaveProperty("loadNumber");
    expect(loadProps).toHaveProperty("carrierRate");
    expect(loadProps).toHaveProperty("commodity");
    expect(loadProps).toHaveProperty("weight");
    expect(loadProps).toHaveProperty("pickupDate");
    expect(loadProps).toHaveProperty("pickup");
    expect(loadProps).toHaveProperty("dropoff");
    // Existing required fields must still be required.
    expect(loadSchema.load.required).toContain("loadNumber");
    expect(loadSchema.load.required).toContain("carrierRate");
    expect(loadSchema.load.required).toContain("pickup");
    expect(loadSchema.load.required).toContain("dropoff");
    // Broker block is still present.
    expect(loadSchema.broker.properties).toHaveProperty("name");
    expect(loadSchema.broker.properties).toHaveProperty("mcNumber");
  });
});
