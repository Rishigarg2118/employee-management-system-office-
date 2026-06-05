import { Router } from 'express';
import { 
  getTasks, 
  getTaskById, 
  createTask, 
  updateTask, 
  deleteTask, 
  getTaskComments, 
  addTaskComment, 
  getTaskActivities 
} from '../controllers/taskController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all task pathways
router.get('/', authenticateToken as any, getTasks as any);
router.get('/:id', authenticateToken as any, getTaskById as any);
router.post('/', authenticateToken as any, createTask as any);
router.put('/:id', authenticateToken as any, updateTask as any);
router.delete('/:id', authenticateToken as any, deleteTask as any);

// Comments
router.get('/:id/comments', authenticateToken as any, getTaskComments as any);
router.post('/:id/comments', authenticateToken as any, addTaskComment as any);

// Activities / Timeline log
router.get('/:id/activities', authenticateToken as any, getTaskActivities as any);

export default router;
