import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AuthError, InternalError } from '../errors/AppError';

/**
 * Extended request interface with authenticated user context.
 */
export interface AuthenticatedUser {
    uid: string;
    tenantId: string;
    role: string;
    email: string;
    firebaseUid: string;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

/**
 * Checks whether Firebase Admin SDK is initialized.
 * Returns true if at least one app is initialized.
 */
function isFirebaseInitialized(): boolean {
    try {
        admin.app();
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolves user profile from Firestore by Firebase UID.
 * Returns user document data or null if not found.
 */
async function resolveUserProfile(
    firebaseUid: string,
): Promise<{ id: string; tenantId: string; role: string; email: string } | null> {
    const db = admin.firestore();
    const usersRef = db.collection('users');

    // Look up by firebase_uid field first (canonical identity mapping)
    let snapshot = await usersRef
        .where('firebase_uid', '==', firebaseUid)
        .limit(1)
        .get();

    // Fallback: check if the document ID is the Firebase UID
    if (snapshot.empty) {
        const doc = await usersRef.doc(firebaseUid).get();
        if (doc.exists) {
            const data = doc.data()!;
            return {
                id: data.id || doc.id,
                tenantId: data.company_id,
                role: data.role || 'user',
                email: data.email || '',
            };
        }
        return null;
    }

    const userDoc = snapshot.docs[0];
    const data = userDoc.data();
    return {
        id: data.id || userDoc.id,
        tenantId: data.company_id,
        role: data.role || 'user',
        email: data.email || '',
    };
}

/**
 * requireAuth middleware — validates Firebase ID token and attaches user context.
 *
 * FAIL CLOSED: If Firebase Admin SDK is not configured, ALL requests are rejected
 * with a 500 error. No bypass mode.
 *
 * On success, sets req.user with: uid, tenantId, role, email, firebaseUid.
 * On failure, passes an AuthError (401) or InternalError (500) to next().
 */
export async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    // FAIL CLOSED: Reject if Firebase Admin is not initialized
    if (!isFirebaseInitialized()) {
        return next(
            new InternalError('Server authentication not configured', {}, 'AUTH_CONFIG_001'),
        );
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(
            new AuthError('Authentication required. Bearer token missing.', {}, 'AUTH_MISSING_001'),
        );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return next(
            new AuthError('Authentication required. Bearer token missing.', {}, 'AUTH_MISSING_001'),
        );
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userProfile = await resolveUserProfile(decodedToken.uid);

        if (!userProfile) {
            return next(
                new AuthError(
                    'Identity verified but no linked account found.',
                    { firebaseUid: decodedToken.uid },
                    'AUTH_NO_PROFILE_001',
                ),
            );
        }

        // Attach user context to request
        (req as AuthenticatedRequest).user = {
            uid: userProfile.id,
            tenantId: userProfile.tenantId,
            role: userProfile.role,
            email: userProfile.email,
            firebaseUid: decodedToken.uid,
        };

        next();
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'Token verification failed';
        return next(
            new AuthError('Invalid or expired authentication token.', { reason: message }, 'AUTH_INVALID_001'),
        );
    }
}
