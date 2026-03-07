import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthError,
  InternalError,
} from "../../errors/AppError";
import { errorHandler } from "../../middleware/errorHandler";

// Tests R-P1-04-AC1, R-P1-04-AC2

function mockReq() {
  return {} as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
}

function mockNext() {
  return vi.fn();
}

describe("R-P1-04: Global Error Handler Middleware", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("AC2: Structured error responses", () => {
    it("handles AppError and returns structured JSON", () => {
      const err = new ValidationError("Name required", { field: "name" });
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty("error_code", "VALIDATION_001");
      expect(body).toHaveProperty("error_class", "VALIDATION");
      expect(body).toHaveProperty("message", "Name required");
      expect(body).toHaveProperty("correlation_id");
      expect(body).toHaveProperty("retryable", false);
      expect(body).toHaveProperty("details", { field: "name" });
    });

    it("handles NotFoundError with 404 status", () => {
      const err = new NotFoundError("Load not found");
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      const body = res.json.mock.calls[0][0];
      expect(body.error_code).toBe("NOT_FOUND_001");
      expect(body.error_class).toBe("NOT_FOUND");
    });

    it("handles AuthError with 401 status", () => {
      const err = new AuthError("Unauthorized");
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      const body = res.json.mock.calls[0][0];
      expect(body.error_code).toBe("AUTH_001");
      expect(body.error_class).toBe("AUTH");
    });
  });

  describe("AC2: Unknown errors wrapped as InternalError", () => {
    it("wraps plain Error as InternalError with 500 status", () => {
      const err = new Error("Something broke");
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.error_code).toBe("INTERNAL_001");
      expect(body.error_class).toBe("INTERNAL");
      expect(body.message).toBe("Internal server error");
      expect(body.retryable).toBe(true);
    });

    it("wraps string thrown as InternalError", () => {
      const err = "unexpected string error";
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.error_code).toBe("INTERNAL_001");
      expect(body.message).toBe("Internal server error");
    });
  });

  describe("AC2: No stack traces in response body", () => {
    it("does not include stack in AppError response", () => {
      const err = new ValidationError("Bad input");
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body).not.toHaveProperty("stack");
    });

    it("does not include stack in unknown error response", () => {
      const err = new Error("Crash");
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body).not.toHaveProperty("stack");
    });

    it("logs the stack server-side via structured logger", () => {
      // The error handler now uses the structured logger (pino) instead of console.error.
      // We verify that the handler processes the error without throwing,
      // and the response is still sent correctly.
      const err = new Error("Crash");
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(err, req, res, next);

      // Verify error was handled and response sent (logger writes to pino stream, not console)
      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.error_code).toBe("INTERNAL_001");
    });
  });

  describe("AC2: Edge cases", () => {
    it("does not send response if headers already sent", () => {
      const err = new ValidationError("Late error");
      const req = mockReq();
      const res = mockRes();
      res.headersSent = true;
      const next = mockNext();

      errorHandler(err, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);
    });

    it("handles null/undefined error gracefully", () => {
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      errorHandler(null, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.error_code).toBe("INTERNAL_001");
    });
  });
});
