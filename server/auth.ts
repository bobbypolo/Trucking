
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { logger } from './lib/logger';
import { resolveSqlPrincipalByFirebaseUid } from './lib/sql-auth';

dotenv.config();

// To secure the backend, you must:
// 1. Go to Firebase Console -> Project Settings -> Service Accounts
// 2. Click "Generate new private key"
// 3. Save the JSON file as 'server/serviceAccount.json' (DO NOT COMMIT THIS FILE)
// Or set FIREBASE_SERVICE_ACCOUNT env var to the JSON contents.

let authReady = false;
let serviceAccount: admin.ServiceAccount | undefined;
try {
    serviceAccount = require('./serviceAccount.json');
} catch (e) {
    // Not found on disk — check FIREBASE_SERVICE_ACCOUNT env var (JSON string)
    const envSA = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (envSA && envSA.trim() !== '{}' && envSA.trim().startsWith('{')) {
        try {
            serviceAccount = JSON.parse(envSA) as admin.ServiceAccount;
            logger.info('Loaded Firebase service account from FIREBASE_SERVICE_ACCOUNT env var.');
        } catch (parseErr) {
            logger.warn('FIREBASE_SERVICE_ACCOUNT env var is not valid JSON, ignoring.');
        }
    }
    if (!serviceAccount) {
        logger.warn('Firebase Service Account not found at server/serviceAccount.json or FIREBASE_SERVICE_ACCOUNT env. Falling back to application default credentials if available.');
    }
}

try {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        authReady = true;
        logger.info('Firebase Admin initialized successfully from service account.');
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

import { Request, Response, NextFunction } from 'express';

export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
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
