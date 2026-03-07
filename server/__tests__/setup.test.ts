import { describe, it, expect } from "vitest";

describe("Server Test Framework", () => {
  it("vitest runs successfully in the server workspace", () => {
    expect(true).toBe(true);
  });

  it("basic arithmetic works", () => {
    expect(1 + 1).toBe(2);
  });

  it("environment is node", () => {
    expect(typeof process).toBe("object");
    expect(typeof process.version).toBe("string");
  });
});
