import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validateBody, ValidationError } from "../../middleware/validate";

// Tests R-P1-03-AC1, R-P1-03-AC2

// Mock Express request/response/next
function mockReq(body: any = {}) {
  return { body } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockNext() {
  return vi.fn();
}

const testSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

describe("R-P1-03: Zod Validation Middleware", () => {
  describe("validateBody middleware factory", () => {
    it("AC1: validateBody returns an Express middleware function", () => {
      const middleware = validateBody(testSchema);
      expect(typeof middleware).toBe("function");
      expect(middleware.length).toBe(3); // (req, res, next)
    });

    it("AC1: valid payload passes through to next()", () => {
      const middleware = validateBody(testSchema);
      const req = mockReq({ name: "John", email: "john@example.com" });
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("AC1: valid payload with optional fields passes through", () => {
      const middleware = validateBody(testSchema);
      const req = mockReq({ name: "Jane", email: "jane@test.com", age: 30 });
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it("AC2: missing required field returns 400 with VALIDATION_001", () => {
      const middleware = validateBody(testSchema);
      const req = mockReq({ email: "john@example.com" }); // missing name
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error_code: "VALIDATION_001",
          message: "Validation failed",
          details: expect.any(Array),
        })
      );
    });

    it("AC2: invalid email format returns 400 with VALIDATION_001", () => {
      const middleware = validateBody(testSchema);
      const req = mockReq({ name: "John", email: "not-an-email" });
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.error_code).toBe("VALIDATION_001");
      expect(responseBody.details.length).toBeGreaterThan(0);
      expect(responseBody.details[0]).toHaveProperty("field");
      expect(responseBody.details[0]).toHaveProperty("message");
    });

    it("AC2: wrong type returns 400 with descriptive details", () => {
      const middleware = validateBody(testSchema);
      const req = mockReq({ name: "John", email: "j@t.com", age: "thirty" });
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.error_code).toBe("VALIDATION_001");
      expect(responseBody.details.some((d: any) => d.field === "age")).toBe(
        true
      );
    });

    it("AC2: completely empty body returns 400 with multiple errors", () => {
      const middleware = validateBody(testSchema);
      const req = mockReq({});
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.error_code).toBe("VALIDATION_001");
      expect(responseBody.details.length).toBeGreaterThanOrEqual(2); // name + email
    });

    it("AC1: parsed (coerced) body replaces req.body on success", () => {
      const schemaWithDefault = z.object({
        name: z.string(),
        status: z.string().default("active"),
      });
      const middleware = validateBody(schemaWithDefault);
      const req = mockReq({ name: "Test" });
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.body.status).toBe("active"); // default applied
    });
  });

  describe("ValidationError structure", () => {
    it("AC2: ValidationError has field and message properties", () => {
      const err: ValidationError = { field: "name", message: "Required" };
      expect(err).toHaveProperty("field");
      expect(err).toHaveProperty("message");
    });
  });
});
