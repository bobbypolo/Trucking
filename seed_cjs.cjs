
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './server/.env' });

const SEED_COMPANY_ID = 'iscope-authority-001';

async function seed() {
    console.log('Starting Server DB Seeding (CJS)...');
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'trucklogix'
        });

        // 1. Seed Company
        console.log('Inserting Company...');
        await connection.query(
            'INSERT IGNORE INTO companies (id, name, account_type, email, address, city, state, zip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [SEED_COMPANY_ID, 'iScope Logistics', 'fleet', 'admin@kci-authority.com', '100 Carrier Way', 'Chicago', 'IL', '60601']
        );

        // 2. Seed Admin User
        console.log('Inserting Admin User...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status, safety_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), SEED_COMPANY_ID, 'admin@kci-authority.com', hashedPassword, 'Authority Admin', 'admin', 'Completed', 100]
        );

        console.log('✅ Server DB Seeded Successfully.');
        await connection.end();
    } catch (err) {
        console.error('❌ Seeding Failed:', err.message);
    }
}

seed();
