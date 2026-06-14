import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getClassifications(req: Request, res: Response): Promise<void> {
  try {
    const list = await db.getProductivityClassifications();
    res.json(list);
  } catch (err) {
    console.error('getClassifications error:', err);
    res.status(500).json({ message: 'Error retrieving classifications.' });
  }
}

export async function createOrUpdateClassification(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { pattern, category, tag, score } = req.body;

  if (!pattern || !category || !tag) {
    res.status(400).json({ message: 'Pattern, Category, and Tag are required.' });
    return;
  }

  const validCategories = ['Productive', 'Neutral', 'Unproductive'];
  const validTags = ['Deep Work', 'Communication', 'Learning', 'Research', 'Entertainment', 'Social Media'];

  if (!validCategories.includes(category)) {
    res.status(400).json({ message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    return;
  }

  if (!validTags.includes(tag)) {
    res.status(400).json({ message: `Invalid tag. Must be one of: ${validTags.join(', ')}` });
    return;
  }

  const scoreNum = score !== undefined ? parseInt(score, 10) : 100;
  if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
    res.status(400).json({ message: 'Score must be a percentage integer between 0 and 100.' });
    return;
  }

  try {
    const record = await db.createOrUpdateProductivityClassification(pattern.trim(), category, tag, scoreNum);
    
    // Log audit log
    const actorName = req.user ? req.user.email : 'System';
    await db.logActivity(
      req.user ? req.user.id : null,
      'SYSTEM',
      `Classification pattern "${pattern}" updated to ${category}/${tag} with score ${scoreNum}% by ${actorName}.`
    );

    res.status(200).json(record);
  } catch (err) {
    console.error('createOrUpdateClassification error:', err);
    res.status(500).json({ message: 'Error saving classification.' });
  }
}

export async function deleteClassification(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id as string, 10);

  if (isNaN(idNum)) {
    res.status(400).json({ message: 'Invalid ID format.' });
    return;
  }

  try {
    const success = await db.deleteProductivityClassification(idNum);
    if (!success) {
      res.status(404).json({ message: 'Classification not found.' });
      return;
    }

    const actorName = req.user ? req.user.email : 'System';
    await db.logActivity(
      req.user ? req.user.id : null,
      'SYSTEM',
      `Deleted classification ID ${idNum} by ${actorName}.`
    );

    res.json({ message: 'Classification rule deleted successfully.' });
  } catch (err) {
    console.error('deleteClassification error:', err);
    res.status(500).json({ message: 'Error deleting classification.' });
  }
}
