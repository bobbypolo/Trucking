
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

    const SEED_COMPANY_ID = 'iscope-authority-001';
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const users = [
        { id: 'admin-001', email: 'admin@kci-authority.com', name: 'Authority Admin', role: 'admin' },
        { id: 'admin-loadpilot', email: 'admin@loadpilot.com', name: 'Authority Admin', role: 'admin' },
        { id: 'dispatch-loadpilot', email: 'dispatch@loadpilot.com', name: 'Dispatch Lead', role: 'dispatcher' },
        { id: 'fused-ops', email: 'fused_ops@kci.com', name: 'Fused Operations', role: 'dispatcher' },
        { id: 'fused-finance', email: 'fused_finance@kci.com', name: 'Fused Finance', role: 'payroll_manager' }
    ];

    console.log('Seeding/Updating users with hashed passwords...');

    for (const u of users) {
        try {
            await connection.query(
                'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [u.id, SEED_COMPANY_ID, u.email, hashedPassword, u.name, u.role, 'Completed']
            );
            console.log(`Synced & Hashed: ${u.email}`);
        } catch (e) {
            console.error(`Failed to sync ${u.email}:`, e.message);
        }
    }

    await connection.end();
    console.log('Sync complete.');
}

seed();
