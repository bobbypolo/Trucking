import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import pool from '../db';

const router = Router();

// Emergency Management: Incidents
router.get('/api/incidents', requireAuth, requireTenant, async (req: any, res) => {
    try {
        const [rows]: any = await pool.query('SELECT * FROM incidents ORDER BY reported_at DESC');
        const enrichedIncidents = await Promise.all(rows.map(async (inc: any) => {
            const [timeline] = await pool.query('SELECT * FROM incident_actions WHERE incident_id = ? ORDER BY timestamp ASC', [inc.id]);
            const [billing] = await pool.query('SELECT * FROM emergency_charges WHERE incident_id = ?', [inc.id]);
            return { ...inc, timeline, billingItems: billing };
        }));
        res.json(enrichedIncidents);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/incidents]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/incidents', requireAuth, requireTenant, async (req: any, res) => {
    const { id, load_id, type, severity, status, sla_deadline, description, location_lat, location_lng, recovery_plan } = req.body;

    // Validation: check if load exists to prevent FK violation
    try {
        const [loadRows]: any = await pool.query('SELECT id FROM loads WHERE id = ?', [load_id]);
        if (loadRows.length === 0) {
            console.warn(`[API] Incident creation failed: Load ${load_id} not found.`);
            return res.status(400).json({ error: 'FK Violation', details: `Load ${load_id} does not exist. Please use a valid Load ID.` });
        }

        await pool.query(
            'INSERT INTO incidents (id, load_id, type, severity, status, sla_deadline, description, location_lat, location_lng, recovery_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), load_id, type, severity, status, sla_deadline, description, location_lat, location_lng, recovery_plan]
        );
        console.log(`[SQL SYNC] Incident ${id} created successfully.`);
        res.status(201).json({ message: 'Incident created' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/incidents]:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    }
});

router.post('/api/incidents/:id/actions', requireAuth, requireTenant, async (req: any, res) => {
    const { id, actor_name, action, notes, attachments } = req.body;
    const incidentId = req.params.id;
    try {
        // Validation: check if incident exists
        const [incRows]: any = await pool.query('SELECT id FROM incidents WHERE id = ?', [incidentId]);
        if (incRows.length === 0) {
            console.warn(`[API] Action log failed: Incident ${incidentId} not found.`);
            return res.status(404).json({ error: 'Not Found', details: `Incident ${incidentId} does not exist.` });
        }

        await pool.query(
            'INSERT INTO incident_actions (id, incident_id, actor_name, action, notes, attachments) VALUES (?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), incidentId, actor_name, action, notes, JSON.stringify(attachments)]
        );
        console.log(`[SQL SYNC] Action logged for Incident ${incidentId}.`);
        res.status(201).json({ message: 'Action logged' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/incidents/actions]:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    }
});

router.post('/api/incidents/:id/charges', requireAuth, requireTenant, async (req: any, res) => {
    const { id, category, amount, provider_vendor, status, approved_by, receipt_url } = req.body;
    const incidentId = req.params.id;
    try {
        await pool.query(
            'INSERT INTO emergency_charges (id, incident_id, category, amount, provider_vendor, status, approved_by, receipt_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), incidentId, category, amount, provider_vendor, status, approved_by, receipt_url]
        );
        res.status(201).json({ message: 'Charge recorded' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
