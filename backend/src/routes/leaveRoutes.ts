import { Router } from 'express';
import { 
  getLeaveTypes, 
  getLeaveBalances, 
  getLeaveRequests, 
  getLeaveRequestById, 
  applyLeave, 
  approveLeaveWorkflow, 
  cancelLeave,
  getLeaveAnalytics,
  getLeaveCalendar,
  getLeaveReports
} from '../controllers/leaveController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Retrieve leave metadata & balances
router.get('/types', authenticateToken as any, getLeaveTypes as any);
router.get('/balances/:employeeId', authenticateToken as any, getLeaveBalances as any);

// Request queries
router.get('/requests', authenticateToken as any, getLeaveRequests as any);
router.get('/requests/:id', authenticateToken as any, getLeaveRequestById as any);

// Apply for leave (supports single document attachment)
router.post('/requests', 
  authenticateToken as any, 
  upload.single('attachment'), 
  applyLeave as any
);

// Workflow state changes
router.post('/requests/:id/approve', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  approveLeaveWorkflow as any
);

router.post('/requests/:id/cancel', 
  authenticateToken as any, 
  cancelLeave as any
);

// High-level systems
router.get('/analytics', authenticateToken as any, getLeaveAnalytics as any);
router.get('/calendar', authenticateToken as any, getLeaveCalendar as any);
router.get('/reports', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, 
  getLeaveReports as any
);

export default router;
