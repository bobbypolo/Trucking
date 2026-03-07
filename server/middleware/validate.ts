import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Structured validation error detail returned in the response.
 */
export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Express middleware factory that validates req.body against a Zod schema.
 *
 * On success: replaces req.body with the parsed (coerced/defaulted) value
 * and calls next().
 *
 * On failure: responds with 400 and a structured error:
 *   { error_code: "VALIDATION_001", message: "Validation failed", details: [...] }
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
        const details: ValidationError[] = issues.map((err: any) => ({
            field: err.path.join('.') || '(root)',
            message: err.message,
        }));

        res.status(400).json({
            error_code: 'VALIDATION_001',
            message: 'Validation failed',
            details,
        });
    };
}
