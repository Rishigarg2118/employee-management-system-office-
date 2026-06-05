import { Router } from 'express';
import { getEmployeeDocuments, uploadDocument, deleteDocument } from '../controllers/documentController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/employee/:employeeId', authenticateToken as any, getEmployeeDocuments as any);
router.post('/upload', 
  authenticateToken as any, 
  requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any,
  upload.single('document'), 
  uploadDocument as any
);
router.delete('/:id', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, deleteDocument as any);

export default router;
