import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';

/**
 * Structured validation error detail for Zod field-level issues.
 */
export interface ValidationErrorDetail {
    field: string;
    message: string;
}

/**
 * Express middleware factory that validates req.body against a Zod schema.
 *
 * On success: replaces req.body with the parsed (coerced/defaulted) value
 * and calls next().
 *
 * On failure: throws a ValidationError with field-level details.
 * The global errorHandler middleware catches this and returns the
 * structured envelope to the client.
 */
export function validateBody(schema: ZodSchema) {
    return function validate(req: Request, res: Response, next: NextFunction) {
        const result = schema.safeParse(req.body);

        if (result.success) {
            req.body = result.data;
            next();
            return;
        }

        const zodError = result.error as ZodError;
        const issues = zodError.issues || (zodError as any).errors || [];
        const details: ValidationErrorDetail[] = issues.map((err: any) => ({
            field: err.path.join('.') || '(root)',
            message: err.message,
        }));

        const error = new ValidationError('Validation failed', {
            fields: details,
        });
        next(error);
    };
}
