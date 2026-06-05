import { Router } from 'express';
import { login, setup, me, refresh, logout, systemStatus } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const loginLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: 'Too many login requests. Please try again after 10 minutes.'
});

router.post('/login', loginLimiter as any, login);
router.post('/setup', setup);
router.get('/me', authenticateToken as any, me as any);
router.post('/refresh', refresh as any);
router.post('/logout', logout as any);
router.get('/status', systemStatus as any);

export default router;
