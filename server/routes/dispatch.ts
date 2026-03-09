import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import pool from '../db';
import { createChildLogger } from '../lib/logger';

const router = Router();

// Driver Time Logs
router.post('/api/time-logs', requireAuth, requireTenant, async (req: any, res) => {
    const { id, user_id, load_id, activity_type, location_lat, location_lng, clock_out } = req.body;
    // Security: Only allow logging for oneself unless manager
    if (req.user.id !== user_id && req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        if (clock_out) {
            await pool.query('UPDATE driver_time_logs SET clock_out = ? WHERE id = ?', [clock_out, id]);
        } else {
            await pool.query(
                'INSERT INTO driver_time_logs (id, user_id, load_id, activity_type, location_lat, location_lng) VALUES (?, ?, ?, ?, ?, ?)',
                [id || uuidv4(), user_id, load_id, activity_type, location_lat, location_lng]
            );
        }
        res.status(201).json({ message: 'Time log recorded' });
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/time-logs' });
        log.error({ err: error }, 'SERVER ERROR [POST /api/time-logs]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/api/time-logs/:userId', requireAuth, requireTenant, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role === 'driver') {
        return res.status(403).json({ error: 'Unauthorized profile access' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM driver_time_logs WHERE user_id = ? ORDER BY clock_in DESC LIMIT 50', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/time-logs' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/time-logs]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/api/time-logs/company/:companyId', requireAuth, requireTenant, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Resource unauthorized' });
    }
    try {
        const [rows] = await pool.query(
            'SELECT t.* FROM driver_time_logs t JOIN users u ON t.user_id = u.id WHERE u.company_id = ? ORDER BY t.clock_in DESC LIMIT 500',
            [req.params.companyId]
        );
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/time-logs-company' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/time-logs-company]');
        res.status(500).json({ error: 'Database error' });
    }
});

// Dispatch Events
router.get('/api/dispatch-events/:companyId', requireAuth, requireTenant, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Resource unauthorized' });
    }
    try {
        const [rows] = await pool.query(
            'SELECT de.* FROM dispatch_events de JOIN loads l ON de.load_id = l.id WHERE l.company_id = ? ORDER BY de.created_at DESC',
            [req.params.companyId]
        );
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/dispatch-events' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/dispatch-events]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/dispatch-events', requireAuth, requireTenant, async (req: any, res) => {
    const { id, load_id, dispatcher_id, event_type, message, payload } = req.body;
    try {
        await pool.query(
            'INSERT INTO dispatch_events (id, load_id, dispatcher_id, event_type, message, payload) VALUES (?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), load_id, dispatcher_id, event_type, message, JSON.stringify(payload)]
        );
        res.status(201).json({ message: 'Dispatch event logged' });
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/dispatch-events' });
        log.error({ err: error }, 'SERVER ERROR [POST /api/dispatch-events]');
        res.status(500).json({ error: 'Database error' });
    }
});

// Operational Messaging
router.get('/api/messages/:loadId', requireAuth, requireTenant, async (req: any, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM messages WHERE load_id = ? ORDER BY timestamp ASC', [req.params.loadId]);
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/messages' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/messages]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/messages', requireAuth, requireTenant, async (req: any, res) => {
    const { id, load_id, sender_id, sender_name, text, attachments } = req.body;
    try {
        await pool.query(
            'INSERT INTO messages (id, load_id, sender_id, sender_name, text, attachments) VALUES (?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), load_id, sender_id, sender_name, text, JSON.stringify(attachments)]
        );
        res.status(201).json({ message: 'Message sent' });
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/messages' });
        log.error({ err: error }, 'SERVER ERROR [POST /api/messages]');
        res.status(500).json({ error: 'Database error' });
    }
});

// Dashboard
router.get('/api/dashboard/cards', requireAuth, requireTenant, async (req: any, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM dashboard_card ORDER BY sort_order ASC');
        res.json(rows);
    } catch (error) {
        const log = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/dashboard/cards' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/dashboard/cards]');
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
