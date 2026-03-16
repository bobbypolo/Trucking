
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './server/.env' });

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

    console.log('--- STARTING COMPREHENSIVE FLOW SEEDING ---');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Ensure Company exists
        await connection.query(
            'REPLACE INTO companies (id, name, account_type, subscription_status) VALUES (?, ?, ?, ?)',
            [COMPANY_ID, 'KCI TruckLogix Pro', 'fleet', 'active']
        );

        // 2. Create Dispatcher
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [DISPATCHER_ID, COMPANY_ID, 'dispatcher@loadpilot.com', hashedPassword, 'Sarah Dispatcher', 'dispatcher', 'Completed']
        );

        // 3. Create Payroll
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [PAYROLL_ID, COMPANY_ID, 'payroll@loadpilot.com', hashedPassword, 'Michael Payroll', 'payroll_manager', 'Completed']
        );

        // 4. Create Drivers
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status, safety_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [DRIVER_1_ID, COMPANY_ID, 'driver1@loadpilot.com', hashedPassword, 'John Roadrunner', 'driver', 'Completed', 98]
        );
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status, safety_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [DRIVER_2_ID, COMPANY_ID, 'driver2@loadpilot.com', hashedPassword, 'Alex Trucker', 'driver', 'Completed', 95]
        );

        // 5. Create Equipment
        await connection.query(
            'REPLACE INTO equipment (id, company_id, unit_number, type, status) VALUES (?, ?, ?, ?, ?)',
            ['trn-101', COMPANY_ID, 'TR-101', 'Truck', 'Active']
        );
        await connection.query(
            'REPLACE INTO equipment (id, company_id, unit_number, type, status) VALUES (?, ?, ?, ?, ?)',
            ['trn-102', COMPANY_ID, 'TR-102', 'Truck', 'Active']
        );

        // 6. Create 4 Customers (Simulating conversion from Quote)
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

            // Seed a Lead and Quote for each to show history
            const leadId = `lead-${cust.id}`;
            const quoteId = `quote-${cust.id}`;
            await connection.query(
                'REPLACE INTO leads (id, company_id, customer_name, caller_name, caller_email) VALUES (?, ?, ?, ?, ?)',
                [leadId, COMPANY_ID, cust.name, 'Jim Contact', cust.email]
            );
            await connection.query(
                'REPLACE INTO quotes (id, lead_id, company_id, status, pickup_city, dropoff_city, total_rate, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [quoteId, leadId, COMPANY_ID, 'Accepted', 'Chicago, IL', 'Dallas, TX', 2800.00, DISPATCHER_ID]
            );
        }

        // 7. Create 2 Active Loads
        const activeLoads = [
            { id: 'load-active-001', num: 'LP-ACT-101', status: 'Active', driver: DRIVER_1_ID, cust: CUST_IDS[0] },
            { id: 'load-active-002', num: 'LP-ACT-102', status: 'Active', driver: DRIVER_2_ID, cust: CUST_IDS[1] }
        ];

        for (const load of activeLoads) {
            await connection.query(
                'REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, pickup_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [load.id, COMPANY_ID, load.cust, load.driver, DISPATCHER_ID, load.num, load.status, 3200.00, '2026-01-15']
            );
            // Add legs
            await connection.query('REPLACE INTO load_legs (id, load_id, type, city, state, sequence_order) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), load.id, 'Pickup', 'Chicago', 'IL', 1]);
            await connection.query('REPLACE INTO load_legs (id, load_id, type, city, state, sequence_order) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), load.id, 'Dropoff', 'Los Angeles', 'CA', 2]);
        }

        // 8. Create 4 Completed Loads
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

        // 9. Add some Triage Items (Work Items & Incidents)
        await connection.query(
            'REPLACE INTO work_items (id, company_id, type, priority, label, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['wi-001', COMPANY_ID, 'QUOTE_FOLLOWUP', 'High', 'Follow up on Quote #quote-cust-003', 'Open']
        );
        await connection.query(
            'REPLACE INTO incidents (id, load_id, type, severity, status, description) VALUES (?, ?, ?, ?, ?, ?)',
            ['inc-active-101', 'load-active-001', 'Reefer Temp', 'High', 'Open', 'Temperature spike detected in trailer.']
        );

        console.log('✔ Comprehensive Flow Data Seeded Successfully');

    } catch (e) {
        console.error('❌ SEEDING FAILED:', e);
    } finally {
        await connection.end();
    }
}

seed();
