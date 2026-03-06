import pool from './server/db.ts';
import { v4 as uuidv4 } from 'uuid';

const SEED_COMPANY_ID = 'iscope-authority-001';

async function seed() {
    console.log('Starting Server DB Seeding...');
    try {
        // Seed Company
        await pool.query(
            'INSERT IGNORE INTO companies (id, name, account_type, email, address, city, state, zip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [SEED_COMPANY_ID, 'iScope Logistics', 'fleet', 'admin@kci-authority.com', '100 Carrier Way', 'Chicago', 'IL', '60601']
        );

        // Seed Admin User
        await pool.query(
            'INSERT IGNORE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), SEED_COMPANY_ID, 'admin@kci-authority.com', 'admin123', 'Authority Admin', 'admin', 'Completed']
        );

        // Seed some loads
        const loadId = uuidv4();
        await pool.query(
            'INSERT IGNORE INTO loads (id, company_id, load_number, status, carrier_rate, driver_pay, pickup_date, freight_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [loadId, SEED_COMPANY_ID, 'KCI-1001', 'Active', 2500, 1800, '2025-12-30', 'Intermodal']
        );

        // Seed Legs
        await pool.query(
            'INSERT IGNORE INTO load_legs (id, load_id, type, facility_name, city, state, sequence_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), loadId, 'Pickup', 'KCI Terminal', 'Chicago', 'IL', 0]
        );
        await pool.query(
            'INSERT IGNORE INTO load_legs (id, load_id, type, facility_name, city, state, sequence_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), loadId, 'Dropoff', 'Global Port', 'Los Angeles', 'CA', 1]
        );

        console.log('Server DB Seeded Successfully.');
    } catch (err) {
        console.error('Seeding Failed:', err);
    } finally {
        process.exit();
    }
}

seed();
