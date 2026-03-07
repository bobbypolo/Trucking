import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';

const router = Router();

// Exception Management
router.get('/api/exceptions', async (req, res) => {
    try {
        const { status, type, severity, entityType, entityId, ownerId } = req.query;
        let query = 'SELECT * FROM exceptions WHERE 1=1';
        const params: any[] = [];
        if (status) { query += ' AND status = ?'; params.push(status); }
        if (type) { query += ' AND type = ?'; params.push(type); }
        if (severity) { query += ' AND severity = ?'; params.push(severity); }
        if (entityType) { query += ' AND entity_type = ?'; params.push(entityType); }
        if (entityId) { query += ' AND entity_id = ?'; params.push(entityId); }
        if (ownerId) { query += ' AND owner_user_id = ?'; params.push(ownerId); }
        query += ' ORDER BY severity DESC, sla_due_at ASC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/exceptions', async (req, res) => {
    const ex = req.body;
    const id = uuidv4();
    try {
        await pool.query(
            'INSERT INTO exceptions (id, tenant_id, type, status, severity, entity_type, entity_id, owner_user_id, team, sla_due_at, workflow_step, financial_impact_est, description, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, ex.tenantId || 'DEFAULT', ex.type, ex.status || 'OPEN', ex.severity || 2, ex.entityType, ex.entityId, ex.ownerUserId, ex.team, ex.slaDueAt, ex.workflowStep || 'triage', ex.financialImpactEst || 0, ex.description, JSON.stringify(ex.links || {})]
        );
        // Log creation event
        await pool.query(
            'INSERT INTO exception_events (id, exception_id, action, notes, actor_name) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), id, 'Exception Created', 'Initial intake', ex.createdBy || 'System']
        );
        res.status(201).json({ message: 'Exception recorded', id });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.patch('/api/exceptions/:id', async (req, res) => {
    const { id } = req.params;
    const { status, ownerUserId, workflowStep, severity, notes, actorName } = req.body;
    try {
        const [old]: any = await pool.query('SELECT * FROM exceptions WHERE id = ?', [id]);
        if (old.length === 0) return res.status(404).json({ error: 'Not found' });

        let query = 'UPDATE exceptions SET updated_at = CURRENT_TIMESTAMP';
        const params: any[] = [];
        if (status) { query += ', status = ?'; params.push(status); }
        if (ownerUserId) { query += ', owner_user_id = ?'; params.push(ownerUserId); }
        if (workflowStep) { query += ', workflow_step = ?'; params.push(workflowStep); }
        if (severity) { query += ', severity = ?'; params.push(severity); }
        if (status === 'RESOLVED' || status === 'CLOSED') { query += ', resolved_at = CURRENT_TIMESTAMP'; }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);

        // [RESOLUTION HOOKS] - Trigger cross-module updates
        if (status === 'RESOLVED') {
            const [ex]: any = await pool.query('SELECT * FROM exceptions WHERE id = ?', [id]);
            const exception = ex[0];

            // Dispatch Update: If Delay, update ETA or Status
            // Billing Update: If POD Received, unlock Invoicing
            // Payroll Update: If doc correct, approve settlement line
            console.log(`[TRIGGER] Automated resolution logic for ${exception.type} on ${exception.entity_type} ${exception.entity_id}`);
        }

        // Log event
        await pool.query(
            'INSERT INTO exception_events (id, exception_id, action, notes, actor_name, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), id, 'Status/Owner Updated', notes || 'Update via command center', actorName || 'System', JSON.stringify(old[0]), JSON.stringify({ status, ownerUserId, workflowStep, severity })]
        );

        res.json({ message: 'Exception updated' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/api/exceptions/:id/events', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM exception_events WHERE exception_id = ? ORDER BY timestamp DESC', [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/api/exception-types', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM exception_type ORDER BY display_name ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
