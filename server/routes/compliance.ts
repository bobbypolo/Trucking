import { Router } from 'express';
import { verifyFirebaseToken } from '../auth';
import pool from '../db';

const router = Router();
const authenticateToken = verifyFirebaseToken;

// Compliance Records
router.get('/api/compliance/:userId', authenticateToken, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'safety_manager') {
        return res.status(403).json({ error: 'Unauthorized profile access' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM compliance_records WHERE user_id = ?', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/compliance]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
