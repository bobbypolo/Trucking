import { describe, it, expect } from "vitest";

describe("Frontend Test Framework", () => {
  it("vitest runs successfully in the frontend workspace", () => {
    expect(true).toBe(true);
  });

  it("basic arithmetic works", () => {
    expect(1 + 1).toBe(2);
  });

  it("string operations work", () => {
    const appName = "LoadPilot";
    expect(appName).toContain("Load");
    expect(appName.toLowerCase()).toBe("loadpilot");
  });
});
