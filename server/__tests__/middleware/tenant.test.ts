import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../errors/AppError';
import { requireTenant } from '../../middleware/requireTenant';

// Tests R-P1-05-AC2

function mockReq(
    user: { uid: string; tenantId: string; role: string; email: string; firebaseUid: string } | null,
    params: Record<string, string> = {},
    body: Record<string, unknown> = {},
): Request {
    return {
        user,
        params,
        body,
        headers: {},
    } as unknown as Request;
}

function mockRes(): Response {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

const userA = {
    uid: 'user-a-id',
    tenantId: 'company-A',
    role: 'dispatcher',
    email: 'a@company-a.com',
    firebaseUid: 'fb-uid-a',
};

const userB = {
    uid: 'user-b-id',
    tenantId: 'company-B',
    role: 'dispatcher',
    email: 'b@company-b.com',
    firebaseUid: 'fb-uid-b',
};

const adminUser = {
    uid: 'admin-id',
    tenantId: 'company-A',
    role: 'admin',
    email: 'admin@system.com',
    firebaseUid: 'fb-uid-admin',
};

describe('R-P1-05: requireTenant middleware', () => {
    let nextFn: NextFunction & ReturnType<typeof vi.fn>;

    beforeEach(() => {
        nextFn = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
    });

    describe('AC2: Cross-tenant access blocked', () => {
        it('user A cannot access company-B loads via URL param (403)', () => {
            const req = mockReq(userA, { companyId: 'company-B' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(ForbiddenError);
            expect(err.statusCode).toBe(403);
            expect(err.error_code).toBe('TENANT_MISMATCH_001');
        });

        it('user B cannot access company-A loads via URL param (403)', () => {
            const req = mockReq(userB, { companyId: 'company-A' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(ForbiddenError);
            expect(err.statusCode).toBe(403);
        });

        it('user A cannot POST to company-B via body company_id (403)', () => {
            const req = mockReq(userA, {}, { company_id: 'company-B' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(ForbiddenError);
            expect(err.statusCode).toBe(403);
        });

        it('user A cannot POST to company-B via body companyId (403)', () => {
            const req = mockReq(userA, {}, { companyId: 'company-B' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(ForbiddenError);
            expect(err.statusCode).toBe(403);
        });
    });

    describe('AC2: Same-tenant access allowed', () => {
        it('user A can access own company loads', () => {
            const req = mockReq(userA, { companyId: 'company-A' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            expect(nextFn.mock.calls[0][0]).toBeUndefined();
        });

        it('user can POST to own company', () => {
            const req = mockReq(userA, {}, { company_id: 'company-A' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            expect(nextFn.mock.calls[0][0]).toBeUndefined();
        });
    });

    describe('AC2: Admin bypass', () => {
        it('admin can access any company (bypasses tenant check)', () => {
            const req = mockReq(adminUser, { companyId: 'company-B' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            expect(nextFn.mock.calls[0][0]).toBeUndefined();
        });
    });

    describe('Edge cases', () => {
        it('rejects when no user context (requireAuth not called first)', () => {
            const req = mockReq(null, { companyId: 'company-A' });
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            const err = nextFn.mock.calls[0][0];
            expect(err).toBeInstanceOf(ForbiddenError);
        });

        it('passes through when no companyId in params or body', () => {
            const req = mockReq(userA, {}, {});
            const res = mockRes();

            requireTenant(req, res, nextFn);

            expect(nextFn).toHaveBeenCalledOnce();
            expect(nextFn.mock.calls[0][0]).toBeUndefined();
        });
    });
});
