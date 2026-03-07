import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthError,
  ConflictError,
  InternalError,
} from "../../errors/AppError";

// Tests R-P1-04-AC1, R-P1-04-AC2

describe("R-P1-04: Error Taxonomy and Response Envelope", () => {
  describe("AC1: AppError base class", () => {
    it("has error_code, error_class, message, correlation_id, retryable, details", () => {
      const err = new AppError({
        error_code: "TEST_001",
        error_class: "TEST",
        message: "Test error",
        statusCode: 500,
      });

      expect(err.error_code).toBe("TEST_001");
      expect(err.error_class).toBe("TEST");
      expect(err.message).toBe("Test error");
      expect(err.correlation_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(err.retryable).toBe(false);
      expect(err.details).toEqual({});
      expect(err.statusCode).toBe(500);
    });

    it("accepts optional correlation_id override", () => {
      const err = new AppError({
        error_code: "TEST_001",
        error_class: "TEST",
        message: "Test",
        statusCode: 400,
        correlation_id: "custom-id-123",
      });
      expect(err.correlation_id).toBe("custom-id-123");
    });

    it("accepts optional retryable and details", () => {
      const err = new AppError({
        error_code: "TEST_002",
        error_class: "TEST",
        message: "Retryable error",
        statusCode: 503,
        retryable: true,
        details: { reason: "service unavailable" },
      });
      expect(err.retryable).toBe(true);
      expect(err.details).toEqual({ reason: "service unavailable" });
    });

    it("extends Error", () => {
      const err = new AppError({
        error_code: "TEST_001",
        error_class: "TEST",
        message: "Test",
        statusCode: 500,
      });
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it("toJSON returns structured envelope without stack", () => {
      const err = new AppError({
        error_code: "TEST_001",
        error_class: "TEST",
        message: "Test",
        statusCode: 400,
        correlation_id: "abc-123",
        details: { field: "name" },
      });
      const json = err.toJSON();

      expect(json).toHaveProperty("error_code", "TEST_001");
      expect(json).toHaveProperty("error_class", "TEST");
      expect(json).toHaveProperty("message", "Test");
      expect(json).toHaveProperty("correlation_id", "abc-123");
      expect(json).toHaveProperty("retryable", false);
      expect(json).toHaveProperty("details", { field: "name" });
      expect(json).not.toHaveProperty("stack");
      expect(json).not.toHaveProperty("statusCode");
    });
  });

  describe("AC1: ValidationError subclass", () => {
    it("sets correct defaults", () => {
      const err = new ValidationError("Name is required", {
        field: "name",
      });
      expect(err.error_code).toBe("VALIDATION_001");
      expect(err.error_class).toBe("VALIDATION");
      expect(err.statusCode).toBe(400);
      expect(err.retryable).toBe(false);
      expect(err.message).toBe("Name is required");
      expect(err.details).toEqual({ field: "name" });
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe("AC1: NotFoundError subclass", () => {
    it("sets correct defaults", () => {
      const err = new NotFoundError("Load not found");
      expect(err.error_code).toBe("NOT_FOUND_001");
      expect(err.error_class).toBe("NOT_FOUND");
      expect(err.statusCode).toBe(404);
      expect(err.retryable).toBe(false);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe("AC1: AuthError subclass", () => {
    it("sets correct defaults", () => {
      const err = new AuthError("Invalid token");
      expect(err.error_code).toBe("AUTH_001");
      expect(err.error_class).toBe("AUTH");
      expect(err.statusCode).toBe(401);
      expect(err.retryable).toBe(false);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe("AC1: ConflictError subclass", () => {
    it("sets correct defaults", () => {
      const err = new ConflictError("Load already assigned");
      expect(err.error_code).toBe("CONFLICT_001");
      expect(err.error_class).toBe("CONFLICT");
      expect(err.statusCode).toBe(409);
      expect(err.retryable).toBe(false);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe("AC1: InternalError subclass", () => {
    it("sets correct defaults", () => {
      const err = new InternalError("Something went wrong");
      expect(err.error_code).toBe("INTERNAL_001");
      expect(err.error_class).toBe("INTERNAL");
      expect(err.statusCode).toBe(500);
      expect(err.retryable).toBe(true);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe("AC1: Custom error_code override", () => {
    it("subclasses accept custom error_code", () => {
      const err = new ValidationError("Bad input", {}, "VALIDATION_002");
      expect(err.error_code).toBe("VALIDATION_002");
    });
  });
});
