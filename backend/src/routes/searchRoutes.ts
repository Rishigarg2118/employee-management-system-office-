import { Router } from 'express';
import { search } from '../controllers/searchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, search as any);

export default router;
