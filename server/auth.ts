
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// To secure the backend, you must:
// 1. Go to Firebase Console -> Project Settings -> Service Accounts
// 2. Click "Generate new private key"
// 3. Save the JSON file as 'server/serviceAccount.json' (DO NOT COMMIT THIS FILE)

let serviceAccount: any;
try {
    serviceAccount = require('./serviceAccount.json');
} catch (e) {
    console.warn('Firebase Service Account not found. Backend security is running in BYPASS mode.');
}



if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
}

export const verifyFirebaseToken = async (req: any, res: any, next: any) => {
    if (!serviceAccount) {
        // SECURITY HARDENING: Fail closed if service account is missing.
        // Was: return next(); // BYPASS MODE
        console.error('CRITICAL: Firebase Service Account missing. Rejecting request to enforce security.');
        return res.status(500).json({ error: 'Server Security Configuration Error: Service Account Missing.' });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Map Firebase user to Application User (Firestore Scope)
        // Transition: MySQL query removed in favor of direct Firestore lookup
        const db = admin.firestore();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', decodedToken.email).limit(1).get();

        if (snapshot.empty) {
            console.warn(`[AUTH] Identity verified for ${decodedToken.email} but no Firestore User record found.`);
            return res.status(403).json({ error: 'Identity verified but no linked LoadPilot account found.' });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        req.user = {
            id: userDoc.id,
            companyId: userData.company_id, // Firestore uses snake_case or camelCase? Check index.ts writes.
            role: userData.role,
            email: decodedToken.email,
            firebaseUid: decodedToken.uid
        };
        next();
    } catch (error) {
        console.error('Firebase Token Verification Failed:', error);
        res.status(403).json({ error: 'Invalid or expired identity token.' });
    }
};

export default admin;
