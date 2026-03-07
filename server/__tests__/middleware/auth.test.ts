import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthError, InternalError } from '../../errors/AppError';

// Tests R-P1-05-AC1, R-P1-05-AC4

// Use vi.hoisted so mock fns are available before vi.mock factory runs
const { mockVerifyIdToken, mockCollection, mockApp } = vi.hoisted(() => ({
    mockVerifyIdToken: vi.fn(),
    mockCollection: vi.fn(),
    mockApp: vi.fn(),
}));

vi.mock('firebase-admin', () => {
    return {
        default: {
            app: mockApp,
            auth: () => ({
                verifyIdToken: mockVerifyIdToken,
            }),
            firestore: () => ({
                collection: mockCollection,
            }),
        },
    };
});

import { requireAuth, AuthenticatedRequest } from '../../middleware/requireAuth';

function mockReq(headers: Record<string, string> = {}): Request {
    return {
        headers,
        params: {},
        body: {},
    } as unknown as Request;
}

function mockRes(): Response {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

describe('R-P1-05: requireAuth middleware', () => {
    let nextFn: NextFunction & ReturnType<typeof vi.fn>;

    beforeEach(() => {
        nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('AC1: Firebase Admin SDK validation only', () => {
        it('rejects requests when Firebase Admin is not initialized (fail-closed)', async () => {
            mockApp.mockImplementation(() => {
                throw new Error('No app');
            });

            const req = mockReq({ authorization: 'Bearer valid-token' });
            const res = mockRes();

            await requireAuth(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(InternalError);
            expect(err.statusCode).toBe(500);
            expect(err.error_code).toBe('AUTH_CONFIG_001');
        });

        it('rejects requests with missing Authorization header (401)', async () => {
            mockApp.mockReturnValue(true);
            const req = mockReq({});
            const res = mockRes();

            await requireAuth(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(AuthError);
            expect(err.statusCode).toBe(401);
            expect(err.error_code).toBe('AUTH_MISSING_001');
        });

        it('rejects requests with malformed Authorization header (401)', async () => {
            mockApp.mockReturnValue(true);
            const req = mockReq({ authorization: 'NotBearer token' });
            const res = mockRes();

            await requireAuth(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(AuthError);
            expect(err.statusCode).toBe(401);
        });

        it('rejects requests with invalid/expired token (via Firebase Admin)', async () => {
            mockApp.mockReturnValue(true);
            mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

            const req = mockReq({ authorization: 'Bearer expired-token' });
            const res = mockRes();

            await requireAuth(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(AuthError);
            expect(err.statusCode).toBe(401);
            expect(err.error_code).toBe('AUTH_INVALID_001');
        });

        it('rejects when Firebase UID has no linked user profile', async () => {
            mockApp.mockReturnValue(true);
            mockVerifyIdToken.mockResolvedValue({
                uid: 'firebase-uid-123',
                email: 'orphan@test.com',
            });

            const mockWhere = vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({ empty: true }),
                }),
            });
            const mockDoc = vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: false }),
            });
            mockCollection.mockReturnValue({
                where: mockWhere,
                doc: mockDoc,
            });

            const req = mockReq({ authorization: 'Bearer valid-token' });
            const res = mockRes();

            await requireAuth(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(AuthError);
            expect(err.error_code).toBe('AUTH_NO_PROFILE_001');
        });

        it('authenticates valid token and resolves user profile from Firestore', async () => {
            mockApp.mockReturnValue(true);
            mockVerifyIdToken.mockResolvedValue({
                uid: 'firebase-uid-456',
                email: 'driver@company.com',
            });

            const mockUserDoc = {
                id: 'user-doc-id',
                data: () => ({
                    id: 'user-123',
                    company_id: 'company-abc',
                    role: 'driver',
                    email: 'driver@company.com',
                }),
            };

            const mockWhere = vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({
                        empty: false,
                        docs: [mockUserDoc],
                    }),
                }),
            });
            mockCollection.mockReturnValue({
                where: mockWhere,
            });

            const req = mockReq({ authorization: 'Bearer valid-token' });
            const res = mockRes();

            await requireAuth(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            expect(nextFn.mock.calls[0][0]).toBeUndefined();

            const authReq = req as unknown as AuthenticatedRequest;
            expect(authReq.user).toBeDefined();
            expect(authReq.user.uid).toBe('user-123');
            expect(authReq.user.tenantId).toBe('company-abc');
            expect(authReq.user.role).toBe('driver');
            expect(authReq.user.email).toBe('driver@company.com');
            expect(authReq.user.firebaseUid).toBe('firebase-uid-456');
        });

        it('uses no JWT_SECRET - Firebase Admin SDK only', async () => {
            const fs = await import('fs');
            const path = await import('path');
            const middlewarePath = path.resolve(__dirname, '../../middleware/requireAuth.ts');
            const content = fs.readFileSync(middlewarePath, 'utf-8');
            expect(content).not.toContain('JWT_SECRET');
            expect(content).not.toContain('jsonwebtoken');
            expect(content).not.toContain('jwt.sign');
            expect(content).not.toContain('jwt.verify');
        });
    });
});
