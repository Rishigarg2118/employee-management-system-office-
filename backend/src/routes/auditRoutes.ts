import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import db from '../config/db';
import { AuditLogModule } from '../types';

const router = Router();

// GET audit logs (Super Admin and Admin roles only)
router.get('/', authenticateToken, requireRole(['Super Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const module = req.query.module as AuditLogModule | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    const logs = await db.getAuditLogs({ module, limit });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving audit logs.', error: err instanceof Error ? err.message : err });
  }
});

export default router;
