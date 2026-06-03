import { Router } from 'express';
import { login, setup, me } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/setup', setup);
router.get('/me', authenticateToken as any, me as any);

export default router;
