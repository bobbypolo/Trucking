
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');
const bcrypt = require('bcryptjs');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const SEED_COMPANY_ID = 'iscope-authority-001';

async function seed() {
    console.log('🚀 Seeding Firestore for LoadPilot...');

    try {
        // 1. Seed Company
        console.log('Inserting Company...');
        await db.collection('companies').doc(SEED_COMPANY_ID).set({
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
        });

        // 2. Seed Admin User
        console.log('Inserting Admin User...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.collection('users').doc('admin-root-001').set({
            id: 'admin-root-001',
            company_id: SEED_COMPANY_ID,
            email: 'admin@loadpilot.com',
            password: hashedPassword,
            name: 'Authority Admin',
            role: 'admin',
            onboarding_status: 'Completed',
            safety_score: 100,
            createdAt: new Date().toISOString()
        });

        // 3. Seed "fused_finance" for verification
        console.log('Inserting Finance User...');
        await db.collection('users').doc('fused-finance-001').set({
            id: 'fused-finance-001',
            company_id: SEED_COMPANY_ID,
            email: 'fused_finance@kci.com',
            password: hashedPassword,
            name: 'Fused Finance',
            role: 'FINANCE',
            onboarding_status: 'Completed',
            safety_score: 100,
            createdAt: new Date().toISOString()
        });

        console.log('✅ Firestore Seeding Completed Successfully.');
    } catch (e) {
        console.error('❌ Seeding Failed:', e.message);
    }
}

seed();
