
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');
const bcrypt = require('bcryptjs');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://gen-lang-client-0535844903-default-rtdb.firebaseio.com" // Guessed URL pattern
    });
}

const db = admin.database();

const SEED_COMPANY_ID = 'iscope-authority-001';

async function seed() {
    console.log('🚀 Seeding Realtime Database for LoadPilot...');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await db.ref('companies/' + SEED_COMPANY_ID).set({
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

        await db.ref('users/admin-root-001').set({
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

        console.log('✅ Realtime Database Seeding Completed Successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Seeding Failed:', e.message);
        process.exit(1);
    }
}

seed();
