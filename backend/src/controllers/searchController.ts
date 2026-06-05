import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function search(req: AuthenticatedRequest, res: Response): Promise<void> {
  const query = req.query.q as string;

  if (!query || query.trim() === '') {
    res.json({
      employees: [],
      departments: [],
      skills: [],
      projects: [],
      teams: [],
      tasks: [],
      leaves: []
    });
    return;
  }

  try {
    const results = await db.globalSearch(query.trim());
    res.json(results);
  } catch (err) {
    console.error('[Search API Error]:', err);
    res.status(500).json({ message: 'Error performing enterprise search.' });
  }
}
