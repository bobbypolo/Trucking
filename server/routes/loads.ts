import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import pool from '../db';
import { redactData, getVisibilitySettings, sendNotification, checkBreakdownLateness } from '../helpers';
import { validateBody } from '../middleware/validate';
import { createLoadSchema, updateLoadStatusSchema } from '../schemas/loads';
import { createChildLogger } from '../lib/logger';

const router = Router();

// Loads
router.get('/api/loads/:companyId', requireAuth, requireTenant, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        const [rows]: any = await pool.query('SELECT * FROM loads WHERE company_id = ?', [req.params.companyId]);
        const settings = await getVisibilitySettings(req.params.companyId);

        const enrichedLoads = await Promise.all(rows.map(async (load: any) => {
            const [legs]: any = await pool.query('SELECT * FROM load_legs WHERE load_id = ? ORDER BY sequence_order', [load.id]);

            let loadData = {
                ...load,
                legs,
                notificationEmails: load.notification_emails ? (typeof load.notification_emails === 'string' ? JSON.parse(load.notification_emails) : load.notification_emails) : [],
                gpsHistory: load.gps_history ? (typeof load.gps_history === 'string' ? JSON.parse(load.gps_history) : load.gps_history) : [],
                podUrls: load.pod_urls ? (typeof load.pod_urls === 'string' ? JSON.parse(load.pod_urls) : load.pod_urls) : [],
                customerUserId: load.customer_user_id
            };

            return loadData;
        }));

        res.json(redactData(enrichedLoads, req.user.role, settings));
    } catch (error) {
        const log = createChildLogger({ correlationId: (req as any).correlationId, route: 'GET /api/loads' });
        log.error({ err: error }, 'SERVER ERROR [GET /api/loads]');
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/loads', requireAuth, requireTenant, validateBody(createLoadSchema), async (req: any, res) => {
    const { id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type, commodity, weight, container_number, chassis_number, bol_number, legs, notification_emails, contract_id, gpsHistory, podUrls, customerUserId } = req.body;

    if (req.user.companyId !== company_id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            'REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type, commodity, weight, container_number, chassis_number, bol_number, notification_emails, contract_id, gps_history, pod_urls, customer_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type, commodity, weight, container_number, chassis_number, bol_number, JSON.stringify(notification_emails), contract_id, JSON.stringify(gpsHistory), JSON.stringify(podUrls), customerUserId]
        );

        if (legs && Array.isArray(legs)) {
            await connection.query('DELETE FROM load_legs WHERE load_id = ?', [id]);
            for (let i = 0; i < legs.length; i++) {
                const leg = legs[i];
                await connection.query(
                    'INSERT INTO load_legs (id, load_id, type, facility_name, city, state, date, appointment_time, completed, sequence_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [leg.id || uuidv4(), id, leg.type, leg.location?.facilityName || leg.facility_name, leg.location?.city || leg.city, leg.location?.state || leg.state, leg.date, leg.appointmentTime || leg.appointment_time, leg.completed, i]
                );
            }
        }

        // --- KCI BREAKDOWN INTELLIGENCE FLOW ---
        const issues = req.body.issues;
        if (issues && Array.isArray(issues)) {
            for (const issue of issues) {
                const issueId = issue.id || uuidv4();
                await connection.query(
                    'REPLACE INTO issues (id, company_id, load_id, driver_id, category, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [issueId, company_id, id, driver_id, issue.category, issue.description, issue.status || 'Open']
                );

                if (issue.description.includes('BREAKDOWN')) {
                    const incidentId = uuidv4();

                    // 1. Get current driver location for lateness calculation
                    const [logs]: any = await pool.query('SELECT location_lat, location_lng FROM driver_time_logs WHERE user_id = ? ORDER BY clock_in DESC LIMIT 1', [driver_id]);
                    const lat = logs[0]?.location_lat || 38.8794;
                    const lng = logs[0]?.location_lng || -99.3267;

                    const lateCalc = await checkBreakdownLateness(id, lat, lng);
                    const severity = lateCalc.isLate ? 'Critical' : 'High';
                    const recoveryPlan = lateCalc.isLate ? 'REPOWER REQUIRED: Delivery at risk.' : 'Monitor recovery; possible on-time delivery.';

                    // 2. Automated Incident Record
                    await connection.query(
                        'INSERT INTO incidents (id, load_id, type, severity, status, description, location_lat, location_lng, recovery_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [incidentId, id, 'Breakdown', severity, 'Open', issue.description, lat, lng, recoveryPlan]
                    );

                    // 3. Automated Work Items (Audit Trail for Safety & Dispatch)
                    await connection.query(
                        'INSERT INTO work_items (id, company_id, type, priority, label, description, entity_id, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [uuidv4(), company_id, 'SAFETY_ALARM', severity, `Breakdown Alert: Load #${load_number}`, `Driver reported breakdown at Lat: ${lat}, Lng: ${lng}. ${recoveryPlan}`, incidentId, 'INCIDENT']
                    );

                    await connection.query(
                        'INSERT INTO work_items (id, company_id, type, priority, label, description, entity_id, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [uuidv4(), company_id, 'LOAD_EXCEPTION', severity, `Repower Analysis: Load #${load_number}`, `System calculates ${lateCalc.dist} miles to destination. Est. ${lateCalc.required} hours with recovery.`, id, 'LOAD']
                    );
                }
            }
        }

        await connection.commit();

        if (notification_emails && notification_emails.length > 0) {
            sendNotification(notification_emails, `Load Secured: #${load_number}`, `Manifest for ${load_number} has been synchronized. Status: ${status}.`);
        }

        res.status(201).json({ message: 'Load saved' });
    } catch (error) {
        await connection.rollback();
        const log = createChildLogger({ correlationId: (req as any).correlationId, route: 'POST /api/loads' });
        log.error({ err: error }, 'SERVER ERROR [POST /api/loads]');
        res.status(500).json({ error: 'Database error' });
    } finally {
        connection.release();
    }
});

// Specialized Load Update (for Status Triggers)
router.patch('/api/loads/:id/status', requireAuth, requireTenant, validateBody(updateLoadStatusSchema), async (req: any, res) => {
    const { status, dispatcher_id } = req.body;
    const loadId = req.params.id;
    try {
        await pool.query('UPDATE loads SET status = ? WHERE id = ?', [status, loadId]);
        await pool.query(
            'INSERT INTO dispatch_events (id, load_id, dispatcher_id, event_type, message) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), loadId, dispatcher_id, 'StatusChange', `Status updated to ${status}`]
        );

        // Notify if there are emails
        const [rows]: any = await pool.query('SELECT load_number, notification_emails FROM loads WHERE id = ?', [loadId]);
        if (rows[0] && rows[0].notification_emails) {
            const emails = typeof rows[0].notification_emails === 'string' ? JSON.parse(rows[0].notification_emails) : rows[0].notification_emails;
            sendNotification(emails, `Status Update: #${rows[0].load_number}`, `Load #${rows[0].load_number} has been updated to ${status}.`);
        }

        res.json({ message: 'Status updated' });
    } catch (error) {
        const log = createChildLogger({ correlationId: (req as any).correlationId, route: 'PATCH /api/loads/status' });
        log.error({ err: error }, 'SERVER ERROR [PATCH /api/loads/status]');
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
