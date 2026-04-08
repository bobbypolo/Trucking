
import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

console.log('--- Firebase Admin Verification ---');

const serviceAccountPath = path.resolve(__dirname, 'serviceAccount.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: serviceAccount.json not found at:', serviceAccountPath);
    console.log('Please download your service account key from the Firebase Console:');
    console.log('Project Settings -> Service Accounts -> Generate new private key');
    process.exit(1);
}

try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ SUCCESS: Firebase Admin initialized successfully.');
    console.log('Project ID:', serviceAccount.project_id);
} catch (error: unknown) {
    console.error('❌ ERROR: Failed to initialize Firebase Admin:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
