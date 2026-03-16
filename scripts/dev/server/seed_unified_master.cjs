
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
require('dotenv').config({ path: './server/.env' });

// Initialize Firebase Admin
let serviceAccount;
try {
    serviceAccount = require('./server/serviceAccount.json');
} catch (e) {
    serviceAccount = require('./serviceAccount.json');
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix'
    });

    const COMPANY_ID = 'iscope-authority-001';

    // User IDs
    const DISPATCHER_ID = 'disp-001';
    const PAYROLL_ID = 'pay-001';
    const DRIVER_1_ID = 'drv-001';
    const DRIVER_2_ID = 'drv-002';

    // Customer IDs
    const CUST_IDS = ['cust-001', 'cust-002', 'cust-003', 'cust-004'];

    console.log('--- STARTING UNIFIED MASTER SEEDING (MySQL + Firestore) ---');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Ensure Company exists
        await connection.query(
            'REPLACE INTO companies (id, name, account_type, subscription_status) VALUES (?, ?, ?, ?)',
            [COMPANY_ID, 'KCI TruckLogix Pro', 'fleet', 'active']
        );

        const users = [
            { id: DISPATCHER_ID, email: 'dispatcher@loadpilot.com', name: 'Sarah Dispatcher', role: 'dispatcher' },
            { id: PAYROLL_ID, email: 'payroll@loadpilot.com', name: 'Michael Payroll', role: 'payroll_manager' },
            { id: DRIVER_1_ID, email: 'driver1@loadpilot.com', name: 'John Roadrunner', role: 'driver', safety_score: 98 },
            { id: DRIVER_2_ID, email: 'driver2@loadpilot.com', name: 'Alex Trucker', role: 'driver', safety_score: 95 }
        ];

        for (const u of users) {
            // MySQL
            await connection.query(
                'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status, safety_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [u.id, COMPANY_ID, u.email, hashedPassword, u.name, u.role, 'Completed', u.safety_score || 100]
            );

            // Firestore
            await db.collection('users').doc(u.id).set({
                id: u.id,
                company_id: COMPANY_ID,
                email: u.email,
                name: u.name,
                role: u.role,
                onboarding_status: 'Completed',
                safety_score: u.safety_score || 100,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Firebase Auth (ensure account exists)
            try {
                await admin.auth().createUser({
                    uid: u.id,
                    email: u.email,
                    password: 'admin123',
                    displayName: u.name
                });
                console.log(`✔ Created Auth account for ${u.email}`);
            } catch (e) {
                if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
                    console.log(`ℹ Auth account for ${u.email} already exists`);
                } else {
                    console.error(`✗ Auth error for ${u.email}:`, e.message);
                }
            }
        }

        // 2. Create 4 Customers
        const customers = [
            { id: CUST_IDS[0], name: 'Global Retail Corp', type: 'Direct Customer', email: 'logistics@globalretail.com' },
            { id: CUST_IDS[1], name: 'Swift Manufacturing', type: 'Direct Customer', email: 'shipping@swiftmfg.com' },
            { id: CUST_IDS[2], name: 'Blue Sky Beverages', type: 'Broker', email: 'dispatch@bluesky.com' },
            { id: CUST_IDS[3], name: 'Apex Electronics', type: 'Direct Customer', email: 'ops@apexel.com' }
        ];

        for (const cust of customers) {
            await connection.query(
                'REPLACE INTO customers (id, company_id, name, type, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [cust.id, COMPANY_ID, cust.name, cust.type, cust.email, '555-0100', '123 Industry Way, Chicago, IL']
            );

            const leadId = `lead-${cust.id}`;
            const quoteId = `quote-${cust.id}`;
            await connection.query('REPLACE INTO leads (id, company_id, customer_name, caller_name, caller_email) VALUES (?, ?, ?, ?, ?)', [leadId, COMPANY_ID, cust.name, 'Jim Contact', cust.email]);
            await connection.query('REPLACE INTO quotes (id, lead_id, company_id, status, pickup_city, dropoff_city, total_rate, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [quoteId, leadId, COMPANY_ID, 'Accepted', 'Chicago, IL', 'Dallas, TX', 2800.00, DISPATCHER_ID]);
        }

        // 3. Create 2 Active Loads
        const activeLoads = [
            { id: 'load-active-001', num: 'LP-ACT-101', status: 'Active', driver: DRIVER_1_ID, cust: CUST_IDS[0] },
            { id: 'load-active-002', num: 'LP-ACT-102', status: 'Active', driver: DRIVER_2_ID, cust: CUST_IDS[1] }
        ];

        for (const load of activeLoads) {
            await connection.query(
                'REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, pickup_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [load.id, COMPANY_ID, load.cust, load.driver, DISPATCHER_ID, load.num, load.status, 3200.00, '2026-01-15']
            );
        }

        // 4. Create 4 Completed Loads
        const completedLoads = [
            { id: 'load-done-001', num: 'LP-DONE-201', cust: CUST_IDS[0], driver: DRIVER_1_ID },
            { id: 'load-done-002', num: 'LP-DONE-202', cust: CUST_IDS[1], driver: DRIVER_2_ID },
            { id: 'load-done-003', num: 'LP-DONE-203', cust: CUST_IDS[2], driver: DRIVER_1_ID },
            { id: 'load-done-004', num: 'LP-DONE-204', cust: CUST_IDS[3], driver: DRIVER_2_ID }
        ];

        for (const load of completedLoads) {
            await connection.query(
                'REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, pickup_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [load.id, COMPANY_ID, load.cust, load.driver, DISPATCHER_ID, load.num, 'Delivered', 2450.00, '2026-01-10']
            );
        }

        console.log('✔ Unified Master Seeding Complete');

    } catch (e) {
        console.error('❌ SEEDING FAILED:', e);
    } finally {
        await connection.end();
    }
}

seed();
