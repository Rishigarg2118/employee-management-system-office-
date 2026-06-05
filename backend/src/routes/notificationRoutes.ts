import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

// GET notifications for logged-in user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    const notifications = await db.getNotifications(req.user.id);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving notifications.', error: err instanceof Error ? err.message : err });
  }
});

// PUT mark notification as read
router.put('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const updated = await db.markNotificationAsRead(id);
    if (!updated) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating notification status.', error: err instanceof Error ? err.message : err });
  }
});

// POST mark all as read for user
router.post('/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    await db.markAllNotificationsAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Error clearing notifications.', error: err instanceof Error ? err.message : err });
  }
});

export default router;
