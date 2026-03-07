import { Router } from 'express';
import { verifyFirebaseToken } from '../auth';
import pool from '../db';

const router = Router();
const authenticateToken = verifyFirebaseToken;

// Contracts
router.get('/api/contracts/:customerId', authenticateToken, async (req: any, res) => {
    try {
        // Basic check: user should probably be allowed to see contracts if they have access to the customer
        // For now, allow authenticated users, but in production, we'd join with company_id
        const [rows] = await pool.query('SELECT * FROM customer_contracts WHERE customer_id = ?', [req.params.customerId]);
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/contracts]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/contracts', async (req, res) => {
    const { id, customer_id, contract_name, terms, start_date, expiry_date, equipment_preferences, status } = req.body;
    try {
        await pool.query(
            'REPLACE INTO customer_contracts (id, customer_id, contract_name, terms, start_date, expiry_date, equipment_preferences, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, customer_id, contract_name, terms, start_date, expiry_date, JSON.stringify(equipment_preferences), status]
        );
        res.status(201).json({ message: 'Contract saved' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/contracts]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
