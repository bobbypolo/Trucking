
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './server/.env' });

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix'
    });

    const COMPANY_ID = 'iscope-authority-001';
    const DRIVER_ID = 'driver-001';
    const TEST_LOAD_ID = 'load-full-flow-001';
    const TEST_CUST_ID = 'cust-full-flow-001';
    const TRUCK_ID = 'truck-full-flow-001';

    console.log('--- STARTING FULL FLOW MOCK DATA GENERATION ---');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Create Driver
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [DRIVER_ID, COMPANY_ID, 'driver@loadpilot.com', hashedPassword, 'John Driver', 'driver', 'Completed']
        );
        console.log('✔ Driver Created');

        // 2. Create Equipment
        await connection.query(
            'REPLACE INTO equipment (id, company_id, unit_number, type, status, ownership_type) VALUES (?, ?, ?, ?, ?, ?)',
            [TRUCK_ID, COMPANY_ID, '101', 'Truck', 'Active', 'Company']
        );
        console.log('✔ Equipment Created');

        // 3. Create Customer
        await connection.query(
            'REPLACE INTO customers (id, company_id, name, type, email, phone, address, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [TEST_CUST_ID, COMPANY_ID, 'Big Tech Logistics', 'Direct Customer', 'billing@bigtech.com', '555-0100', '1 Infinite Loop, Cupertino, CA', 'Net 30']
        );
        console.log('✔ Customer Created');

        // 4. Create Load
        await connection.query(
            'REPLACE INTO loads (id, company_id, customer_id, driver_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [TEST_LOAD_ID, COMPANY_ID, TEST_CUST_ID, DRIVER_ID, 'LP-FLOW-001', 'Delivered', 2500.00, 750.00, '2026-01-05', 'General']
        );
        console.log('✔ Load Created');

        // 5. Create Load Leg
        await connection.query(
            'REPLACE INTO load_legs (id, load_id, sequence_order, type, facility_name, city, state) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['leg-001', TEST_LOAD_ID, 1, 'Pickup', 'Chicago Warehouse', 'Chicago', 'IL']
        );
        await connection.query(
            'REPLACE INTO load_legs (id, load_id, sequence_order, type, facility_name, city, state) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['leg-002', TEST_LOAD_ID, 2, 'Dropoff', 'NY Distribution', 'Jersey City', 'NJ']
        );
        console.log('✔ Load Legs Created');

        // 6. Create Safety Incident
        await connection.query(
            'REPLACE INTO incidents (id, load_id, type, severity, description, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['incident-001', TEST_LOAD_ID, 'Accident', 'Low', 'Driver reported minor yard damage at receiver.', 'Closed']
        );
        console.log('✔ Safety Incident Created');

        // 7. Create Settlement
        const SETTLEMENT_ID = 'settlement-001';
        await connection.query(
            'REPLACE INTO driver_settlements (id, tenant_id, driver_id, status, total_earnings, total_deductions, net_pay, period_start, period_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [SETTLEMENT_ID, COMPANY_ID, DRIVER_ID, 'Draft', 750.00, 50.00, 700.00, '2026-01-01', '2026-01-07']
        );

        await connection.query(
            'REPLACE INTO settlement_lines (id, settlement_id, type, description, amount, load_id) VALUES (?, ?, ?, ?, ?, ?)',
            ['line-001', SETTLEMENT_ID, 'Earning', 'Linehaul - LP-FLOW-001', 750.00, TEST_LOAD_ID]
        );
        await connection.query(
            'REPLACE INTO settlement_lines (id, settlement_id, type, description, amount) VALUES (?, ?, ?, ?, ?)',
            ['line-002', SETTLEMENT_ID, 'Deduction', 'Admin Fee', 50.00]
        );
        console.log('✔ Settlement & Lines Created');

        // 8. Documents
        await connection.query(
            'REPLACE INTO document_vault (id, tenant_id, type, load_id, driver_id, filename, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['doc-001', COMPANY_ID, 'BOL', TEST_LOAD_ID, DRIVER_ID, 'BOL_FLOW_001.pdf', 'Approved']
        );
        console.log('✔ Documents Synced');

        // --- EXPOSE FRAGILE SYSTEMS (VALID DB, BAD LOGIC) ---
        console.log('\n--- INSERTING FRAGILE DATA (TO EXPOSE BUGS) ---');

        // 9. Fragile Load (Cancelled but with Earnings)
        const FRAGILE_LOAD_ID = 'load-fragile-001';
        await connection.query(
            'REPLACE INTO loads (id, company_id, customer_id, driver_id, load_number, status, carrier_rate) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [FRAGILE_LOAD_ID, COMPANY_ID, TEST_CUST_ID, DRIVER_ID, 'LP-FRAGILE-001', 'Cancelled', 0.00]
        );

        // 10. Logical Orphan (Incident on a Cancelled Load)
        await connection.query(
            'REPLACE INTO incidents (id, load_id, type, severity, description, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['incident-cancelled-load', FRAGILE_LOAD_ID, 'HOS Risk', 'Critical', 'Incident on a cancelled load.', 'Open']
        );
        console.log('⚠ Incident on Cancelled Load Created');

        // 11. Empty Settlement (No monetary value)
        await connection.query(
            'REPLACE INTO driver_settlements (id, tenant_id, driver_id, status, total_earnings, net_pay) VALUES (?, ?, ?, ?, ?, ?)',
            ['settlement-empty-001', COMPANY_ID, DRIVER_ID, 'Draft', 0, 0]
        );
        console.log('⚠ Empty Settlement Created');

        console.log('\n--- FULL FLOW MOCK DATA COMPLETE ---');

    } catch (e) {
        console.error('❌ MOCK GENERATION FAILED:', e.message);
    } finally {
        await connection.end();
    }
}

seed();
