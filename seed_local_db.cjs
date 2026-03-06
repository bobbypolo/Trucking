
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, 'server/local_db.json');
const SEED_COMPANY_ID = 'iscope-authority-001';

async function seed() {
    console.log('🚀 Seeding Local JSON Database for LoadPilot...');
    console.log('DB Path:', DB_FILE);

    // Initial State
    const db = {
        users: {},
        companies: {}
    };

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Seed Company
        db.companies[SEED_COMPANY_ID] = {
            id: SEED_COMPANY_ID,
            name: 'iScope Logistics',
            account_type: 'fleet',
            email: 'admin@kci-authority.com',
            address: '100 Carrier Way',
            city: 'Chicago',
            state: 'IL',
            zip: '60601',
            subscription_status: 'active',
            updatedAt: new Date().toISOString()
        };

        // 2. Seed Admin User
        db.users['admin-root-001'] = {
            id: 'admin-root-001',
            company_id: SEED_COMPANY_ID,
            email: 'admin@loadpilot.com',
            password: hashedPassword,
            name: 'Authority Admin',
            role: 'admin',
            onboarding_status: 'Completed',
            safety_score: 100,
            createdAt: new Date().toISOString()
        };

        // 3. Seed Finance User for completeness
        db.users['fused-finance-001'] = {
            id: 'fused-finance-001',
            company_id: SEED_COMPANY_ID,
            email: 'fused_finance@kci.com',
            password: hashedPassword,
            name: 'Fused Finance',
            role: 'FINANCE',
            onboarding_status: 'Completed',
            safety_score: 100,
            createdAt: new Date().toISOString()
        };

        // Write to file
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('✅ Local Database Seeded Successfully.');

    } catch (e) {
        console.error('❌ Seeding Failed:', e.message);
    }
}

seed();
