import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { TaskStatus, TaskPriority } from '../types';

export async function getTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters: { status?: TaskStatus; assigneeId?: number; departmentId?: number; priority?: TaskPriority; projectId?: number; teamId?: number } = {};

    if (req.query.status) {
      filters.status = req.query.status as TaskStatus;
    }
    if (req.query.assigneeId) {
      filters.assigneeId = parseInt(req.query.assigneeId as string);
    }
    if (req.query.departmentId) {
      filters.departmentId = parseInt(req.query.departmentId as string);
    }
    if (req.query.priority) {
      filters.priority = req.query.priority as TaskPriority;
    }
    if (req.query.projectId) {
      filters.projectId = parseInt(req.query.projectId as string);
    }
    if (req.query.teamId) {
      filters.teamId = parseInt(req.query.teamId as string);
    }

    const tasks = await db.getTasks(filters);
    res.json(tasks);
  } catch (err) {
    console.error('getTasks error:', err);
    res.status(500).json({ message: 'Error retrieving tasks.' });
  }
}

export async function getTaskById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid task ID.' });
    return;
  }

  try {
    const task = await db.getTaskById(id);
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    // Populate comments and activities
    const comments = await db.getTaskComments(id);
    const activities = await db.getTaskActivities(id);

    res.json({
      ...task,
      comments,
      activities
    });
  } catch (err) {
    console.error('getTaskById error:', err);
    res.status(500).json({ message: 'Error retrieving task details.' });
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const allowedRoles = ['Super Admin', 'Admin', 'HR', 'Manager'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({ message: 'Forbidden: Insufficient privileges to create tasks.' });
    return;
  }

  const { title, description, priority, due_date, assignee_id, department_id, project_id, team_id } = req.body;

  if (!title) {
    res.status(400).json({ message: 'Task title is required.' });
    return;
  }

  try {
    const creatorId = req.user.id;
    const task = await db.createTask({
      title,
      description: description || null,
      status: 'Todo',
      priority: priority || 'Medium',
      due_date: due_date || null,
      assignee_id: assignee_id ? parseInt(assignee_id) : null,
      creator_id: creatorId,
      department_id: department_id ? parseInt(department_id) : null,
      project_id: project_id ? parseInt(project_id) : null,
      team_id: team_id ? parseInt(team_id) : null
    });

    const userEmp = await db.getEmployeeById(creatorId);
    const userName = userEmp ? `${userEmp.first_name} ${userEmp.last_name}` : 'User';

    // Log in task activity
    await db.logTaskActivity(
      task.id,
      creatorId,
      'CREATED',
      `Task was created by ${userName}.`
    );

    // Log in main system activities
    await db.logActivity(
      creatorId,
      'TASK_CREATED',
      `Created task "${title}" (ID: ${task.id}).`
    );

    res.status(201).json(task);
  } catch (err) {
    console.error('createTask error:', err);
    res.status(500).json({ message: 'Error creating task.' });
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid task ID.' });
    return;
  }

  try {
    const existingTask = await db.getTaskById(id);
    if (!existingTask) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    const allowedRoles = ['Super Admin', 'Admin', 'HR', 'Manager'];
    const userId = req.user.id;
    const isCreator = existingTask.creator_id === userId;
    const isAssignee = existingTask.assignee_id === userId;

    if (!allowedRoles.includes(req.user.role) && !isCreator && !isAssignee) {
      res.status(403).json({ message: 'Forbidden: Insufficient privileges to update this task.' });
      return;
    }

    const { title, description, status, priority, due_date, assignee_id, department_id, project_id, team_id } = req.body;
    const updateFields: any = {};
    const actorId = req.user.id;

    const userEmp = await db.getEmployeeById(actorId);
    const actorName = userEmp ? `${userEmp.first_name} ${userEmp.last_name}` : 'User';

    // Track audits
    if (title !== undefined && title !== existingTask.title) {
      updateFields.title = title;
      await db.logTaskActivity(id, actorId, 'TITLE_CHANGE', `Title renamed to "${title}" by ${actorName}.`);
    }

    if (description !== undefined && description !== existingTask.description) {
      updateFields.description = description;
      await db.logTaskActivity(id, actorId, 'DESCRIPTION_CHANGE', `Description updated by ${actorName}.`);
    }

    if (status !== undefined && status !== existingTask.status) {
      updateFields.status = status;
      await db.logTaskActivity(id, actorId, 'STATUS_CHANGE', `Status shifted from "${existingTask.status}" to "${status}" by ${actorName}.`);
    }

    if (priority !== undefined && priority !== existingTask.priority) {
      updateFields.priority = priority;
      await db.logTaskActivity(id, actorId, 'PRIORITY_CHANGE', `Priority adjusted to "${priority}" by ${actorName}.`);
    }

    if (due_date !== undefined && due_date !== existingTask.due_date) {
      updateFields.due_date = due_date;
      const formattedDate = due_date ? due_date : 'no due date';
      await db.logTaskActivity(id, actorId, 'DUE_DATE_CHANGE', `Due date set to "${formattedDate}" by ${actorName}.`);
    }

    if (assignee_id !== undefined) {
      const parsedAssignee = assignee_id ? parseInt(assignee_id) : null;
      if (parsedAssignee !== existingTask.assignee_id) {
        updateFields.assignee_id = parsedAssignee;
        const assigneeEmp = parsedAssignee ? await db.getEmployeeById(parsedAssignee) : null;
        const assigneeName = assigneeEmp ? `${assigneeEmp.first_name} ${assigneeEmp.last_name}` : 'Unassigned';
        await db.logTaskActivity(id, actorId, 'REASSIGNED', `Assigned to ${assigneeName} by ${actorName}.`);
      }
    }

    if (department_id !== undefined) {
      const parsedDept = department_id ? parseInt(department_id) : null;
      if (parsedDept !== existingTask.department_id) {
        updateFields.department_id = parsedDept;
        const dept = parsedDept ? await db.getDepartmentById(parsedDept) : null;
        const deptName = dept ? dept.name : 'No Department';
        await db.logTaskActivity(id, actorId, 'DEPARTMENT_CHANGE', `Mapped to "${deptName}" department by ${actorName}.`);
      }
    }

    if (project_id !== undefined) {
      const parsedProj = project_id ? parseInt(project_id) : null;
      if (parsedProj !== existingTask.project_id) {
        updateFields.project_id = parsedProj;
        const proj = parsedProj ? await db.getProjectById(parsedProj) : null;
        const projName = proj ? proj.name : 'No Project';
        await db.logTaskActivity(id, actorId, 'PROJECT_CHANGE', `Mapped to project "${projName}" by ${actorName}.`);
      }
    }

    if (team_id !== undefined) {
      const parsedTeam = team_id ? parseInt(team_id) : null;
      if (parsedTeam !== existingTask.team_id) {
        updateFields.team_id = parsedTeam;
        const team = parsedTeam ? await db.getTeamById(parsedTeam) : null;
        const teamName = team ? team.name : 'No Team';
        await db.logTaskActivity(id, actorId, 'TEAM_CHANGE', `Mapped to team "${teamName}" by ${actorName}.`);
      }
    }

    const updated = await db.updateTask(id, updateFields);
    res.json(updated);
  } catch (err) {
    console.error('updateTask error:', err);
    res.status(500).json({ message: 'Error updating task.' });
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid task ID.' });
    return;
  }

  try {
    const task = await db.getTaskById(id);
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    const allowedRoles = ['Super Admin', 'Admin', 'HR', 'Manager'];
    const userId = req.user.id;
    const isCreator = task.creator_id === userId;

    if (!allowedRoles.includes(req.user.role) && !isCreator) {
      res.status(403).json({ message: 'Forbidden: Insufficient privileges to delete this task.' });
      return;
    }

    await db.deleteTask(id);
    await db.logActivity(
      req.user.id,
      'TASK_DELETED',
      `Deleted task "${task.title}" (ID: ${id}).`
    );

    res.json({ success: true });
  } catch (err) {
    console.error('deleteTask error:', err);
    res.status(500).json({ message: 'Error deleting task.' });
  }
}

export async function getTaskComments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid task ID.' });
    return;
  }

  try {
    const comments = await db.getTaskComments(id);
    res.json(comments);
  } catch (err) {
    console.error('getTaskComments error:', err);
    res.status(500).json({ message: 'Error retrieving task comments.' });
  }
}

export async function addTaskComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid task ID.' });
    return;
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ message: 'Comment content cannot be empty.' });
    return;
  }

  try {
    const actorId = req.user.id;
    const comment = await db.addTaskComment(id, actorId, content.trim());
    
    const userEmp = await db.getEmployeeById(actorId);
    const actorName = userEmp ? `${userEmp.first_name} ${userEmp.last_name}` : 'User';

    // Log task activity audit
    await db.logTaskActivity(
      id,
      actorId,
      'COMMENT_ADDED',
      `Comment added by ${actorName}: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`
    );

    res.status(201).json(comment);
  } catch (err) {
    console.error('addTaskComment error:', err);
    res.status(500).json({ message: 'Error adding comment.' });
  }
}

export async function getTaskActivities(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid task ID.' });
    return;
  }

  try {
    const activities = await db.getTaskActivities(id);
    res.json(activities);
  } catch (err) {
    console.error('getTaskActivities error:', err);
    res.status(500).json({ message: 'Error retrieving task activities.' });
  }
}
