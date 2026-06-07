import { Router } from 'express';
import { 
  getHeadcount, 
  getDepartmentDistribution, 
  getTaskStats, 
  getLeaveStats 
} from '../controllers/reportController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Secure all executive report endpoints to Admins and HR only
const reportGuard = requireRole(['Super Admin', 'Admin', 'HR']) as any;

router.get('/headcount', authenticateToken as any, reportGuard, getHeadcount as any);
router.get('/department-distribution', authenticateToken as any, reportGuard, getDepartmentDistribution as any);
router.get('/task-stats', authenticateToken as any, reportGuard, getTaskStats as any);
router.get('/leave-stats', authenticateToken as any, reportGuard, getLeaveStats as any);

export default router;
