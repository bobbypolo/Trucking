
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

console.log('Project ID in Service Account:', serviceAccount.project_id);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkBilling() {
    console.log('Attempting to write to Firestore to verify billing/permissions...');
    try {
        const testRef = db.collection('billing_test').doc('test');
        await testRef.set({
            timestamp: new Date().toISOString(),
            status: 'billing check'
        });
        console.log('✅ Success! Write operation completed. Billing appears to be enabled.');
    } catch (error) {
        console.error('❌ Failed:', error.code, error.message);
        if (error.message.includes('billing')) {
            console.log('\n--- ACTION REQUIRED ---');
            console.log(`Please enable billing here: https://console.developers.google.com/billing/enable?project=${serviceAccount.project_id}`);
            console.log('-----------------------');
        }
    }
}

checkBilling();
