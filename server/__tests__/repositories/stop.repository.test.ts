import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests R-P2-01-AC1, R-P2-01-AC2

const { mockQuery } = vi.hoisted(() => {
    const mockQuery = vi.fn();
    return { mockQuery };
});

vi.mock('../../db', () => ({
    default: {
        query: mockQuery,
    },
}));

import { stopRepository } from '../../repositories/stop.repository';

const COMPANY_A = 'company-aaa';

const makeStopRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'stop-001',
    load_id: 'load-001',
    type: 'Pickup',
    facility_name: 'Warehouse A',
    city: 'Chicago',
    state: 'IL',
    date: '2026-03-10',
    appointment_time: '08:00',
    completed: false,
    sequence_order: 0,
    ...overrides,
});

describe('R-P2-01: Stop Repository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('AC1: findByLoadId — tenant-scoped via load FK join', () => {
        it('returns stops for a load belonging to the tenant', async () => {
            const stops = [
                makeStopRow({ id: 'stop-001', sequence_order: 0 }),
                makeStopRow({ id: 'stop-002', type: 'Dropoff', sequence_order: 1 }),
            ];
            mockQuery.mockResolvedValueOnce([stops, []]);

            const result = await stopRepository.findByLoadId('load-001', COMPANY_A);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('stop-001');

            // Verify query includes tenant scoping via join or subquery
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toContain('?');
            expect(params).toContain('load-001');
            expect(params).toContain(COMPANY_A);
        });

        it('returns empty array when load belongs to different tenant', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            const result = await stopRepository.findByLoadId('load-001', 'company-other');

            expect(result).toHaveLength(0);
        });

        it('orders stops by sequence_order', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            await stopRepository.findByLoadId('load-001', COMPANY_A);

            const [sql] = mockQuery.mock.calls[0];
            expect(sql.toLowerCase()).toContain('order by');
            expect(sql.toLowerCase()).toContain('sequence_order');
        });

        it('uses parameterized queries', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            await stopRepository.findByLoadId('load-001', COMPANY_A);

            const [sql] = mockQuery.mock.calls[0];
            expect(sql).not.toContain('load-001');
            expect(sql).not.toContain(COMPANY_A);
        });
    });

    describe('AC2: deleteByLoadId — tenant-scoped deletion', () => {
        it('deletes stops only for a load in the correct tenant', async () => {
            mockQuery.mockResolvedValueOnce([{ affectedRows: 2 }, []]);

            await stopRepository.deleteByLoadId('load-001', COMPANY_A);

            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toContain('DELETE');
            expect(sql).toContain('?');
            expect(params).toContain('load-001');
            expect(params).toContain(COMPANY_A);
        });
    });
});
