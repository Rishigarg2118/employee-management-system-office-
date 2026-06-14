import { Router } from 'express';
import { 
  getHeadcount, 
  getDepartmentDistribution, 
  getTaskStats, 
  getLeaveStats,
  getComprehensiveReport
} from '../controllers/reportController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Secure all executive report endpoints to Admins and HR only
const reportGuard = requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any;

router.get('/headcount', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR']) as any, getHeadcount as any);
router.get('/department-distribution', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR']) as any, getDepartmentDistribution as any);
router.get('/task-stats', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR']) as any, getTaskStats as any);
router.get('/leave-stats', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR']) as any, getLeaveStats as any);
router.get('/analytics', authenticateToken as any, reportGuard, getComprehensiveReport as any);

export default router;
