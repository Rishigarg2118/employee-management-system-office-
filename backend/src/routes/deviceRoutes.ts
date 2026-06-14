import { Router } from 'express';
import { 
  registerDevice, 
  getEmployeeDevices,
  getAllDevices,
  updateDeviceStatus
} from '../controllers/deviceController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.post('/register', authenticateToken as any, registerDevice as any);
router.get('/', authenticateToken as any, getEmployeeDevices as any);

router.get('/all',
  authenticateToken as any,
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any,
  getAllDevices as any
);

router.put('/:id/status',
  authenticateToken as any,
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any,
  updateDeviceStatus as any
);

export default router;
