import { Router } from 'express';
import { getStats, getDepartmentDistribution, getEmployeeGrowthTrend, getRecentActivities } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticateToken as any, getStats as any);
router.get('/departments', authenticateToken as any, getDepartmentDistribution as any);
router.get('/growth', authenticateToken as any, getEmployeeGrowthTrend as any);
router.get('/activities', authenticateToken as any, getRecentActivities as any);

export default router;
