import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import pool from '../db';
import { redactData, getVisibilitySettings } from '../helpers';
import { validateBody } from '../middleware/validate';
import { createEquipmentSchema } from '../schemas/equipment';
import { createChildLogger } from '../lib/logger';

const router = Router();

// Equipment — single definition (duplicate from original removed per AC3)
router.get('/api/equipment/:companyId', requireAuth, requireTenant, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        const [rows]: any = await pool.query('SELECT * FROM equipment WHERE company_id = ?', [req.params.companyId]);
        const settings = await getVisibilitySettings(req.params.companyId);
        res.json(redactData(rows, req.user.role, settings));
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/equipment' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/equipment]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/equipment', requireAuth, requireTenant, validateBody(createEquipmentSchema), async (req: any, res) => {
    const { id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost, maintenance_history } = req.body;
    if (req.user.companyId !== company_id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        await pool.query(
            'INSERT INTO equipment (id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost, maintenance_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost, JSON.stringify(maintenance_history)]
        );
        res.status(201).json({ message: 'Equipment added' });
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/equipment' });
        log.error({ err: error }, 'SERVER ERROR [POST /api/equipment]');
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
