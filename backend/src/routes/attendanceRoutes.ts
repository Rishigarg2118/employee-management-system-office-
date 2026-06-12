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
  getLiveWorkforce,
  getProductivityDetails
} from '../controllers/attendanceController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Employee self operations
router.post('/check-in', authenticateToken as any, checkIn as any);
router.post('/check-out', authenticateToken as any, checkOut as any);
router.get('/today', authenticateToken as any, getAttendanceToday as any);
router.get('/history', authenticateToken as any, getAttendanceHistory as any);

// Heartbeat reporting
router.post('/heartbeat', authenticateToken as any, submitHeartbeat as any);
router.get('/productivity', authenticateToken as any, getProductivityDetails as any);

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
