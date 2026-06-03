import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getDepartments(req: Request, res: Response): Promise<void> {
  try {
    const departments = await db.getDepartments();
    const employees = await db.getEmployees();

    const formatted = departments.map(dept => {
      const manager = dept.manager_id ? employees.find(e => e.id === dept.manager_id) : null;
      const count = employees.filter(e => e.department_id === dept.id).length;
      
      const managerDetails = manager ? {
        id: manager.id,
        first_name: manager.first_name,
        last_name: manager.last_name,
        email: manager.email,
        avatar_url: manager.avatar_url
      } : null;

      return {
        ...dept,
        employee_count: count,
        manager: managerDetails
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('getDepartments error:', err);
    res.status(500).json({ message: 'Error fetching departments.' });
  }
}

export async function createDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, code, description, manager_id } = req.body;

  if (!name || !code) {
    res.status(400).json({ message: 'Name and Code are required.' });
    return;
  }

  try {
    const depts = await db.getDepartments();
    if (depts.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      res.status(400).json({ message: 'Department name already exists.' });
      return;
    }
    if (depts.some(d => d.code.toLowerCase() === code.toLowerCase())) {
      res.status(400).json({ message: 'Department code already in use.' });
      return;
    }

    const managerIdNum = manager_id ? parseInt(manager_id) : null;
    const newDept = await db.createDepartment(name, code, description, managerIdNum);

    const adminName = req.user ? req.user.email : 'System';
    await db.logActivity(null, 'DEPARTMENT_CREATED', `Department "${name}" (${code}) was created by ${adminName}.`);

    res.status(201).json(newDept);
  } catch (err) {
    console.error('createDepartment error:', err);
    res.status(500).json({ message: 'Error creating department.' });
  }
}

export async function updateDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid department ID.' });
    return;
  }

  const { name, code, description, manager_id } = req.body;

  try {
    const existing = await db.getDepartmentById(id);
    if (!existing) {
      res.status(404).json({ message: 'Department not found.' });
      return;
    }

    const data: any = {};
    if (name) data.name = name;
    if (code) data.code = code;
    if (description !== undefined) data.description = description;
    if (manager_id !== undefined) data.manager_id = manager_id ? parseInt(manager_id) : null;

    const updated = await db.updateDepartment(id, data);

    const adminName = req.user ? req.user.email : 'System';
    await db.logActivity(null, 'DEPARTMENT_UPDATED', `Department "${existing.name}" updated by ${adminName}.`);

    res.json(updated);
  } catch (err) {
    console.error('updateDepartment error:', err);
    res.status(500).json({ message: 'Error updating department.' });
  }
}
