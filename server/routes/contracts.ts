import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import pool from '../db';
import { createChildLogger } from '../lib/logger';

const router = Router();

// Contracts
router.get('/api/contracts/:customerId', requireAuth, requireTenant, async (req: any, res) => {
    try {
        // Basic check: user should probably be allowed to see contracts if they have access to the customer
        // For now, allow authenticated users, but in production, we'd join with company_id
        const [rows] = await pool.query('SELECT * FROM customer_contracts WHERE customer_id = ?', [req.params.customerId]);
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/contracts' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/contracts]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/contracts', requireAuth, requireTenant, async (req: any, res) => {
    const { id, customer_id, contract_name, terms, start_date, expiry_date, equipment_preferences, status } = req.body;
    try {
        await pool.query(
            'REPLACE INTO customer_contracts (id, customer_id, contract_name, terms, start_date, expiry_date, equipment_preferences, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, customer_id, contract_name, terms, start_date, expiry_date, JSON.stringify(equipment_preferences), status]
        );
        res.status(201).json({ message: 'Contract saved' });
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/contracts' });
        log.error({ err: error }, 'SERVER ERROR [POST /api/contracts]');
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
