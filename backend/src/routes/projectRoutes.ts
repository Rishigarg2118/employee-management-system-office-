import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import db from '../config/db';
import { ProjectStatus } from '../types';

const router = Router();

// GET all projects (accessible by all authenticated staff)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as ProjectStatus | undefined;
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
    
    const projects = await db.getProjects({ status, employeeId });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving projects.', error: err instanceof Error ? err.message : err });
  }
});

// GET single project details
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const project = await db.getProjectById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving project details.', error: err instanceof Error ? err.message : err });
  }
});

// POST create project (Super Admin, Admin, HR, Manager)
router.post('/', authenticateToken, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, start_date, deadline, status, manager_id, memberIds } = req.body;
    
    if (!name) {
      res.status(400).json({ message: 'Project name is required.' });
      return;
    }

    const project = await db.createProject(
      name,
      description,
      start_date,
      deadline,
      status || 'Planning',
      manager_id ? parseInt(manager_id) : null,
      memberIds ? memberIds.map((id: any) => parseInt(id)) : []
    );

    // Send notifications to manager & members
    if (project.manager_id) {
      await db.createNotification(
        project.manager_id,
        'Assigned as Project Manager',
        `You have been assigned as the manager for the project "${project.name}".`,
        'PROJECT'
      );
    }

    if (memberIds && memberIds.length > 0) {
      for (const empId of memberIds) {
        if (parseInt(empId) === project.manager_id) continue;
        await db.createNotification(
          parseInt(empId),
          'Added to Project Members',
          `You have been added as a member of the project "${project.name}".`,
          'PROJECT'
        );
      }
    }

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: 'Error creating project.', error: err instanceof Error ? err.message : err });
  }
});

// PUT update project (Super Admin, Admin, HR, Manager)
router.put('/:id', authenticateToken, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description, start_date, deadline, status, manager_id, memberIds } = req.body;

    const existingProject = await db.getProjectById(id);
    if (!existingProject) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const updated = await db.updateProject(
      id,
      { name, description, start_date, deadline, status, manager_id: manager_id ? parseInt(manager_id) : null },
      memberIds ? memberIds.map((mid: any) => parseInt(mid)) : undefined
    );

    if (!updated) {
      res.status(500).json({ message: 'Failed to update project.' });
      return;
    }

    // Send notifications to new manager if manager changed
    if (manager_id && parseInt(manager_id) !== existingProject.manager_id) {
      await db.createNotification(
        parseInt(manager_id),
        'Assigned as Project Manager',
        `You have been assigned as the manager for the project "${updated.name}".`,
        'PROJECT'
      );
    }

    // Notify new members
    if (memberIds) {
      const existingMemberIds = existingProject.members ? existingProject.members.map(m => m.id) : [];
      const newMembers = memberIds.map((mid: any) => parseInt(mid)).filter((mid: number) => !existingMemberIds.includes(mid));
      
      for (const empId of newMembers) {
        if (empId === updated.manager_id) continue;
        await db.createNotification(
          empId,
          'Added to Project Members',
          `You have been added as a member of the project "${updated.name}".`,
          'PROJECT'
        );
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating project.', error: err instanceof Error ? err.message : err });
  }
});

// DELETE project (Super Admin, Admin)
router.delete('/:id', authenticateToken, requireRole(['Super Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const project = await db.getProjectById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    await db.deleteProject(id);
    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting project.', error: err instanceof Error ? err.message : err });
  }
});

export default router;
