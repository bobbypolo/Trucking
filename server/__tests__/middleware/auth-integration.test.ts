import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
    AuthError,
    ForbiddenError,
    InternalError,
} from '../../errors/AppError';
import { errorHandler } from '../../middleware/errorHandler';

// Tests R-P1-05-AC4

// Use vi.hoisted so mock fns are available before vi.mock factory runs
const { mockVerifyIdToken, mockResolvePrincipal, mockApp } = vi.hoisted(() => ({
    mockVerifyIdToken: vi.fn(),
    mockResolvePrincipal: vi.fn(),
    mockApp: vi.fn(),
}));

vi.mock('firebase-admin', () => {
    return {
        default: {
            app: mockApp,
            auth: () => ({
                verifyIdToken: mockVerifyIdToken,
            }),
        },
    };
});

vi.mock('../../lib/sql-auth', () => ({
    resolveSqlPrincipalByFirebaseUid: mockResolvePrincipal,
}));

import { requireAuth, AuthenticatedRequest } from '../../middleware/requireAuth';
import { requireTenant } from '../../middleware/requireTenant';

function createReq(
    overrides: Partial<Request> & {
        user?: AuthenticatedRequest['user'];
    } = {},
): Request {
    return {
        headers: {},
        params: {},
        body: {},
        ...overrides,
    } as unknown as Request;
}

function createRes(): Response & { _status: number; _body: any } {
    const res: any = {
        _status: 0,
        _body: null,
        headersSent: false,
    };
    res.status = vi.fn((code: number) => {
        res._status = code;
        return res;
    });
    res.json = vi.fn((body: any) => {
        res._body = body;
        return res;
    });
    return res;
}

/**
 * Helper to simulate the full auth + tenant + error handler pipeline.
 */
async function runPipeline(
    req: Request,
    res: ReturnType<typeof createRes>,
    middlewares: Array<(req: Request, res: Response, next: NextFunction) => void | Promise<void>>,
): Promise<void> {
    let error: unknown = undefined;

    for (const middleware of middlewares) {
        if (error) break;
        await new Promise<void>((resolve) => {
            const next: NextFunction = (err?: unknown) => {
                if (err) error = err;
                resolve();
            };
            Promise.resolve(middleware(req, res, next)).then(() => {
                // If middleware didn't call next, resolve anyway
            });
        });
    }

    // If an error was collected, run it through errorHandler
    if (error) {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        errorHandler(error, req, res, vi.fn());
        consoleSpy.mockRestore();
    }
}

describe('R-P1-05: Auth Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    describe('AC4: Unauthorized access rejection (401)', () => {
        it('rejects request without token with 401 structured error', async () => {
            mockApp.mockReturnValue(true);

            const req = createReq({ headers: {} });
            const res = createRes();

            await runPipeline(req, res, [requireAuth]);

            expect(res._status).toBe(401);
            expect(res._body).toHaveProperty('error_code');
            expect(res._body).toHaveProperty('error_class', 'AUTH');
            expect(res._body).toHaveProperty('message');
            expect(res._body).toHaveProperty('correlation_id');
            expect(res._body).toHaveProperty('retryable', false);
        });

        it('rejects request with invalid token with structured error', async () => {
            mockApp.mockReturnValue(true);
            mockVerifyIdToken.mockRejectedValue(new Error('Token decode failed'));

            const req = createReq({
                headers: { authorization: 'Bearer bad-token' },
            });
            const res = createRes();

            await runPipeline(req, res, [requireAuth]);

            expect(res._status).toBe(401);
            expect(res._body).toHaveProperty('error_code', 'AUTH_INVALID_001');
            expect(res._body).toHaveProperty('error_class', 'AUTH');
            expect(res._body).not.toHaveProperty('stack');
        });
    });

    describe('AC4: Wrong-tenant access rejection (403)', () => {
        it('rejects cross-tenant access with 403 structured error', async () => {
            mockApp.mockReturnValue(true);
            mockVerifyIdToken.mockResolvedValue({
                uid: 'fb-uid-1',
                email: 'user@company-a.com',
            });

            mockResolvePrincipal.mockResolvedValue({
                id: 'user-1',
                tenantId: 'company-A',
                companyId: 'company-A',
                role: 'dispatcher',
                email: 'user@company-a.com',
                firebaseUid: 'fb-uid-1',
            });

            const req = createReq({
                headers: { authorization: 'Bearer valid-token' },
                params: { companyId: 'company-B' },
            });
            const res = createRes();

            await runPipeline(req, res, [requireAuth, requireTenant]);

            expect(res._status).toBe(403);
            expect(res._body).toHaveProperty('error_code', 'TENANT_MISMATCH_001');
            expect(res._body).toHaveProperty('error_class', 'FORBIDDEN');
            expect(res._body).toHaveProperty('message');
            expect(res._body).toHaveProperty('correlation_id');
            expect(res._body).toHaveProperty('retryable', false);
            expect(res._body).not.toHaveProperty('stack');
        });

        it('allows same-tenant access through full pipeline', async () => {
            mockApp.mockReturnValue(true);
            mockVerifyIdToken.mockResolvedValue({
                uid: 'fb-uid-2',
                email: 'user@company-a.com',
            });

            mockResolvePrincipal.mockResolvedValue({
                id: 'user-2',
                tenantId: 'company-A',
                companyId: 'company-A',
                role: 'dispatcher',
                email: 'user@company-a.com',
                firebaseUid: 'fb-uid-2',
            });

            const req = createReq({
                headers: { authorization: 'Bearer valid-token' },
                params: { companyId: 'company-A' },
            });
            const res = createRes();

            let pipelineCompleted = false;
            await runPipeline(req, res, [
                requireAuth,
                requireTenant,
                (_req, _res, next) => {
                    pipelineCompleted = true;
                    next();
                },
            ]);

            expect(pipelineCompleted).toBe(true);
            expect(res._status).toBe(0); // No error status set
        });
    });

    describe('AC4: Structured error response format', () => {
        it('all auth errors follow the AppError envelope format', async () => {
            mockApp.mockReturnValue(true);

            const req = createReq({ headers: {} });
            const res = createRes();

            await runPipeline(req, res, [requireAuth]);

            const body = res._body;
            expect(body).toHaveProperty('error_code');
            expect(body).toHaveProperty('error_class');
            expect(body).toHaveProperty('message');
            expect(body).toHaveProperty('correlation_id');
            expect(body).toHaveProperty('retryable');
            expect(body).toHaveProperty('details');

            // Must NOT have internal fields
            expect(body).not.toHaveProperty('stack');
            expect(body).not.toHaveProperty('statusCode');
        });
    });
});
