import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getSkills(req: Request, res: Response): Promise<void> {
  try {
    const skills = await db.getSkills();
    res.json(skills);
  } catch (err) {
    console.error('getSkills error:', err);
    res.status(500).json({ message: 'Error retrieving skills repository.' });
  }
}

export async function createSkill(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, category } = req.body;

  if (!name || !category) {
    res.status(400).json({ message: 'Skill Name and Category are required.' });
    return;
  }

  try {
    const skills = await db.getSkills();
    const exists = skills.some(s => s.name.toLowerCase() === name.trim().toLowerCase());
    
    if (exists) {
      res.status(400).json({ message: 'Skill already registered in repository.' });
      return;
    }

    const newSkill = await db.createSkill(name.trim(), category.trim());
    
    const adminName = req.user ? req.user.email : 'System';
    await db.logActivity(null, 'SKILL_CREATED', `Skill "${name}" was registered under "${category}" by ${adminName}.`);

    res.status(201).json(newSkill);
  } catch (err) {
    console.error('createSkill error:', err);
    res.status(500).json({ message: 'Error adding skill.' });
  }
}
