import { Router } from 'express';
import { 
  checkIn, 
  checkOut, 
  getAttendanceToday, 
  getAttendanceHistory, 
  getEmployeeAttendanceHistory, 
  getAttendanceTeam, 
  updateAttendance, 
  getAttendanceAnalytics,
  submitCorrectionRequest,
  rejectCorrectionRequest,
  getCorrectionRequests,
  submitHeartbeat,
  bulkSyncHeartbeats,
  getLiveWorkforce,
  getProductivityDetails,
  getProductivityLeaderboard,
  getProductivityInsights,
  getProductivityClassifications,
  createOrUpdateProductivityClassification
} from '../controllers/attendanceController';
import { authenticateToken, requireRole, requireApprovedDevice } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const telemetryRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // limit each device to 20 telemetry requests per minute
  message: 'Too many synchronization requests, throttling active.'
});

// Employee self operations
router.post('/check-in', authenticateToken as any, checkIn as any);
router.post('/check-out', authenticateToken as any, checkOut as any);
router.get('/today', authenticateToken as any, getAttendanceToday as any);
router.get('/history', authenticateToken as any, getAttendanceHistory as any);

// Heartbeat reporting with rate limiting and device trust validation
router.post('/heartbeat', authenticateToken as any, telemetryRateLimiter as any, requireApprovedDevice as any, submitHeartbeat as any);
router.post('/bulk-heartbeat', authenticateToken as any, telemetryRateLimiter as any, requireApprovedDevice as any, bulkSyncHeartbeats as any);
router.get('/productivity', authenticateToken as any, getProductivityDetails as any);
router.get('/productivity/leaderboard', authenticateToken as any, getProductivityLeaderboard as any);
router.get('/productivity/insights', authenticateToken as any, getProductivityInsights as any);
router.get('/productivity/classification', authenticateToken as any, getProductivityClassifications as any);
router.post('/productivity/classification', authenticateToken as any, createOrUpdateProductivityClassification as any);

// Management/Admin operations
router.get('/live',
  authenticateToken as any,
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any,
  getLiveWorkforce as any
);

router.get('/history/:employeeId', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  getEmployeeAttendanceHistory as any
);

router.get('/team', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  getAttendanceTeam as any
);

router.put('/:id', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  updateAttendance as any
);

router.post('/:id/correction-request',
  authenticateToken as any,
  submitCorrectionRequest as any
);

router.post('/corrections/:id/reject',
  authenticateToken as any,
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any,
  rejectCorrectionRequest as any
);

router.get('/corrections',
  authenticateToken as any,
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any,
  getCorrectionRequests as any
);

router.get('/analytics', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  getAttendanceAnalytics as any
);

router.get('/report', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  getAttendanceTeam as any
);

export default router;
