import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors/AppError";
import type { ValidationErrorDetail } from "./validate";

/**
 * Express middleware factory that validates req.params against a Zod schema.
 *
 * On success: replaces req.params with the parsed (coerced/defaulted) value
 * and calls next().
 *
 * On failure: passes a ValidationError with field-level details to next().
 * The global errorHandler middleware catches this and returns the
 * structured envelope to the client.
 */
export function validateParams(schema: ZodSchema) {
  return function validate(req: Request, _res: Response, next: NextFunction) {
    const result = schema.safeParse(req.params);

    if (result.success) {
      req.params = result.data as typeof req.params;
      next();
      return;
    }

    const zodError = result.error as ZodError;
    const issues = zodError.issues || [];
    const details: ValidationErrorDetail[] = issues.map((err: any) => ({
      field: err.path.join(".") || "(root)",
      message: err.message,
    }));

    const error = new ValidationError("Invalid path parameters", {
      fields: details,
    });
    next(error);
  };
}
