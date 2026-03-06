/**
 * Firebase Authentication Seeding Script
 * Creates all LoadPilot users in Firebase Authentication
 * Run with: node server/seed_firebase_auth.cjs
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

let serviceAccount;
try {
    serviceAccount = require('./serviceAccount.json');
} catch (e) {
    console.error('ERROR: Firebase Service Account not found at server/serviceAccount.json');
    console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const SEED_COMPANY_ID = "iscope-authority-001";

// All users to seed into Firebase Auth
const USERS_TO_SEED = [
    // Admin & Management
    { email: 'admin@loadpilot.com', password: 'admin123', name: 'Authority Admin', role: 'admin' },
    { email: 'architect@loadpilot.com', password: 'admin123', name: 'System Architect', role: 'ORG_OWNER_SUPER_ADMIN' },
    { email: 'opsmanager@loadpilot.com', password: 'admin123', name: 'Operations Manager', role: 'OPS_MANAGER' },

    // Dispatch & Operations
    { email: 'dispatch@loadpilot.com', password: 'dispatch123', name: 'Dispatch Lead', role: 'DISPATCHER' },
    { email: 'fused_ops@kci.com', password: 'admin123', name: 'Fused Operations', role: 'OPS' },

    // Accounting & Finance
    { email: 'ar@loadpilot.com', password: 'admin123', name: 'AR Specialist', role: 'ACCOUNTING_AR' },
    { email: 'ap@loadpilot.com', password: 'admin123', name: 'AP Clerk', role: 'ACCOUNTING_AP' },
    { email: 'payroll@loadpilot.com', password: 'payroll123', name: 'Payroll Controller', role: 'PAYROLL_SETTLEMENTS' },
    { email: 'fused_finance@kci.com', password: 'admin123', name: 'Fused Finance', role: 'FINANCE' },

    // Safety & Maintenance
    { email: 'safety@loadpilot.com', password: 'safety123', name: 'Safety Director', role: 'SAFETY_COMPLIANCE' },
    { email: 'maint@loadpilot.com', password: 'admin123', name: 'Maintenance Lead', role: 'MAINTENANCE_MANAGER' },

    // Fleet & Owner Operators
    { email: 'fleetowner@kci.com', password: 'fleet123', name: 'Master Fleet Owner', role: 'FLEET_OO_ADMIN_PORTAL' },
    { email: 'operator1@gmail.com', password: 'admin123', name: 'Owner Op 1', role: 'owner_operator' },
    { email: 'operator2@gmail.com', password: 'admin123', name: 'Owner Op 2', role: 'owner_operator' },

    // Small Business
    { email: 'smallbiz@kci.com', password: 'admin123', name: 'Small Team Owner', role: 'OWNER_ADMIN' },

    // Drivers
    { email: 'driver1@loadpilot.com', password: 'driver123', name: 'Marcus Rodriguez', role: 'driver' },
    { email: 'driver2@loadpilot.com', password: 'driver123', name: 'Sarah Chen', role: 'driver' },
    { email: 'driver3@loadpilot.com', password: 'driver123', name: 'David Thompson', role: 'driver' },
    { email: 'driver4@loadpilot.com', password: 'driver123', name: 'Elena Garcia', role: 'driver' },
    { email: 'driver5@loadpilot.com', password: 'driver123', name: 'James Wilson', role: 'driver' },

    // Customer
    { email: 'customer@gmail.com', password: 'admin123', name: 'Global Logistics Partner', role: 'customer' }
];

async function seedFirebaseAuth() {
    console.log('🔥 Starting Firebase Authentication Seeding...\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of USERS_TO_SEED) {
        try {
            // Check if user already exists
            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(user.email);
                console.log(`✓ User exists: ${user.email} (${userRecord.uid})`);

                // Update display name if needed
                if (userRecord.displayName !== user.name) {
                    await admin.auth().updateUser(userRecord.uid, {
                        displayName: user.name
                    });
                    console.log(`  ↳ Updated display name to: ${user.name}`);
                    updated++;
                } else {
                    skipped++;
                }
            } catch (error) {
                // User doesn't exist, create them
                if (error.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email: user.email,
                        password: user.password,
                        displayName: user.name,
                        emailVerified: true
                    });
                    console.log(`✓ Created user: ${user.email} (${userRecord.uid})`);
                    created++;

                    // Also create Firestore user record
                    const db = admin.firestore();
                    await db.collection('users').doc(userRecord.uid).set({
                        id: userRecord.uid,
                        company_id: SEED_COMPANY_ID,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        onboarding_status: 'Completed',
                        safety_score: 100,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`  ↳ Created Firestore user record`);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error(`✗ Error processing ${user.email}:`, error.message);
            errors++;
        }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${USERS_TO_SEED.length}`);

    if (errors === 0) {
        console.log('\n✅ Firebase Authentication seeding completed successfully!');
    } else {
        console.log('\n⚠️  Firebase Authentication seeding completed with errors.');
    }
}

// Run the seeding
seedFirebaseAuth()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
