import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';
import { v4 as uuidv4 } from 'uuid';
import { detectState, calculateDistance } from './geoUtils';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyFirebaseToken } from './auth';
import db from './firestore';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Middleware: Authenticate Token (Firebase)
const authenticateToken = verifyFirebaseToken;

// Redaction Helper (Security Hardening)
const redactData = (data: any, role: string, settings: any) => {
    if (role !== 'driver' || !settings) return data;

    const redactObject = (obj: any) => {
        const redacted = { ...obj };
        if (settings.hideRates) {
            delete redacted.carrier_rate;
            delete redacted.daily_cost;
            delete redacted.base_amount;
            delete redacted.unit_amount;
            if (!settings.showDriverPay) delete redacted.driver_pay;
        }
        if (settings.maskCustomerName) {
            // Masking for loads/legs
            if (redacted.facility_name) redacted.facility_name = 'Confidential Facility';
            // Masking for clients/customers
            if (redacted.name && (redacted.type === 'Broker' || redacted.type === 'Direct Customer')) {
                redacted.name = 'Confidential Client';
            }
        }
        if (settings.hideBrokerContacts) {
            delete redacted.email;
            delete redacted.phone;
            delete redacted.address;
        }
        return redacted;
    };

    if (Array.isArray(data)) {
        return data.map(item => {
            const redacted = redactObject(item);
            if (redacted.legs && Array.isArray(redacted.legs)) {
                redacted.legs = redacted.legs.map((leg: any) => redactObject(leg));
            }
            return redacted;
        });
    }

    const finalRedacted = redactObject(data);
    if (finalRedacted.legs && Array.isArray(finalRedacted.legs)) {
        finalRedacted.legs = finalRedacted.legs.map((leg: any) => redactObject(leg));
    }
    return finalRedacted;
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'LoadPilot API is running',
        database: 'Firestore'
    });
});

// Helper for Email Notifications (KCI Specialization)
const sendNotification = (emails: string[], subject: string, message: string) => {
    if (!emails || emails.length === 0) return;
    console.log(`[EMAIL NOTIFICATION] TO: ${emails.join(', ')}`);
    console.log(`[EMAIL NOTIFICATION] SUBJECT: ${subject}`);
    console.log(`[EMAIL NOTIFICATION] MESSAGE: ${message}`);
};

/**
 * KCI Intelligence: Calculates breakdown lateness risk
 */
const checkBreakdownLateness = async (loadId: string, lat: number, lng: number) => {
    try {
        const [legs]: any = await pool.query('SELECT * FROM load_legs WHERE load_id = ? AND type = "Dropoff" ORDER BY sequence_order DESC LIMIT 1', [loadId]);
        if (legs.length === 0) return { isLate: false };

        const dropoff = legs[0];
        // For simplicity, we assume facility coordinates are stored or looked up.
        // Mocking at 39.7392, -104.9903 (Denver) for this flow.
        const destLat = 39.7392;
        const destLng = -104.9903;

        const distance = calculateDistance(lat, lng, destLat, destLng);
        const estTransitHours = distance / 50; // 50mph avg
        const recoveryBuffer = 4; // 4 hours for tow/fix

        const totalRequiredHours = estTransitHours + recoveryBuffer;

        return {
            dist: Math.round(distance),
            required: Math.round(totalRequiredHours),
            isLate: totalRequiredHours > 12 // Scenario threshold
        };
    } catch (e) {
        return { isLate: false };
    }
};

// Companies
app.get('/api/companies/:id', async (req, res) => {
    try {
        const doc = await db.collection('companies').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Company not found' });
        res.json(doc.data());
    } catch (error) {
        console.error('SERVER ERROR [GET /api/companies]:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    }
});

app.post('/api/companies', async (req, res) => {
    const { id, name, account_type, email, address, city, state, zip, tax_id, phone, mc_number, dot_number, load_numbering_config, accessorial_rates } = req.body;
    try {
        await db.collection('companies').doc(id).set({
            id, name, account_type, email, address, city, state, zip, tax_id, phone, mc_number, dot_number,
            load_numbering_config: typeof load_numbering_config === 'string' ? JSON.parse(load_numbering_config) : load_numbering_config,
            accessorial_rates: typeof accessorial_rates === 'string' ? JSON.parse(accessorial_rates) : accessorial_rates,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.status(201).json({ message: 'Company created' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/companies]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// AUTHENTICATION & REGISTRATION
app.post('/api/auth/register', async (req, res) => {
    console.log('[API] Registration Request:', JSON.stringify(req.body, null, 2));
    const { id, company_id, companyId, email, password, name, role, pay_model, payModel, pay_rate, payRate } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password || 'admin123', 10);
        let targetCompanyId = company_id || companyId || 'iscope-authority-001';
        if (targetCompanyId === 'null' || !targetCompanyId) targetCompanyId = 'iscope-authority-001';

        const userId = id || uuidv4();
        await db.collection('users').doc(userId).set({
            id: userId,
            company_id: targetCompanyId,
            email,
            password: hashedPassword,
            name,
            role,
            pay_model: pay_model || payModel,
            pay_rate: pay_rate || payRate,
            onboarding_status: 'Completed',
            createdAt: new Date().toISOString()
        });
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('REGISTRATION ERROR:', error);
        res.status(500).json({ error: 'Registration failed', details: error instanceof Error ? error.message : String(error) });
    }
});

// User Management (Sync)
app.post('/api/users', async (req, res) => {
    console.log('[API] User Sync Request:', JSON.stringify(req.body, null, 2));
    const { id, company_id, companyId, email, password, name, role, pay_model, payModel, pay_rate, payRate, managed_by_user_id, managedByUserId, safety_score, safetyScore } = req.body;
    try {
        let targetCompanyId = company_id || companyId || 'iscope-authority-001';
        if (targetCompanyId === 'null' || !targetCompanyId) targetCompanyId = 'iscope-authority-001';

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        const finalRole = role || 'driver';
        const finalSafetyScore = safety_score || safetyScore || 100;

        const userId = id || uuidv4();
        const userData: any = {
            id: userId,
            company_id: targetCompanyId,
            email,
            name,
            role: finalRole,
            pay_model: pay_model || payModel,
            pay_rate: pay_rate || payRate,
            onboarding_status: 'Completed',
            managed_by_user_id: managed_by_user_id || managedByUserId,
            safety_score: finalSafetyScore,
            updatedAt: new Date().toISOString()
        };
        if (hashedPassword) userData.password = hashedPassword;

        await db.collection('users').doc(userId).set(userData, { merge: true });
        res.status(201).json({ message: 'User updated/created' });
    } catch (error) {
        console.error('USER SYNC ERROR:', error);
        res.status(500).json({ error: 'User sync failed', details: error instanceof Error ? error.message : String(error) });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password, firebaseUid } = req.body;
    try {
        // Firebase Auth is handled on the frontend
        // This endpoint is called AFTER Firebase authentication succeeds
        // We just need to fetch the user data from Firestore

        const userSnapshot = await db.collection('users').where('email', '==', email).get();
        if (userSnapshot.empty) {
            // User authenticated with Firebase but no Firestore record exists
            // This shouldn't happen if seeding worked correctly
            console.warn(`[LOGIN] User ${email} authenticated with Firebase but no Firestore record found`);
            return res.status(404).json({ error: 'User profile not found. Please contact support.' });
        }


        const userDoc = userSnapshot.docs[0];
        const user = userDoc.data();

        // Fetch company settings
        const companyDoc = await db.collection('companies').doc(user.company_id).get();
        const companyData = companyDoc.exists ? companyDoc.data() : null;

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id || userDoc.id, companyId: user.company_id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Normalize for frontend (camelCase)
        const normalizedUser = {
            ...user,
            id: user.id || userDoc.id,
            companyId: user.company_id,
            onboardingStatus: user.onboarding_status,
            payModel: user.pay_model,
            payRate: user.pay_rate,
            managedByUserId: user.managed_by_user_id,
            safetyScore: user.safety_score,
            primaryWorkspace: user.primary_workspace,
            dutyMode: user.duty_mode
        };
        delete (normalizedUser as any).password;
        delete (normalizedUser as any).company_id;
        delete (normalizedUser as any).onboarding_status;
        delete (normalizedUser as any).pay_model;
        delete (normalizedUser as any).pay_rate;
        delete (normalizedUser as any).managed_by_user_id;
        delete (normalizedUser as any).safety_score;
        delete (normalizedUser as any).primary_workspace;
        delete (normalizedUser as any).duty_mode;

        console.log(`[LOGIN SUCCESS] User ${email} logged in successfully`);
        res.json({ user: normalizedUser, company: companyData, token });


    } catch (error) {
        console.error('LOGIN ERROR:', error);
        res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : String(error) });
    }
});

// Protected User Routes (Require Token)
app.get('/api/users/me', authenticateToken, async (req: any, res) => {
    try {
        const doc = await db.collection('users').doc(req.user.id).get();
        const user = doc.data();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/:companyId', authenticateToken, async (req: any, res) => {
    // RBAC: Ensure user only sees users from their own company
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Resource unauthorized' });
    }


    try {
        const snapshot = await db.collection('users').where('company_id', '==', req.params.companyId).get();
        const users = snapshot.docs.map(doc => {
            const u = doc.data();
            return {
                ...u,
                id: u.id || doc.id,
                companyId: u.company_id,
                onboardingStatus: u.onboarding_status,
                safetyScore: u.safety_score,
                password: undefined
            };
        });
        res.json(users);

    } catch (error) {
        console.error('SERVER ERROR [GET /api/users]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Equipment
app.get('/api/equipment/:companyId', authenticateToken, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        const [rows]: any = await pool.query('SELECT * FROM equipment WHERE company_id = ?', [req.params.companyId]);

        // Fetch visibility settings
        const [companyRows]: any = await pool.query('SELECT driver_visibility_settings FROM companies WHERE id = ?', [req.params.companyId]);
        let settings = null;
        try {
            const rawSettings = companyRows[0]?.driver_visibility_settings;
            settings = rawSettings ? (typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings) : null;
        } catch (e) {
            console.error('Failed to parse driver_visibility_settings:', e);
        }

        res.json(redactData(rows, req.user.role, settings));
    } catch (error) {
        console.error('SERVER ERROR [GET /api/equipment]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/equipment', authenticateToken, async (req: any, res) => {
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
        console.error('SERVER ERROR [POST /api/equipment]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Clients / Brokers Routes
app.get('/api/clients/:companyId', authenticateToken, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        const [rows]: any = await pool.query('SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC', [req.params.companyId]);

        // Fetch visibility settings
        const [companyRows]: any = await pool.query('SELECT driver_visibility_settings FROM companies WHERE id = ?', [req.params.companyId]);
        let settings = null;
        try {
            const rawSettings = companyRows[0]?.driver_visibility_settings;
            settings = rawSettings ? (typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings) : null;
        } catch (e) {
            console.error('Failed to parse driver_visibility_settings:', e);
        }

        res.json(redactData(rows, req.user.role, settings));
    } catch (error) {
        console.error('SERVER ERROR [GET /api/clients]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/clients', authenticateToken, async (req: any, res) => {
    const { id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, chassis_requirements } = req.body;
    if (req.user.companyId !== company_id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        await pool.query(
            'REPLACE INTO customers (id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, chassis_requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, JSON.stringify(chassis_requirements)]
        );
        res.status(201).json({ message: 'Client saved' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/clients]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Loads
app.get('/api/loads/:companyId', authenticateToken, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        const [rows]: any = await pool.query('SELECT * FROM loads WHERE company_id = ?', [req.params.companyId]);

        // Fetch Company visibility settings for redaction
        const [companyRows]: any = await pool.query('SELECT driver_visibility_settings FROM companies WHERE id = ?', [req.params.companyId]);
        let settings = null;
        try {
            const rawSettings = companyRows[0]?.driver_visibility_settings;
            settings = rawSettings ? (typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings) : null;
        } catch (e) {
            console.error('Failed to parse driver_visibility_settings:', e);
        }

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
        console.error('SERVER ERROR [GET /api/loads]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/loads', authenticateToken, async (req: any, res) => {
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
        console.error('SERVER ERROR [POST /api/loads]:', error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        connection.release();
    }
});

// Contracts
app.get('/api/contracts/:customerId', authenticateToken, async (req: any, res) => {
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

app.post('/api/contracts', async (req, res) => {
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

// Driver Time Logs
app.post('/api/time-logs', authenticateToken, async (req: any, res) => {
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
        console.error('SERVER ERROR [POST /api/time-logs]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/time-logs/:userId', authenticateToken, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role === 'driver') {
        return res.status(403).json({ error: 'Unauthorized profile access' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM driver_time_logs WHERE user_id = ? ORDER BY clock_in DESC LIMIT 50', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/time-logs]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/time-logs/company/:companyId', authenticateToken, async (req: any, res) => {
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
        console.error('SERVER ERROR [GET /api/time-logs-company]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/dispatch-events/:companyId', authenticateToken, async (req: any, res) => {
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
        console.error('SERVER ERROR [GET /api/dispatch-events]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Compliance Records
app.get('/api/compliance/:userId', authenticateToken, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'safety_manager') {
        return res.status(403).json({ error: 'Unauthorized profile access' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM compliance_records WHERE user_id = ?', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/compliance]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Equipment Registry
app.get('/api/equipment/:companyId', authenticateToken, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'safety_manager') {
        return res.status(403).json({ error: 'Resource unauthorized' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM equipment WHERE company_id = ?', [req.params.companyId]);
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/equipment]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/dispatch-events', async (req, res) => {
    const { id, load_id, dispatcher_id, event_type, message, payload } = req.body;
    try {
        await pool.query(
            'INSERT INTO dispatch_events (id, load_id, dispatcher_id, event_type, message, payload) VALUES (?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), load_id, dispatcher_id, event_type, message, JSON.stringify(payload)]
        );
        res.status(201).json({ message: 'Dispatch event logged' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/dispatch-events]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Specialized Load Update (for Status Triggers)
app.patch('/api/loads/:id/status', async (req, res) => {
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
        console.error('SERVER ERROR [PATCH /api/loads/status]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Operational Messaging
app.get('/api/messages/:loadId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM messages WHERE load_id = ? ORDER BY timestamp ASC', [req.params.loadId]);
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/messages]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/messages', async (req, res) => {
    const { id, load_id, sender_id, sender_name, text, attachments } = req.body;
    try {
        await pool.query(
            'INSERT INTO messages (id, load_id, sender_id, sender_name, text, attachments) VALUES (?, ?, ?, ?, ?, ?)',
            [id || uuidv4(), load_id, sender_id, sender_name, text, JSON.stringify(attachments)]
        );
        res.status(201).json({ message: 'Message sent' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/messages]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Emergency Management: Incidents
app.get('/api/incidents', async (req, res) => {
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

app.post('/api/incidents', async (req, res) => {
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

app.post('/api/incidents/:id/actions', async (req, res) => {
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

app.post('/api/incidents/:id/charges', async (req, res) => {
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

// Party Onboarding / Network Routes
app.get('/api/parties', async (req, res) => {
    try {
        const [parties]: any = await pool.query('SELECT * FROM parties WHERE company_id = ?', [req.query.companyId]);
        const enrichedParties = await Promise.all(parties.map(async (p: any) => {
            const [contacts] = await pool.query('SELECT * FROM party_contacts WHERE party_id = ?', [p.id]);
            const [docs] = await pool.query('SELECT * FROM party_documents WHERE party_id = ?', [p.id]);

            // Unified Engine Fetching
            const [rates]: any = await pool.query(`
                SELECT r.*, t.id as tier_id, t.tier_start, t.tier_end, t.unit_amount as tier_unit_amount, t.base_amount as tier_base_amount
                FROM rate_rows r
                LEFT JOIN rate_tiers t ON r.id = t.rate_row_id
                WHERE r.party_id = ?
            `, [p.id]);

            const groupedRates = rates.reduce((acc: any, row: any) => {
                let r = acc.find((item: any) => item.id === row.id);
                if (!r) {
                    r = {
                        id: row.id,
                        catalogItemId: row.catalog_item_id,
                        variantId: row.variant_id,
                        direction: row.direction,
                        currency: row.currency,
                        priceType: row.price_type,
                        unitType: row.unit_type,
                        baseAmount: row.base_amount,
                        unitAmount: row.unit_amount,
                        minCharge: row.min_charge,
                        maxCharge: row.max_charge,
                        freeUnits: row.free_units,
                        effectiveStart: row.effective_start,
                        effectiveEnd: row.effective_end,
                        taxableFlag: !!row.taxable_flag,
                        roundingRule: row.rounding_rule,
                        notes: row.notes_internal,
                        approvalRequired: !!row.approval_required,
                        tiers: []
                    };
                    acc.push(r);
                }
                if (row.tier_id) {
                    r.tiers.push({
                        id: row.tier_id,
                        rateRowId: row.id,
                        tierStart: row.tier_start,
                        tierEnd: row.tier_end,
                        unitAmount: row.tier_unit_amount,
                        baseAmount: row.tier_base_amount
                    });
                }
                return acc;
            }, []);

            const [constraintSets]: any = await pool.query('SELECT * FROM constraint_sets WHERE party_id = ?', [p.id]);
            const enrichedConstraints = await Promise.all(constraintSets.map(async (cs: any) => {
                const [rules]: any = await pool.query('SELECT * FROM constraint_rules WHERE constraint_set_id = ?', [cs.id]);
                return {
                    id: cs.id,
                    appliesTo: cs.applies_to,
                    priority: cs.priority,
                    status: cs.status,
                    effectiveStart: cs.effective_start,
                    rules: rules.map((r: any) => ({
                        id: r.id,
                        type: r.rule_type,
                        field: r.field_key,
                        operator: r.operator,
                        value: r.value_text,
                        enforcement: r.enforcement,
                        message: r.message
                    }))
                };
            }));

            const [catalogLinks]: any = await pool.query('SELECT catalog_item_id FROM party_catalog_links WHERE party_id = ?', [p.id]);

            return {
                ...p,
                isCustomer: !!p.is_customer,
                isVendor: !!p.is_vendor,
                mcNumber: p.mc_number,
                dotNumber: p.dot_number,
                contacts,
                documents: docs,
                rates: groupedRates,
                constraintSets: enrichedConstraints,
                catalogLinks: catalogLinks.map((cl: any) => cl.catalog_item_id)
            };
        }));
        res.json(enrichedParties);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/parties]:', error);
    }
});

app.post('/api/parties', async (req, res) => {
    const { id, company_id, companyId, tenantId, name, type, status, mcNumber, dotNumber, rating, isCustomer, isVendor, contacts, rates, constraintSets, catalogLinks } = req.body;
    const finalCompanyId = companyId || company_id;
    const finalTenantId = tenantId || 'DEFAULT';
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(
            'REPLACE INTO parties (id, company_id, name, type, is_customer, is_vendor, status, mc_number, dot_number, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, finalCompanyId, name, type, isCustomer, isVendor, status, mcNumber, dotNumber, rating]
        );

        // Contacts
        await connection.query('DELETE FROM party_contacts WHERE party_id = ?', [id]);
        if (contacts) {
            for (const c of contacts) {
                await connection.query(
                    'INSERT INTO party_contacts (id, party_id, name, role, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [c.id || uuidv4(), id, c.name, c.role, c.email, c.phone, c.isPrimary]
                );
            }
        }

        // Unified Rates
        await connection.query('DELETE FROM rate_rows WHERE party_id = ?', [id]);
        if (rates) {
            for (const r of rates) {
                const rid = r.id || uuidv4();
                await connection.query(
                    'INSERT INTO rate_rows (id, tenant_id, party_id, catalog_item_id, variant_id, direction, currency, price_type, unit_type, base_amount, unit_amount, min_charge, max_charge, free_units, effective_start, effective_end, taxable_flag, rounding_rule, notes_internal, approval_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [rid, finalTenantId, id, r.catalogItemId, r.variantId, r.direction, r.currency || 'USD', r.priceType, r.unitType, r.baseAmount, r.unitAmount, r.minCharge, r.maxCharge, r.freeUnits, r.effectiveStart, r.effectiveEnd, r.taxableFlag, r.roundingRule, r.notes, r.approvalRequired]
                );
                if (r.tiers) {
                    for (const t of r.tiers) {
                        await connection.query(
                            'INSERT INTO rate_tiers (id, rate_row_id, tier_start, tier_end, unit_amount, base_amount) VALUES (?, ?, ?, ?, ?, ?)',
                            [uuidv4(), rid, t.tierStart, t.tierEnd, t.unitAmount, t.baseAmount]
                        );
                    }
                }
            }
        }

        // Operational Constraints
        await connection.query('DELETE FROM constraint_sets WHERE party_id = ?', [id]);
        if (constraintSets) {
            for (const cs of constraintSets) {
                const csid = cs.id || uuidv4();
                await connection.query(
                    'INSERT INTO constraint_sets (id, tenant_id, party_id, applies_to, priority, status, effective_start, effective_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [csid, finalTenantId, id, cs.appliesTo, cs.priority, cs.status, cs.effectiveStart, cs.effectiveEnd]
                );
                if (cs.rules) {
                    for (const rule of cs.rules) {
                        await connection.query(
                            'INSERT INTO constraint_rules (id, constraint_set_id, rule_type, field_key, operator, value_text, enforcement, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [uuidv4(), csid, rule.type, rule.field, rule.operator, rule.value, rule.enforcement, rule.message]
                        );
                    }
                }
            }
        }

        // Catalog Links
        await connection.query('DELETE FROM party_catalog_links WHERE party_id = ?', [id]);
        if (catalogLinks) {
            for (const itemId of catalogLinks) {
                await connection.query(
                    'INSERT INTO party_catalog_links (id, party_id, catalog_item_id) VALUES (?, ?, ?)',
                    [uuidv4(), id, itemId]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Party synced with Unified Engine' });
    } catch (error) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/parties]:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    } finally {
        connection.release();
    }
});
// --- UNIFIED FINANCIAL LEDGER ---

// Chart of Accounts
app.get('/api/accounting/accounts', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM gl_accounts WHERE is_active = TRUE ORDER BY account_number ASC');
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/accounting/accounts]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Load P&L (True Profitability Engine)
app.get('/api/accounting/load-pl/:loadId', async (req, res) => {
    try {
        const loadId = req.params.loadId;

        // Fetch revenue vs expense from journal lines allocated to this load
        const [rows]: any = await pool.query(`
            SELECT 
                jl.allocation_id,
                a.name as account_name,
                a.type as account_type,
                SUM(jl.debit) as total_debit,
                SUM(jl.credit) as total_credit
            FROM journal_lines jl
            JOIN gl_accounts a ON jl.gl_account_id = a.id
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE jl.allocation_type = 'Load' AND jl.allocation_id = ?
            GROUP BY jl.gl_account_id, a.name, a.type
        `, [loadId]);

        let revenue = 0;
        let costs = 0;
        const details = rows.map((r: any) => {
            const val = r.account_type === 'Income' ? (r.total_credit - r.total_debit) : (r.total_debit - r.total_credit);
            if (r.account_type === 'Income') revenue += val;
            if (r.account_type === 'Expense') costs += val;
            return {
                account: r.account_name,
                type: r.account_type,
                amount: val
            };
        });

        res.json({
            loadId,
            revenue,
            costs,
            margin: revenue - costs,
            marginPercent: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
            details
        });
    } catch (error) {
        console.error('SERVER ERROR [GET /api/accounting/load-pl]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Journal Entry Posting
app.post('/api/accounting/journal', async (req, res) => {
    const { id, tenantId, entryDate, referenceNumber, description, sourceDocumentType, sourceDocumentId, createdBy, lines } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Post Header
        await connection.query(
            'INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [id, tenantId || 'DEFAULT', entryDate, referenceNumber, description, sourceDocumentType, sourceDocumentId, createdBy]
        );

        // 2. Post Lines
        for (const line of lines) {
            await connection.query(
                'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [line.id || uuidv4(), id, line.glAccountId, line.debit || 0, line.credit || 0, line.allocationType, line.allocationId, line.notes]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Journal entry posted' });
    } catch (error) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/accounting/journal]:', error);
        res.status(500).json({ error: 'Failed to post journal entry' });
    } finally {
        connection.release();
    }
});

// AR Invoices
app.post('/api/accounting/invoices', async (req, res) => {
    const invoice = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Invoice Header
        await connection.query(
            'INSERT INTO ar_invoices (id, tenant_id, customer_id, load_id, invoice_number, invoice_date, due_date, status, total_amount, balance_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [invoice.id, invoice.tenantId, invoice.customerId, invoice.loadId, invoice.invoiceNumber, invoice.invoiceDate, invoice.dueDate, invoice.status, invoice.totalAmount, invoice.totalAmount]
        );

        // 2. Create Invoice Lines (V3)
        if (invoice.lines && Array.isArray(invoice.lines)) {
            for (const line of invoice.lines) {
                await connection.query(
                    'INSERT INTO ar_invoice_lines (id, invoice_id, catalog_item_id, description, quantity, unit_price, total_amount, gl_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [line.id || uuidv4(), invoice.id, line.catalogItemId, line.description, line.quantity || 1, line.unitPrice, line.totalAmount, line.glAccountId]
                );
            }
        }

        // 3. AUTO-POST TO GL (Modified to support itemization)
        const entryId = uuidv4();
        await connection.query(
            'INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [entryId, invoice.tenantId, invoice.invoiceDate, invoice.invoiceNumber, `Invoice ${invoice.invoiceNumber} for Load ${invoice.loadId}`, 'Invoice', invoice.id, 'SYSTEM']
        );

        // Debit AR
        await connection.query(
            'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), entryId, 'GL-1200', invoice.totalAmount, 0, 'Load', invoice.loadId]
        );

        // Credit Revenue (Itemized if lines exist, otherwise generic)
        if (invoice.lines && Array.isArray(invoice.lines)) {
            for (const line of invoice.lines) {
                await connection.query(
                    'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [uuidv4(), entryId, line.glAccountId || 'GL-4000', 0, line.totalAmount, 'Load', invoice.loadId]
                );
            }
        } else {
            await connection.query(
                'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), entryId, 'GL-4000', 0, invoice.totalAmount, 'Load', invoice.loadId]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Invoice created and posted to GL' });
    } catch (error) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/accounting/invoices]:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    } finally {
        connection.release();
    }
});

// AP Bills
app.post('/api/accounting/bills', async (req, res) => {
    const bill = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Bill Header
        await connection.query(
            'INSERT INTO ap_bills (id, tenant_id, vendor_id, bill_number, bill_date, due_date, status, total_amount, balance_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [bill.id, bill.tenantId, bill.vendorId, bill.billNumber, bill.billDate, bill.dueDate, bill.status, bill.totalAmount, bill.totalAmount]
        );

        // 2. Create Bill Lines (V3)
        if (bill.lines && Array.isArray(bill.lines)) {
            for (const line of bill.lines) {
                await connection.query(
                    'INSERT INTO ap_bill_lines (id, bill_id, description, amount, gl_account_id, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [line.id || uuidv4(), bill.id, line.description, line.amount, line.glAccountId, line.allocationType || 'Overhead', line.allocationId]
                );
            }
        }

        // 3. AUTO-POST TO GL (Modified to support itemization)
        const entryId = uuidv4();
        await connection.query(
            'INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [entryId, bill.tenantId, bill.billDate, bill.billNumber, `Bill ${bill.billNumber} from Vendor ${bill.vendorId}`, 'Bill', bill.id, 'SYSTEM']
        );

        // Header post for AP liability (Credit Accounts Payable)
        await connection.query(
            'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), entryId, 'GL-2000', 0, bill.totalAmount]
        );

        // Detail lines post to expenses (Debit Expenses)
        if (bill.lines && Array.isArray(bill.lines)) {
            for (const line of bill.lines) {
                await connection.query(
                    'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [uuidv4(), entryId, line.glAccountId || 'GL-6100', line.amount, 0, line.allocationType, line.allocationId]
                );
            }
        } else {
            // Generic fallback if no lines provided
            await connection.query(
                'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), entryId, 'GL-6100', bill.totalAmount, 0, 'Overhead', null]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Bill created and posted to GL' });
    } catch (error) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/accounting/bills]:', error);
        res.status(500).json({ error: 'Failed to create bill' });
    } finally {
        connection.release();
    }
});

// --- ACCOUNTING V3 EXTENSIONS ---

// AR Invoices List
app.get('/api/accounting/invoices', async (req, res) => {
    try {
        const [rows]: any = await pool.query('SELECT * FROM ar_invoices ORDER BY invoice_date DESC');
        const enriched = await Promise.all(rows.map(async (inv: any) => {
            const [lines] = await pool.query('SELECT * FROM ar_invoice_lines WHERE invoice_id = ?', [inv.id]);
            return { ...inv, lines };
        }));
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// AP Bills List
app.get('/api/accounting/bills', async (req, res) => {
    try {
        const [rows]: any = await pool.query('SELECT * FROM ap_bills ORDER BY bill_date DESC');
        const enriched = await Promise.all(rows.map(async (bill: any) => {
            const [lines] = await pool.query('SELECT * FROM ap_bill_lines WHERE bill_id = ?', [bill.id]);
            return { ...bill, lines };
        }));
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Driver Settlements List
app.get('/api/accounting/settlements', async (req, res) => {
    try {
        const { driverId } = req.query;
        let query = 'SELECT * FROM driver_settlements';
        const params = [];
        if (driverId) {
            query += ' WHERE driver_id = ?';
            params.push(driverId);
        }
        query += ' ORDER BY settlement_date DESC';
        const [rows]: any = await pool.query(query, params);
        const enriched = await Promise.all(rows.map(async (set: any) => {
            const [lines] = await pool.query('SELECT * FROM settlement_lines WHERE settlement_id = ?', [set.id]);
            return { ...set, lines };
        }));
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/accounting/settlements', async (req, res) => {
    const set = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Settlement Header
        await connection.query(
            'INSERT INTO driver_settlements (id, tenant_id, driver_id, settlement_date, period_start, period_end, total_earnings, total_deductions, total_reimbursements, net_pay, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [set.id, set.tenantId, set.driverId, set.settlementDate, set.periodStart, set.periodEnd, set.totalEarnings, set.totalDeductions, set.totalReimbursements, set.netPay, set.status || 'Draft']
        );

        // 2. Create Settlement Lines (V3)
        if (set.lines && Array.isArray(set.lines)) {
            for (const line of set.lines) {
                await connection.query(
                    'INSERT INTO settlement_lines (id, settlement_id, description, amount, load_id, gl_account_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [line.id || uuidv4(), set.id, line.description, line.amount, line.loadId, line.glAccountId, line.type]
                );
            }
        }

        // 3. AUTO-POST TO GL
        const entryId = uuidv4();
        await connection.query(
            'INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type, source_document_id, posted_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [entryId, set.tenantId, set.settlementDate, `SETTLE-${set.id.substring(0, 8)}`, `Settlement for Driver ${set.driverId}`, 'Settlement', set.id, 'SYSTEM']
        );

        // Debit Expenses (Earnings/Reimb), Credit Liabilities (Net Pay), Credit Offsets (Deductions)
        // Net Pay (Credit Liability)
        await connection.query(
            'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), entryId, 'GL-2100', 0, set.netPay]
        );

        if (set.lines && Array.isArray(set.lines)) {
            for (const line of set.lines) {
                if (line.type === 'Earning' || line.type === 'Reimbursement') {
                    // Debit Expense
                    await connection.query(
                        'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [uuidv4(), entryId, line.glAccountId || 'GL-6000', line.amount, 0, 'Driver', set.driverId]
                    );
                } else if (line.type === 'Deduction') {
                    // Credit Offset
                    await connection.query(
                        'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, allocation_type, allocation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [uuidv4(), entryId, line.glAccountId || 'GL-6000', 0, line.amount, 'Driver', set.driverId]
                    );
                }
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Settlement created and posted to GL' });
    } catch (error) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/accounting/settlements]:', error);
        res.status(500).json({ error: 'Failed to create settlement' });
    } finally {
        connection.release();
    }
});

// Document Vault
app.get('/api/accounting/docs', async (req, res) => {
    try {
        const { loadId, driverId, truckId } = req.query;
        let query = 'SELECT * FROM document_vault WHERE 1=1';
        const params = [];
        if (loadId) { query += ' AND load_id = ?'; params.push(loadId); }
        if (driverId) { query += ' AND driver_id = ?'; params.push(driverId); }
        if (truckId) { query += ' AND truck_id = ?'; params.push(truckId); }
        query += ' ORDER BY created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/accounting/docs', async (req, res) => {
    const doc = req.body;
    try {
        await pool.query(
            'INSERT INTO document_vault (id, tenant_id, type, url, filename, load_id, driver_id, truck_id, vendor_id, customer_id, amount, date, state_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [doc.id || uuidv4(), doc.tenantId || 'DEFAULT', doc.type, doc.url, doc.filename, doc.loadId, doc.driverId, doc.truckId, doc.vendorId, doc.customerId, doc.amount, doc.date, doc.stateCode, doc.status || 'Draft']
        );
        res.status(201).json({ message: 'Document archived in vault' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.patch('/api/accounting/docs/:id', async (req, res) => {
    const { status, is_locked } = req.body;
    try {
        await pool.query('UPDATE document_vault SET status = ?, is_locked = ? WHERE id = ?', [status, is_locked, req.params.id]);
        res.json({ message: 'Document status updated' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// IFTA Intelligence & Auditing
app.get('/api/accounting/ifta-evidence/:loadId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM ifta_trip_evidence WHERE load_id = ? ORDER BY timestamp ASC',
            [req.params.loadId]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch evidence' });
    }
});

app.post('/api/accounting/ifta-analyze', async (req, res) => {
    const { pings, mode } = req.body; // mode: 'GPS' | 'ROUTES'

    if (mode === 'GPS') {
        const jurisdictionMiles: any = {};
        for (let i = 1; i < pings.length; i++) {
            const p1 = pings[i - 1];
            const p2 = pings[i];
            const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
            const state = detectState(p2.lat, p2.lng);
            jurisdictionMiles[state] = (jurisdictionMiles[state] || 0) + dist;
        }
        return res.json({ jurisdictionMiles, method: 'ACTUAL_GPS', confidence: 'HIGH' });
    }

    // Tier C logic placeholder (actual Google call would happen here or frontend)
    res.json({ message: 'Routing engine ready' });
});

app.post('/api/accounting/ifta-audit-lock', async (req, res) => {
    const audit = req.body;
    try {
        await pool.query(
            'INSERT INTO ifta_trips_audit (id, truck_id, load_id, trip_date, start_odometer, end_odometer, total_total_miles, method, confidence_level, jurisdiction_miles, status, attested_by, attested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [uuidv4(), audit.truckId, audit.loadId, audit.tripDate, audit.startOdometer, audit.endOdometer, audit.totalMiles, audit.method, audit.confidenceLevel, JSON.stringify(audit.jurisdictionMiles), 'LOCKED', audit.attestedBy]
        );

        // Sync to legacy mileage_jurisdiction for backward compatibility
        for (const state in audit.jurisdictionMiles) {
            await pool.query(
                'INSERT INTO mileage_jurisdiction (id, truck_id, load_id, state_code, miles, date, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), audit.truckId, audit.loadId, state, audit.jurisdictionMiles[state], audit.tripDate, audit.method === 'ACTUAL_GPS' ? 'ELD' : 'Manual']
            );
        }

        res.json({ message: 'Trip locked for audit' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Locking failed' });
    }
});

// IFTA Summary
app.get('/api/accounting/ifta-summary', async (req, res) => {
    try {
        const { quarter, year } = req.query;
        // Mock state tax rates for calculation
        const ST_RATES: any = { 'TX': 0.20, 'OK': 0.19, 'AR': 0.21, 'MO': 0.17, 'KS': 0.24 };

        const [mileageRows]: any = await pool.query(
            'SELECT state_code, SUM(miles) as total_miles FROM mileage_jurisdiction GROUP BY state_code'
        );
        const [fuelRows]: any = await pool.query(
            'SELECT state_code, SUM(gallons) as total_gallons, SUM(total_cost) as total_cost FROM fuel_ledger GROUP BY state_code'
        );

        const rows = mileageRows.map((m: any) => {
            const f = fuelRows.find((fr: any) => fr.state_code === m.state_code) || { total_gallons: 0, total_cost: 0 };
            const taxRate = ST_RATES[m.state_code] || 0.20;
            const taxDue = (m.total_miles / 6) * taxRate; // Rough calc
            return {
                stateCode: m.state_code,
                totalMiles: m.total_miles,
                totalGallons: f.total_gallons,
                taxPaidAtPump: f.total_gallons * taxRate, // Simplified
                taxDue: taxDue
            };
        });

        const totalMiles = rows.reduce((s: number, r: any) => s + r.totalMiles, 0);
        const totalGallons = rows.reduce((s: number, r: any) => s + r.totalGallons, 0);
        const netTaxDue = rows.reduce((s: number, r: any) => s + (r.taxDue - r.taxPaidAtPump), 0);

        res.json({
            quarter,
            year,
            rows,
            totalMiles,
            totalGallons,
            netTaxDue
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/accounting/mileage', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM mileage_jurisdiction ORDER BY entry_date DESC LIMIT 50');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch mileage' });
    }
});

app.post('/api/accounting/mileage', async (req, res) => {
    const { truckId, loadId, date, stateCode, miles, source } = req.body;
    try {
        await pool.query(
            'INSERT INTO mileage_jurisdiction (id, truck_id, load_id, state_code, miles, date, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), truckId, loadId, stateCode, miles, date, source || 'Manual']
        );
        res.status(201).json({ message: 'Mileage logged' });
    } catch (e) {
        console.error('SERVER ERROR [POST /api/accounting/mileage]:', e);
        res.status(500).json({ error: 'Failed to log mileage' });
    }
});

app.post('/api/accounting/ifta-post', async (req, res) => {
    const { quarter, year, netTaxDue } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const entryId = uuidv4();
        await connection.query(
            'INSERT INTO journal_entries (id, tenant_id, entry_date, reference_number, description, source_document_type) VALUES (?, ?, NOW(), ?, ?, ?)',
            [entryId, 'DEFAULT', `IFTA-Q${quarter}-${year}`, `IFTA Tax Liability Q${quarter} ${year}`, 'IFTA_POSTING']
        );
        // Debit IFTA Expense, Credit IFTA Payable
        await connection.query(
            'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), entryId, 'GL-6900', netTaxDue, 0]
        );
        await connection.query(
            'INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), entryId, 'GL-2200', 0, netTaxDue]
        );
        await connection.commit();
        res.json({ message: 'IFTA posted successfully' });
    } catch (e) {
        await connection.rollback();
        res.status(500).json({ error: 'Posting failed' });
    } finally {
        connection.release();
    }
});

// Adjustment Entries (V3)
app.post('/api/accounting/adjustments', async (req, res) => {
    const adj = req.body;
    try {
        await pool.query(
            'INSERT INTO adjustment_entries (id, parent_entity_type, parent_entity_id, reason_code, description, amount_adjustment, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), adj.parentEntityType, adj.parentEntityId, adj.reasonCode, adj.description, adj.amountAdjustment, adj.createdBy]
        );
        res.status(201).json({ message: 'Adjustment recorded' });
    } catch (e) {
        console.error('SERVER ERROR [POST /api/accounting/adjustments]:', e);
        res.status(500).json({ error: 'Failed to record adjustment' });
    }
});


// Batch Imports
app.post('/api/accounting/batch-import', async (req, res) => {
    const { type, data } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const item of data) {
            const id = item.id || uuidv4();
            if (type === 'Fuel') {
                await connection.query(
                    'INSERT INTO fuel_ledger (id, state_code, gallons, total_cost, entry_date, truck_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, item.stateCode, item.gallons, item.totalCost, item.date, item.truckId]
                );
            } else if (type === 'Bills') {
                await connection.query(
                    'INSERT INTO ap_bills (id, bill_number, total_amount, bill_date, status) VALUES (?, ?, ?, ?, ?)',
                    [id, item.billNumber, item.totalAmount, item.billDate, item.status || 'Draft']
                );
            } else if (type === 'Invoices') {
                await connection.query(
                    'INSERT INTO ar_invoices (id, invoice_number, total_amount, invoice_date, status, customer_id, load_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, item.invoiceNumber, item.totalAmount, item.invoiceDate, item.status || 'Draft', item.customerId, item.loadId]
                );
            } else if (type === 'Settlements') {
                await connection.query(
                    'INSERT INTO driver_settlements (id, driver_id, settlement_date, net_pay, status) VALUES (?, ?, ?, ?, ?)',
                    [id, item.driverId, item.settlementDate, item.netPay, item.status || 'Draft']
                );
            }
        }
        await connection.commit();
        res.json({ message: `Successfully imported ${data.length} records` });
    } catch (e) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/accounting/batch-import]:', e);
        res.status(500).json({ error: 'Import failed' });
    } finally {
        connection.release();
    }
});

// QB Sync Placeholder
app.post('/api/accounting/sync-qb', async (req, res) => {
    const { entityType, entityId } = req.body;
    try {
        const syncId = uuidv4();
        await pool.query(
            'INSERT INTO sync_qb_log (id, tenant_id, entity_type, entity_id, status, error_message) VALUES (?, ?, ?, ?, ?, ?)',
            [syncId, 'DEFAULT', entityType, entityId, 'Pending', null]
        );
        // In a real scenario, we would trigger the QB SDK/API here
        res.json({ message: 'Sync queued', syncId });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Exception Management
app.get('/api/exceptions', async (req, res) => {
    try {
        const { status, type, severity, entityType, entityId, ownerId } = req.query;
        let query = 'SELECT * FROM exceptions WHERE 1=1';
        const params = [];
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

app.post('/api/exceptions', async (req, res) => {
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

app.patch('/api/exceptions/:id', async (req, res) => {
    const { id } = req.params;
    const { status, ownerUserId, workflowStep, severity, notes, actorName } = req.body;
    try {
        const [old]: any = await pool.query('SELECT * FROM exceptions WHERE id = ?', [id]);
        if (old.length === 0) return res.status(404).json({ error: 'Not found' });

        let query = 'UPDATE exceptions SET updated_at = CURRENT_TIMESTAMP';
        const params = [];
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

app.get('/api/exceptions/:id/events', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM exception_events WHERE exception_id = ? ORDER BY timestamp DESC', [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/exception-types', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM exception_type ORDER BY display_name ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/dashboard/cards', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM dashboard_card ORDER BY sort_order ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});


// GLOBAL SEARCH ENGINE (360 Degree Intelligence)
app.get('/api/global-search', authenticateToken, async (req: any, res) => {
    const { query } = req.query;
    const companyId = req.user.companyId;

    if (!query || query.length < 2) return res.json([]);
    const q = `%${query}%`;
    const results: any[] = [];

    try {
        // 1. Search Loads (MySQL)
        const [loadRows]: any = await pool.query(
            'SELECT id, load_number, status, pickup_date FROM loads WHERE company_id = ? AND (load_number LIKE ? OR container_number LIKE ? OR bol_number LIKE ?)',
            [companyId, q, q, q]
        );
        loadRows.forEach((l: any) => {
            results.push({
                id: l.id,
                type: 'LOAD',
                label: `Load #${l.load_number}`,
                subLabel: `Status: ${l.status} | Date: ${l.pickup_date || 'N/A'}`,
                status: l.status,
                chips: [{ label: l.status, color: 'blue' }]
            });
        });

        // 2. Search Customers (MySQL)
        const [customerRows]: any = await pool.query(
            'SELECT id, name, type, mc_number FROM customers WHERE company_id = ? AND (name LIKE ? OR mc_number LIKE ? OR email LIKE ?)',
            [companyId, q, q, q]
        );
        customerRows.forEach((c: any) => {
            results.push({
                id: c.id,
                type: 'BROKER',
                label: c.name,
                subLabel: `${c.type} | MC: ${c.mc_number || 'N/A'}`,
                chips: [{ label: c.type, color: 'purple' }]
            });
        });

        // 3. Search Users (Firestore)
        const userSnapshot = await db.collection('users')
            .where('company_id', '==', companyId)
            .get();

        userSnapshot.docs.forEach(doc => {
            const u = doc.data();
            if (u.name?.toLowerCase().includes(query.toLowerCase()) || u.email?.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    id: u.id,
                    type: u.role === 'driver' ? 'DRIVER' : 'USER',
                    label: u.name,
                    subLabel: `${u.role.toUpperCase()} | ${u.email}`,
                    chips: [{ label: u.role, color: 'green' }]
                });
            }
        });

        // 4. Search Quotes (MySQL)
        const [quoteRows]: any = await pool.query(
            'SELECT id, pickup_city, dropoff_city, status FROM quotes WHERE company_id = ? AND (id LIKE ? OR pickup_city LIKE ? OR dropoff_city LIKE ?)',
            [companyId, q, q, q]
        );
        quoteRows.forEach((q: any) => {
            results.push({
                id: q.id,
                type: 'QUOTE',
                label: `Quote #${q.id.slice(0, 8)}`,
                subLabel: `${q.pickup_city} -> ${q.dropoff_city}`,
                status: q.status,
                chips: [{ label: 'Quote', color: 'orange' }]
            });
        });

        res.json(results.slice(0, 20));
    } catch (error) {
        console.error('SEARCH ERROR:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.listen(port, () => {

    console.log(`Server running on port ${port}`);
});
