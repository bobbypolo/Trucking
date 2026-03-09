import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/requireAuth';
import { requireTenant } from '../middleware/requireTenant';
import db from '../firestore';
import { validateBody } from '../middleware/validate';
import { registerUserSchema, syncUserSchema, loginUserSchema } from '../schemas/users';
import { createChildLogger } from '../lib/logger';

const router = Router();

// AUTHENTICATION & REGISTRATION
router.post('/api/auth/register', validateBody(registerUserSchema), async (req, res) => {
    const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/auth/register' });
    log.info({ data: { email: req.body.email } }, 'Registration request received');
    const { id, company_id, companyId, email, password, name, role, pay_model, payModel, pay_rate, payRate } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password || 'admin123', 10);
        let targetCompanyId = company_id || companyId || 'iscope-authority-001';
        if (targetCompanyId === 'null' || !targetCompanyId) targetCompanyId = 'iscope-authority-001';

        const userId = id || uuidv4();
        await db.collection('users').doc(userId).set({
            id: userId,
            company_id: targetCompanyId,
            email,
            password: hashedPassword,
            name,
            role,
            pay_model: pay_model || payModel,
            pay_rate: pay_rate || payRate,
            onboarding_status: 'Completed',
            createdAt: new Date().toISOString()
        });
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        log.error({ err: error }, 'Registration failed');
        res.status(500).json({ error: 'Registration failed', details: error instanceof Error ? error.message : String(error) });
    }
});

// User Management (Sync)
router.post('/api/users', validateBody(syncUserSchema), async (req, res) => {
    const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/users' });
    log.info({ data: { email: req.body.email } }, 'User sync request received');
    const { id, company_id, companyId, email, password, name, role, pay_model, payModel, pay_rate, payRate, managed_by_user_id, managedByUserId, safety_score, safetyScore } = req.body;
    try {
        let targetCompanyId = company_id || companyId || 'iscope-authority-001';
        if (targetCompanyId === 'null' || !targetCompanyId) targetCompanyId = 'iscope-authority-001';

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        const finalRole = role || 'driver';
        const finalSafetyScore = safety_score || safetyScore || 100;

        const userId = id || uuidv4();
        const userData: any = {
            id: userId,
            company_id: targetCompanyId,
            email,
            name,
            role: finalRole,
            pay_model: pay_model || payModel,
            pay_rate: pay_rate || payRate,
            onboarding_status: 'Completed',
            managed_by_user_id: managed_by_user_id || managedByUserId,
            safety_score: finalSafetyScore,
            updatedAt: new Date().toISOString()
        };
        if (hashedPassword) userData.password = hashedPassword;

        await db.collection('users').doc(userId).set(userData, { merge: true });
        res.status(201).json({ message: 'User updated/created' });
    } catch (error) {
        log.error({ err: error }, 'User sync failed');
        res.status(500).json({ error: 'User sync failed', details: error instanceof Error ? error.message : String(error) });
    }
});

router.post('/api/auth/login', validateBody(loginUserSchema), async (req, res) => {
    const { email, password, firebaseUid } = req.body;
    try {
        // Firebase Auth is handled on the frontend
        // This endpoint is called AFTER Firebase authentication succeeds
        // We just need to fetch the user data from Firestore

        const userSnapshot = await db.collection('users').where('email', '==', email).get();
        if (userSnapshot.empty) {
            // User authenticated with Firebase but no Firestore record exists
            // This shouldn't happen if seeding worked correctly
            const log = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/auth/login' });
            log.warn({ email }, 'User authenticated with Firebase but no Firestore record found');
            return res.status(404).json({ error: 'User profile not found. Please contact support.' });
        }


        const userDoc = userSnapshot.docs[0];
        const user = userDoc.data();

        // Fetch company settings
        const companyDoc = await db.collection('companies').doc(user.company_id).get();
        const companyData = companyDoc.exists ? companyDoc.data() : null;

        // Normalize for frontend (camelCase)
        const normalizedUser = {
            ...user,
            id: user.id || userDoc.id,
            companyId: user.company_id,
            onboardingStatus: user.onboarding_status,
            payModel: user.pay_model,
            payRate: user.pay_rate,
            managedByUserId: user.managed_by_user_id,
            safetyScore: user.safety_score,
            primaryWorkspace: user.primary_workspace,
            dutyMode: user.duty_mode
        };
        delete (normalizedUser as Record<string, unknown>).password;
        delete (normalizedUser as Record<string, unknown>).company_id;
        delete (normalizedUser as Record<string, unknown>).onboarding_status;
        delete (normalizedUser as Record<string, unknown>).pay_model;
        delete (normalizedUser as Record<string, unknown>).pay_rate;
        delete (normalizedUser as Record<string, unknown>).managed_by_user_id;
        delete (normalizedUser as Record<string, unknown>).safety_score;
        delete (normalizedUser as Record<string, unknown>).primary_workspace;
        delete (normalizedUser as Record<string, unknown>).duty_mode;

        res.json({ user: normalizedUser, company: companyData });


    } catch (error) {
        const loginLog = createChildLogger({ correlationId: req.correlationId, route: 'POST /api/auth/login' });
        loginLog.error({ err: error }, 'Login failed');
        res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : String(error) });
    }
});

// Protected User Routes (Require Token)
router.get('/api/users/me', requireAuth, async (req, res) => {
    try {
        const doc = await db.collection('users').doc(req.user!.uid).get();
        const user = doc.data();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/api/users/:companyId', requireAuth, requireTenant, async (req, res) => {
    // RBAC: Ensure user only sees users from their own company
    if (req.user!.tenantId !== req.params.companyId && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Resource unauthorized' });
    }


    try {
        const snapshot = await db.collection('users').where('company_id', '==', req.params.companyId).get();
        const users = snapshot.docs.map(doc => {
            const u = doc.data();
            return {
                ...u,
                id: u.id || doc.id,
                companyId: u.company_id,
                onboardingStatus: u.onboarding_status,
                safetyScore: u.safety_score,
                password: undefined
            };
        });
        res.json(users);

    } catch (error) {
        const usersLog = createChildLogger({ correlationId: req.correlationId, route: 'GET /api/users' });
        usersLog.error({ err: error }, 'SERVER ERROR [GET /api/users]');
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
