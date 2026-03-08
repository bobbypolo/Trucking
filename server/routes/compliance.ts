import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import pool from '../db';
import { createChildLogger } from '../lib/logger';

const router = Router();

// Compliance Records
router.get('/api/compliance/:userId', requireAuth, requireTenant, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'safety_manager') {
        return res.status(403).json({ error: 'Unauthorized profile access' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM compliance_records WHERE user_id = ?', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: (req as any).correlationId, route: 'GET /api/compliance' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/compliance]');
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
