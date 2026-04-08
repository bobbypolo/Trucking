
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { logger } from './lib/logger';
import { resolveSqlPrincipalByFirebaseUid } from './lib/sql-auth';

dotenv.config();

// To secure the backend, you must:
// 1. Go to Firebase Console -> Project Settings -> Service Accounts
// 2. Click "Generate new private key"
// 3. Save the JSON file as 'server/serviceAccount.json' (DO NOT COMMIT THIS FILE)

let authReady = false;
let serviceAccount: any;

function loadInlineServiceAccount(): any | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw || raw.trim() === "") {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        logger.error({ err: error }, "FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
        return null;
    }
}

function hasCertFields(candidate: any): boolean {
    return Boolean(
        candidate?.project_id &&
        candidate?.client_email &&
        candidate?.private_key
    );
}

serviceAccount = loadInlineServiceAccount();

try {
    if (!serviceAccount) {
        serviceAccount = require('./serviceAccount.json');
    }
} catch (_e) {
    logger.warn('Firebase Service Account not found at server/serviceAccount.json. Falling back to environment/application credentials if available.');
}

try {
    if (hasCertFields(serviceAccount)) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });
        authReady = true;
        logger.info('Firebase Admin initialized successfully from service account credentials.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID,
        });
        authReady = true;
        logger.info('Firebase Admin initialized successfully from application default credentials.');
    }
} catch (error) {
    authReady = false;
    logger.error({ err: error }, 'Firebase Admin initialization failed. Protected routes will remain blocked.');
}

// Firebase Auth Emulator detection
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    logger.info('Firebase Auth Emulator active');
}

export const verifyFirebaseToken = async (req: any, res: any, next: any) => {
    if (!authReady) {
        logger.error('CRITICAL: Firebase Admin credentials unavailable. Rejecting request to enforce security.');
        return res.status(500).json({ error: 'Server Security Configuration Error: Firebase Admin credentials unavailable.' });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const principal = await resolveSqlPrincipalByFirebaseUid(decodedToken.uid);

        if (!principal) {
            logger.warn({ firebaseUid: decodedToken.uid }, 'Identity verified but no SQL user record found');
            return res.status(403).json({ error: 'Identity verified but no linked LoadPilot account found.' });
        }

        req.user = {
            id: principal.id,
            uid: principal.id,
            tenantId: principal.tenantId,
            companyId: principal.companyId,
            role: principal.role,
            email: principal.email,
            firebaseUid: principal.firebaseUid || decodedToken.uid
        };
        next();
    } catch (error) {
        logger.error({ err: error }, 'Firebase Token Verification Failed');
        res.status(403).json({ error: 'Invalid or expired identity token.' });
    }
};

export default admin;
