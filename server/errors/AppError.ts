import { randomUUID } from 'crypto';

/**
 * Options for constructing an AppError.
 */
export interface AppErrorOptions {
    error_code: string;
    error_class: string;
    message: string;
    statusCode: number;
    correlation_id?: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
}

/**
 * Base application error class providing a standardized error taxonomy.
 *
 * Every error carries: error_code, error_class, message, correlation_id,
 * retryable flag, and an arbitrary details object. The statusCode drives
 * HTTP response status but is NEVER included in the client-facing JSON.
 */
export class AppError extends Error {
    public readonly error_code: string;
    public readonly error_class: string;
    public readonly correlation_id: string;
    public readonly retryable: boolean;
    public readonly details: Record<string, unknown>;
    public readonly statusCode: number;

    constructor(opts: AppErrorOptions) {
        super(opts.message);
        this.name = 'AppError';
        this.error_code = opts.error_code;
        this.error_class = opts.error_class;
        this.correlation_id = opts.correlation_id ?? randomUUID();
        this.retryable = opts.retryable ?? false;
        this.details = opts.details ?? {};
        this.statusCode = opts.statusCode;

        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Returns the structured error envelope for client responses.
     * Intentionally excludes stack and statusCode.
     */
    toJSON(): Record<string, unknown> {
        return {
            error_code: this.error_code,
            error_class: this.error_class,
            message: this.message,
            correlation_id: this.correlation_id,
            retryable: this.retryable,
            details: this.details,
        };
    }
}

/**
 * 400 — Validation failures (schema, business rules, input format).
 */
export class ValidationError extends AppError {
    constructor(
        message: string,
        details: Record<string, unknown> = {},
        error_code = 'VALIDATION_001',
    ) {
        super({
            error_code,
            error_class: 'VALIDATION',
            message,
            statusCode: 400,
            retryable: false,
            details,
        });
        this.name = 'ValidationError';
    }
}

/**
 * 404 — Resource not found.
 */
export class NotFoundError extends AppError {
    constructor(
        message: string,
        details: Record<string, unknown> = {},
        error_code = 'NOT_FOUND_001',
    ) {
        super({
            error_code,
            error_class: 'NOT_FOUND',
            message,
            statusCode: 404,
            retryable: false,
            details,
        });
        this.name = 'NotFoundError';
    }
}

/**
 * 401 — Authentication / authorization failures.
 */
export class AuthError extends AppError {
    constructor(
        message: string,
        details: Record<string, unknown> = {},
        error_code = 'AUTH_001',
    ) {
        super({
            error_code,
            error_class: 'AUTH',
            message,
            statusCode: 401,
            retryable: false,
            details,
        });
        this.name = 'AuthError';
    }
}

/**
 * 409 — State conflicts (duplicate, already assigned, concurrent edit).
 */
export class ConflictError extends AppError {
    constructor(
        message: string,
        details: Record<string, unknown> = {},
        error_code = 'CONFLICT_001',
    ) {
        super({
            error_code,
            error_class: 'CONFLICT',
            message,
            statusCode: 409,
            retryable: false,
            details,
        });
        this.name = 'ConflictError';
    }
}

/**
 * 500 — Unexpected internal errors. Retryable by default.
 */
export class InternalError extends AppError {
    constructor(
        message: string,
        details: Record<string, unknown> = {},
        error_code = 'INTERNAL_001',
    ) {
        super({
            error_code,
            error_class: 'INTERNAL',
            message,
            statusCode: 500,
            retryable: true,
            details,
        });
        this.name = 'InternalError';
    }
}
