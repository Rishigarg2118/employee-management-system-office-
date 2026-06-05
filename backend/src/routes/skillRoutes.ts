import { Router } from 'express';
import { getSkills, createSkill } from '../controllers/skillController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, getSkills as any);
router.post('/', authenticateToken as any, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']) as any, createSkill as any);

export default router;
