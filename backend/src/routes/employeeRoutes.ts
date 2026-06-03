import { Router } from 'express';
import { getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, bulkActions } from '../controllers/employeeController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/', authenticateToken as any, getEmployees as any);
router.get('/:id', authenticateToken as any, getEmployeeById as any);

router.post('/', 
  authenticateToken as any, 
  requireRole(['Admin', 'Manager']) as any,
  upload.single('avatar'), 
  createEmployee as any
);

router.put('/:id', 
  authenticateToken as any, 
  requireRole(['Admin', 'Manager']) as any,
  upload.single('avatar'), 
  updateEmployee as any
);

router.delete('/:id', 
  authenticateToken as any, 
  requireRole(['Admin']) as any, 
  deleteEmployee as any
);

router.post('/bulk', 
  authenticateToken as any, 
  requireRole(['Admin']) as any, 
  bulkActions as any
);

export default router;
