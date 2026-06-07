import { Router } from 'express';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, getDepartments as any);
router.post('/', authenticateToken as any, requireRole(['Super Admin', 'Admin']) as any, createDepartment as any);
router.put('/:id', authenticateToken as any, requireRole(['Super Admin', 'Admin']) as any, updateDepartment as any);
router.delete('/:id', authenticateToken as any, requireRole(['Super Admin', 'Admin']) as any, deleteDepartment as any);

export default router;
