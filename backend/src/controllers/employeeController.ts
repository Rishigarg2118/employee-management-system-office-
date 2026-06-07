import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { Employee, EmployeeStatus, EmployeeRole } from '../types';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import * as fs from 'fs';
import * as path from 'path';

export async function getEmployees(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string || '').trim().toLowerCase();
  const departmentId = req.query.department_id ? parseInt(req.query.department_id as string) : undefined;
  const status = req.query.status as EmployeeStatus || undefined;
  const sortBy = req.query.sort_by as string || 'id';
  const sortOrder = (req.query.sort_order as string || 'desc').toLowerCase();

  try {
    let employees: Employee[] = [];
    
    if (db.isPostgres()) {
      // SQL execution
      let queryStr = 'SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1';
      const params: any[] = [];
      let paramCount = 1;

      if (search) {
        queryStr += ` AND (LOWER(e.first_name) LIKE $${paramCount} OR LOWER(e.last_name) LIKE $${paramCount} OR LOWER(CONCAT(e.first_name, ' ', e.last_name)) LIKE $${paramCount} OR LOWER(e.email) LIKE $${paramCount} OR LOWER(e.employee_id) LIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      if (departmentId) {
        queryStr += ` AND e.department_id = $${paramCount}`;
        params.push(departmentId);
        paramCount++;
      }

      if (status) {
        queryStr += ` AND e.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      // Add Sorting (Sanitize column name to prevent SQL injection)
      const allowedSortColumns = ['id', 'first_name', 'last_name', 'email', 'employee_id', 'joining_date', 'status', 'designation'];
      const finalSortCol = allowedSortColumns.includes(sortBy) ? sortBy : 'id';
      const finalSortOrd = sortOrder === 'asc' ? 'ASC' : 'DESC';
      queryStr += ` ORDER BY e.${finalSortCol} ${finalSortOrd}`;

      // Count total matches for pagination metadata
      const countRes = await db.query(`SELECT COUNT(*) FROM (${queryStr}) as temp`, params);
      const total = parseInt(countRes.rows[0].count);

      // Add Pagination
      queryStr += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit);
      params.push((page - 1) * limit);

      const dataRes = await db.query(queryStr, params);
      
      // Fetch departments to format response
      const depts = await db.getDepartments();
      const formatted = dataRes.rows.map(e => ({
        ...e,
        password: undefined,
        department: depts.find(d => d.id === e.department_id) || null
      }));

      res.json({
        data: formatted,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      // JSON fallback execution
      let filtered = await db.getEmployees();

      // Search filters
      if (search) {
        filtered = filtered.filter(e => 
          e.first_name.toLowerCase().includes(search) ||
          e.last_name.toLowerCase().includes(search) ||
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(search) ||
          e.email.toLowerCase().includes(search) ||
          e.employee_id.toLowerCase().includes(search)
        );
      }

      if (departmentId) {
        filtered = filtered.filter(e => e.department_id === departmentId);
      }

      if (status) {
        filtered = filtered.filter(e => e.status === status);
      }

      // Sorting
      filtered.sort((a: any, b: any) => {
        let valA = a[sortBy] ?? '';
        let valB = b[sortBy] ?? '';
        
        if (sortBy === 'name') {
          valA = `${a.first_name} ${a.last_name}`.toLowerCase();
          valB = `${b.first_name} ${b.last_name}`.toLowerCase();
        } else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      const total = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      const depts = await db.getDepartments();
      const formatted = paginated.map(e => {
        const { password: _, ...eNoPass } = e;
        return {
          ...eNoPass,
          department: depts.find(d => d.id === e.department_id) || null
        };
      });

      res.json({
        data: formatted,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    }
  } catch (err) {
    console.error('getEmployees error:', err);
    res.status(500).json({ message: 'Error retrieving employee registry.' });
  }
}

export async function getEmployeeById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid employee ID.' });
    return;
  }

  try {
    const employee = await db.getEmployeeById(id);
    if (!employee) {
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    const { password: _, ...employeeNoPass } = employee;
    
    // Fetch associated data
    const department = employee.department_id ? await db.getDepartmentById(employee.department_id) : null;
    const skills = await db.getEmployeeSkills(id);
    const documents = await db.getEmployeeDocuments(id);
    const timeline = await db.getEmployeeActivities(id);

    res.json({
      ...employeeNoPass,
      department,
      skills,
      documents,
      timeline
    });
  } catch (err) {
    console.error('getEmployeeById error:', err);
    res.status(500).json({ message: 'Error retrieving employee details.' });
  }
}

export async function createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    employee_id,
    first_name,
    last_name,
    email,
    password,
    phone,
    department_id,
    designation,
    status,
    joining_date,
    address,
    bio,
    role,
    skills // Expecting array of { skill_id, proficiency_level }
  } = req.body;

  if (!employee_id || !first_name || !last_name || !email || !designation || !joining_date) {
    res.status(400).json({ message: 'Required fields are missing.' });
    return;
  }

  try {
    // Check duplicates
    const checkEmail = await db.getEmployeeByEmail(email);
    if (checkEmail) {
      res.status(400).json({ message: 'Email address already registered.' });
      return;
    }

    const checkCode = await db.getEmployeeByCode(employee_id);
    if (checkCode) {
      res.status(400).json({ message: 'Employee ID code already in use.' });
      return;
    }

    const defaultPassword = password || 'Welcome@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    let avatarUrl = undefined;
    if (req.file) {
      const cloudRes = await uploadToCloudinary(req.file.path, 'avatars');
      await db.saveCloudinaryMapping(req.file.filename, cloudRes.secure_url, cloudRes.public_id);
      avatarUrl = `uploads/${req.file.filename}`;
    }

    const newEmp = await db.createEmployee({
      employee_id,
      first_name,
      last_name,
      email,
      password: hashedPassword,
      phone,
      department_id: department_id ? parseInt(department_id) : null,
      designation,
      status: status || 'Active',
      joining_date,
      avatar_url: avatarUrl,
      address,
      bio,
      role: role || 'Employee'
    });

    // Assign skills if provided
    let skillsList = skills;
    if (skills && typeof skills === 'string') {
      try {
        skillsList = JSON.parse(skills);
      } catch (e) {
        console.error('Failed to parse skills JSON:', e);
      }
    }
    if (skillsList && Array.isArray(skillsList)) {
      for (const s of skillsList) {
        if (s.skill_id) {
          await db.assignSkill(newEmp.id, parseInt(s.skill_id), s.proficiency_level || 'Intermediate');
        }
      }
    }

    // Log activities
    const adminName = req.user ? req.user.email : 'System';
    await db.logActivity(
      newEmp.id, 
      'EMPLOYEE_CREATED', 
      `Employee account for ${first_name} ${last_name} was created by ${adminName}.`
    );

    // Notify the new employee
    await db.createNotification(
      newEmp.id,
      'Welcome to i-SOFTZONE',
      `Welcome ${first_name}! Your employee account has been created.`,
      'SYSTEM'
    );

    // Notify HR/Admins
    const hrAdmins = (await db.getEmployees()).filter(e => ['Super Admin', 'Admin', 'HR'].includes(e.role) && e.id !== newEmp.id);
    for (const hrAdmin of hrAdmins) {
      await db.createNotification(
        hrAdmin.id,
        'New Employee Account Created',
        `A new employee account has been created for ${first_name} ${last_name} (${employee_id}).`,
        'SYSTEM'
      );
    }

    const { password: _, ...empNoPass } = newEmp;
    res.status(201).json(empNoPass);
  } catch (err) {
    console.error('createEmployee error:', err);
    res.status(500).json({ message: 'Error registering new employee.' });
  }
}

export async function updateEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    if (req.file) {
      try {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('Failed to clean up uploaded avatar on invalid ID', e);
      }
    }
    res.status(400).json({ message: 'Invalid employee ID.' });
    return;
  }

  const data = { ...req.body };
  delete data.password; // Prevent password updates via simple edit profile

  const userRole = req.user?.role;
  const userId = req.user?.id;
  const isHrOrAdmin = ['Super Admin', 'Admin', 'HR'].includes(userRole || '');

  if (!isHrOrAdmin) {
    if (userId !== id) {
      if (req.file) {
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn('Failed to clean up uploaded avatar on auth failure', e);
        }
      }
      res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
      return;
    }

    const sensitiveFields = ['role', 'status', 'designation', 'employee_id', 'joining_date', 'department_id'];
    for (const field of sensitiveFields) {
      delete data[field];
    }
  }

  try {
    const existing = await db.getEmployeeById(id);
    if (!existing) {
      if (req.file) {
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn('Failed to clean up uploaded avatar on not found', e);
        }
      }
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    // Handle avatar uploads
    if (req.file) {
      const cloudRes = await uploadToCloudinary(req.file.path, 'avatars');
      await db.saveCloudinaryMapping(req.file.filename, cloudRes.secure_url, cloudRes.public_id);
      data.avatar_url = `uploads/${req.file.filename}`;

      // delete old avatar if exists
      if (existing.avatar_url) {
        const oldFilename = existing.avatar_url.replace('uploads/', '');
        const oldMapping = await db.getCloudinaryMapping(oldFilename);
        if (oldMapping) {
          await deleteFromCloudinary(oldMapping.public_id);
          await db.deleteCloudinaryMapping(oldFilename);
        } else {
          try {
            const oldPath = path.resolve(__dirname, '../../../', existing.avatar_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn('Failed to delete old local avatar file', e);
          }
        }
      }
    }

    if (data.department_id) data.department_id = parseInt(data.department_id);

    const updated = await db.updateEmployee(id, data);

    // Skills adjustment (if supplied during edit profile)
    let skillsListUpdate = data.skills;
    if (data.skills && typeof data.skills === 'string') {
      try {
        skillsListUpdate = JSON.parse(data.skills);
      } catch (e) {
        console.error('Failed to parse skills JSON:', e);
      }
    }
    if (skillsListUpdate && Array.isArray(skillsListUpdate)) {
      // Clear old skills first in JSON or it will override
      const currentSkills = await db.getEmployeeSkills(id);
      for (const cs of currentSkills) {
        await db.removeSkill(id, cs.id);
      }
      for (const s of skillsListUpdate) {
        if (s.skill_id) {
          await db.assignSkill(id, parseInt(s.skill_id), s.proficiency_level || 'Intermediate');
        }
      }
    }

    // Log audit activity
    let changesDesc = [];
    if (data.status && data.status !== existing.status) {
      changesDesc.push(`status changed from ${existing.status} to ${data.status}`);
      await db.logActivity(id, 'STATUS_CHANGE', `Employee status updated to ${data.status}.`);
    }
    if (data.designation && data.designation !== existing.designation) {
      changesDesc.push(`designation set to ${data.designation}`);
    }
    
    if (changesDesc.length > 0) {
      await db.logActivity(id, 'EMPLOYEE_UPDATED', `Profile properties modified: ${changesDesc.join(', ')}.`);
    } else {
      await db.logActivity(id, 'EMPLOYEE_UPDATED', `Profile information was updated.`);
    }

    const { password: _, ...empNoPass } = updated!;
    res.json(empNoPass);
  } catch (err) {
    console.error('updateEmployee error:', err);
    res.status(500).json({ message: 'Error updating employee details.' });
  }
}

export async function deleteEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid employee ID.' });
    return;
  }

  // Prevent self deletion
  if (req.user && req.user.id === id) {
    res.status(400).json({ message: 'Self-deletion is not permitted.' });
    return;
  }

  try {
    const existing = await db.getEmployeeById(id);
    if (!existing) {
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    const success = await db.deleteEmployee(id);
    if (!success) {
      res.status(500).json({ message: 'Error deleting employee record.' });
      return;
    }

    // Clean up avatar from Cloudinary or local disk
    if (existing.avatar_url) {
      const oldFilename = existing.avatar_url.replace('uploads/', '');
      const oldMapping = await db.getCloudinaryMapping(oldFilename);
      if (oldMapping) {
        await deleteFromCloudinary(oldMapping.public_id);
        await db.deleteCloudinaryMapping(oldFilename);
      } else {
        try {
          const oldPath = path.resolve(__dirname, '../../../', existing.avatar_url);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (e) {
          console.warn('Failed to delete local avatar file', e);
        }
      }
    }

    res.json({ message: 'Employee record and associated assets removed.' });
  } catch (err) {
    console.error('deleteEmployee error:', err);
    res.status(500).json({ message: 'Error deleting employee record.' });
  }
}

export async function bulkActions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ids, action, value } = req.body; // ids: array of numbers, action: 'delete' | 'status', value: optional

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
    res.status(400).json({ message: 'Invalid bulk parameters.' });
    return;
  }

  try {
    if (action === 'delete') {
      const actualIdsToDelete = req.user ? ids.filter(id => id !== req.user!.id) : ids;
      for (const id of actualIdsToDelete) {
        await db.deleteEmployee(id);
      }
      res.json({ message: `Bulk deleted ${actualIdsToDelete.length} employee records.` });
    } else if (action === 'status') {
      if (!value) {
        res.status(400).json({ message: 'Status value required for bulk status update.' });
        return;
      }
      for (const id of ids) {
        await db.updateEmployee(id, { status: value as EmployeeStatus });
        await db.logActivity(id, 'STATUS_CHANGE', `Employee status bulk-updated to ${value}.`);
      }
      res.json({ message: `Bulk updated status of ${ids.length} records to ${value}.` });
    } else {
      res.status(400).json({ message: 'Invalid bulk action.' });
    }
  } catch (err) {
    console.error('bulkActions error:', err);
    res.status(500).json({ message: 'Error running bulk operation.' });
  }
}

