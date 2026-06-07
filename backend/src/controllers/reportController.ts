import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getHeadcount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsHeadcount();
    res.json(data);
  } catch (err) {
    console.error('getHeadcount error:', err);
    res.status(500).json({ message: 'Error retrieving headcount report.' });
  }
}

export async function getDepartmentDistribution(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsDepartmentDistribution();
    res.json(data);
  } catch (err) {
    console.error('getDepartmentDistribution error:', err);
    res.status(500).json({ message: 'Error retrieving department distribution report.' });
  }
}

export async function getTaskStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsTaskStats();
    res.json(data);
  } catch (err) {
    console.error('getTaskStats error:', err);
    res.status(500).json({ message: 'Error retrieving task stats report.' });
  }
}

export async function getLeaveStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsLeaveStats();
    res.json(data);
  } catch (err) {
    console.error('getLeaveStats error:', err);
    res.status(500).json({ message: 'Error retrieving leave stats report.' });
  }
}
