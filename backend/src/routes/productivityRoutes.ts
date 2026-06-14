import { Router } from 'express';
import { 
  getClassifications, 
  createOrUpdateClassification, 
  deleteClassification 
} from '../controllers/productivityController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/classifications', authenticateToken as any, getClassifications as any);
router.post('/classifications', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, createOrUpdateClassification as any);
router.delete('/classifications/:id', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, deleteClassification as any);

export default router;
