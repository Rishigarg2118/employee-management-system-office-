import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

// GET all teams
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departmentId = req.query.departmentId ? parseInt(req.query.departmentId as string) : undefined;
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;

    const teams = await db.getTeams({ departmentId, employeeId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving teams.', error: err instanceof Error ? err.message : err });
  }
});

// GET single team details
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const team = await db.getTeamById(id);
    if (!team) {
      res.status(404).json({ message: 'Team not found.' });
      return;
    }
    res.json(team);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving team details.', error: err instanceof Error ? err.message : err });
  }
});

// POST create team (Super Admin, Admin, HR, Manager)
router.post('/', authenticateToken, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, department_id, lead_id, memberIds } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Team name is required.' });
      return;
    }

    const team = await db.createTeam(
      name,
      department_id ? parseInt(department_id) : null,
      lead_id ? parseInt(lead_id) : null,
      memberIds ? memberIds.map((id: any) => parseInt(id)) : []
    );

    // Send notifications
    if (team.lead_id) {
      await db.createNotification(
        team.lead_id,
        'Assigned as Team Lead',
        `You have been assigned as the lead for team "${team.name}".`,
        'SYSTEM'
      );
    }

    if (memberIds && memberIds.length > 0) {
      for (const empId of memberIds) {
        if (parseInt(empId) === team.lead_id) continue;
        await db.createNotification(
          parseInt(empId),
          'Added to Team',
          `You have been added to the team "${team.name}".`,
          'SYSTEM'
        );
      }
    }

    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ message: 'Error creating team.', error: err instanceof Error ? err.message : err });
  }
});

// PUT update team (Super Admin, Admin, HR, Manager)
router.put('/:id', authenticateToken, requireRole(['Super Admin', 'Admin', 'HR', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, department_id, lead_id, memberIds } = req.body;

    const existingTeam = await db.getTeamById(id);
    if (!existingTeam) {
      res.status(404).json({ message: 'Team not found.' });
      return;
    }

    const updated = await db.updateTeam(
      id,
      { name, department_id: department_id ? parseInt(department_id) : null, lead_id: lead_id ? parseInt(lead_id) : null },
      memberIds ? memberIds.map((mid: any) => parseInt(mid)) : undefined
    );

    if (!updated) {
      res.status(500).json({ message: 'Failed to update team.' });
      return;
    }

    // Send notifications if lead changed
    if (lead_id && parseInt(lead_id) !== existingTeam.lead_id) {
      await db.createNotification(
        parseInt(lead_id),
        'Assigned as Team Lead',
        `You have been assigned as the lead for team "${updated.name}".`,
        'SYSTEM'
      );
    }

    // Notify new members
    if (memberIds) {
      const existingMemberIds = existingTeam.members ? existingTeam.members.map(m => m.id) : [];
      const newMembers = memberIds.map((mid: any) => parseInt(mid)).filter((mid: number) => !existingMemberIds.includes(mid));

      for (const empId of newMembers) {
        if (empId === updated.lead_id) continue;
        await db.createNotification(
          empId,
          'Added to Team',
          `You have been added to the team "${updated.name}".`,
          'SYSTEM'
        );
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating team.', error: err instanceof Error ? err.message : err });
  }
});

// DELETE team (Super Admin, Admin)
router.delete('/:id', authenticateToken, requireRole(['Super Admin', 'Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const team = await db.getTeamById(id);
    if (!team) {
      res.status(404).json({ message: 'Team not found.' });
      return;
    }

    await db.deleteTeam(id);
    res.json({ message: 'Team deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting team.', error: err instanceof Error ? err.message : err });
  }
});

export default router;
