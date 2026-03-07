import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests R-P2-01-AC1, R-P2-01-AC2

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const {
    mockQuery, mockExecute, mockBeginTransaction, mockCommit,
    mockRollback, mockRelease, mockGetConnection, mockConnection,
} = vi.hoisted(() => {
    const mockQuery = vi.fn();
    const mockExecute = vi.fn();
    const mockBeginTransaction = vi.fn().mockResolvedValue(undefined);
    const mockCommit = vi.fn().mockResolvedValue(undefined);
    const mockRollback = vi.fn().mockResolvedValue(undefined);
    const mockRelease = vi.fn();
    const mockGetConnection = vi.fn();

    const mockConnection = {
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
        release: mockRelease,
        query: mockQuery,
        execute: mockExecute,
    };

    return {
        mockQuery, mockExecute, mockBeginTransaction, mockCommit,
        mockRollback, mockRelease, mockGetConnection, mockConnection,
    };
});

vi.mock('../../db', () => ({
    default: {
        query: mockQuery,
        execute: mockExecute,
        getConnection: mockGetConnection,
    },
}));

import { loadRepository } from '../../repositories/load.repository';

// --- Test data ---
const COMPANY_A = 'company-aaa';
const COMPANY_B = 'company-bbb';

const makeLoadRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'load-001',
    company_id: COMPANY_A,
    customer_id: 'cust-1',
    driver_id: 'driver-1',
    dispatcher_id: 'disp-1',
    load_number: 'LD-001',
    status: 'draft',
    carrier_rate: 1500,
    driver_pay: 800,
    pickup_date: '2026-03-10',
    freight_type: 'Dry Van',
    commodity: 'Electronics',
    weight: 42000,
    container_number: null,
    chassis_number: null,
    bol_number: 'BOL-001',
    notification_emails: '[]',
    contract_id: null,
    gps_history: '[]',
    pod_urls: '[]',
    customer_user_id: null,
    created_at: '2026-03-07T00:00:00.000Z',
    ...overrides,
});

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

describe('R-P2-01: Load Repository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetConnection.mockResolvedValue(mockConnection);
    });

    describe('AC1: findByCompany — tenant-scoped queries', () => {
        it('returns only loads belonging to the specified company', async () => {
            const companyALoads = [
                makeLoadRow({ id: 'load-001' }),
                makeLoadRow({ id: 'load-002', load_number: 'LD-002' }),
            ];
            mockQuery.mockResolvedValueOnce([companyALoads, []]);

            const result = await loadRepository.findByCompany(COMPANY_A);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('load-001');
            expect(result[1].id).toBe('load-002');

            // Verify tenant scoping in SQL
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toContain('WHERE');
            expect(sql).toContain('company_id');
            expect(sql).toContain('?');
            expect(params).toContain(COMPANY_A);
        });

        it('returns empty array when company has no loads', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            const result = await loadRepository.findByCompany('company-empty');

            expect(result).toHaveLength(0);
        });

        it('uses parameterized query (no string interpolation)', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            await loadRepository.findByCompany(COMPANY_A);

            const [sql, params] = mockQuery.mock.calls[0];
            // SQL must use ? placeholders, NOT string concatenation
            expect(sql).not.toContain(COMPANY_A);
            expect(params).toEqual([COMPANY_A]);
        });
    });

    describe('AC1: findById — tenant-scoped lookup', () => {
        it('returns load when id and companyId match', async () => {
            const loadRow = makeLoadRow();
            mockQuery.mockResolvedValueOnce([[loadRow], []]);

            const result = await loadRepository.findById('load-001', COMPANY_A);

            expect(result).not.toBeNull();
            expect(result!.id).toBe('load-001');
            expect(result!.company_id).toBe(COMPANY_A);
        });

        it('returns null when load exists but belongs to different tenant', async () => {
            // Query returns empty because WHERE includes company_id
            mockQuery.mockResolvedValueOnce([[], []]);

            const result = await loadRepository.findById('load-001', COMPANY_B);

            expect(result).toBeNull();

            // Verify the SQL includes both id AND company_id in WHERE clause
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toContain('?');
            expect(params).toContain('load-001');
            expect(params).toContain(COMPANY_B);
        });

        it('returns null when load does not exist at all', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            const result = await loadRepository.findById('nonexistent', COMPANY_A);

            expect(result).toBeNull();
        });

        it('uses parameterized query for both id and companyId', async () => {
            mockQuery.mockResolvedValueOnce([[], []]);

            await loadRepository.findById('load-001', COMPANY_A);

            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).not.toContain('load-001');
            expect(sql).not.toContain(COMPANY_A);
            expect(params).toContain('load-001');
            expect(params).toContain(COMPANY_A);
        });
    });

    describe('AC2: create — transactional load + stops creation', () => {
        const createInput = {
            company_id: COMPANY_A,
            customer_id: 'cust-1',
            driver_id: 'driver-1',
            dispatcher_id: 'disp-1',
            load_number: 'LD-100',
            status: 'draft' as const,
            carrier_rate: 2000,
            driver_pay: 1000,
            pickup_date: '2026-03-15',
            freight_type: 'Reefer',
            commodity: 'Food',
            weight: 38000,
        };

        const stopsInput = [
            {
                type: 'Pickup' as const,
                facility_name: 'Origin Warehouse',
                city: 'Dallas',
                state: 'TX',
                date: '2026-03-15',
                appointment_time: '09:00',
            },
            {
                type: 'Dropoff' as const,
                facility_name: 'Destination DC',
                city: 'Atlanta',
                state: 'GA',
                date: '2026-03-16',
                appointment_time: '14:00',
            },
        ];

        it('creates load and stops within a transaction', async () => {
            // Mock the INSERT queries on the connection
            mockQuery.mockResolvedValue([{ affectedRows: 1, insertId: 0 }, []]);

            const result = await loadRepository.create(createInput, stopsInput, COMPANY_A);

            // Transaction lifecycle
            expect(mockGetConnection).toHaveBeenCalledOnce();
            expect(mockBeginTransaction).toHaveBeenCalledOnce();
            expect(mockCommit).toHaveBeenCalledOnce();
            expect(mockRelease).toHaveBeenCalledOnce();
            expect(mockRollback).not.toHaveBeenCalled();

            // Load insert + 2 stop inserts = 3 queries
            expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(3);

            // Verify the returned load has an id and company_id
            expect(result.id).toBeDefined();
            expect(result.company_id).toBe(COMPANY_A);
            expect(result.load_number).toBe('LD-100');
        });

        it('rolls back transaction if stop insert fails', async () => {
            // First call (load insert) succeeds
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);
            // Second call (first stop) fails
            mockQuery.mockRejectedValueOnce(new Error('FK constraint violation'));

            await expect(
                loadRepository.create(createInput, stopsInput, COMPANY_A),
            ).rejects.toThrow('FK constraint violation');

            expect(mockRollback).toHaveBeenCalledOnce();
            expect(mockCommit).not.toHaveBeenCalled();
            expect(mockRelease).toHaveBeenCalledOnce();
        });

        it('uses parameterized queries for load insert', async () => {
            mockQuery.mockResolvedValue([{ affectedRows: 1, insertId: 0 }, []]);

            await loadRepository.create(createInput, stopsInput, COMPANY_A);

            // First query call is the load INSERT
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toContain('INSERT INTO loads');
            expect(sql).toContain('?');
            // Should NOT contain raw values in the SQL string
            expect(sql).not.toContain('LD-100');
            expect(sql).not.toContain(COMPANY_A);
            // Params should include company_id
            expect(params).toContain(COMPANY_A);
        });

        it('uses parameterized queries for stop inserts', async () => {
            mockQuery.mockResolvedValue([{ affectedRows: 1, insertId: 0 }, []]);

            await loadRepository.create(createInput, stopsInput, COMPANY_A);

            // Stop inserts start at index 1
            const [sql1, params1] = mockQuery.mock.calls[1];
            expect(sql1).toContain('INSERT INTO load_legs');
            expect(sql1).toContain('?');
            expect(sql1).not.toContain('Dallas');
            expect(params1).toContain('Dallas');

            const [sql2, params2] = mockQuery.mock.calls[2];
            expect(sql2).toContain('INSERT INTO load_legs');
            expect(params2).toContain('Atlanta');
        });

        it('assigns a generated UUID to each stop', async () => {
            mockQuery.mockResolvedValue([{ affectedRows: 1, insertId: 0 }, []]);

            await loadRepository.create(createInput, stopsInput, COMPANY_A);

            // Stop insert params should include a UUID-like string at index 0
            const stopParams1 = mockQuery.mock.calls[1][1];
            expect(typeof stopParams1[0]).toBe('string');
            expect(stopParams1[0].length).toBeGreaterThanOrEqual(36);

            const stopParams2 = mockQuery.mock.calls[2][1];
            expect(typeof stopParams2[0]).toBe('string');
            // Each stop should have a unique ID
            expect(stopParams1[0]).not.toBe(stopParams2[0]);
        });

        it('sets sequence_order based on stop array index', async () => {
            mockQuery.mockResolvedValue([{ affectedRows: 1, insertId: 0 }, []]);

            await loadRepository.create(createInput, stopsInput, COMPANY_A);

            // Stop insert: last param is sequence_order
            const stopParams1 = mockQuery.mock.calls[1][1];
            const stopParams2 = mockQuery.mock.calls[2][1];

            // sequence_order should be 0 for first stop, 1 for second
            const lastIdx = stopParams1.length - 1;
            expect(stopParams1[lastIdx]).toBe(0);
            expect(stopParams2[lastIdx]).toBe(1);
        });
    });

    describe('AC2: update — tenant-scoped update', () => {
        it('updates load fields with tenant scope', async () => {
            // First call: update query
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
            // Second call: select to return updated load
            mockQuery.mockResolvedValueOnce([[makeLoadRow({ status: 'planned' })], []]);

            const result = await loadRepository.update(
                'load-001',
                { status: 'planned' },
                COMPANY_A,
            );

            expect(result).not.toBeNull();
            expect(result!.status).toBe('planned');

            // Verify UPDATE query includes company_id in WHERE
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toContain('UPDATE loads');
            expect(sql).toContain('WHERE');
            expect(params).toContain('load-001');
            expect(params).toContain(COMPANY_A);
        });

        it('returns null when load does not belong to tenant', async () => {
            mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

            const result = await loadRepository.update(
                'load-001',
                { status: 'planned' },
                COMPANY_B,
            );

            expect(result).toBeNull();
        });

        it('uses parameterized queries for updates', async () => {
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
            mockQuery.mockResolvedValueOnce([[makeLoadRow()], []]);

            await loadRepository.update('load-001', { status: 'planned' }, COMPANY_A);

            const [sql] = mockQuery.mock.calls[0];
            expect(sql).not.toContain('load-001');
            expect(sql).not.toContain(COMPANY_A);
            expect(sql).toContain('?');
        });
    });
});
