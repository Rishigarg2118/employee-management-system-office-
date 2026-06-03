import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_hrms_super_secure_jwt_secret_key_2026';

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  try {
    const employee = await db.getEmployeeByEmail(email);
    if (!employee) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    if (employee.status === 'Inactive') {
      res.status(403).json({ message: 'Account is deactivated. Contact HR admin.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, employee.password || '');
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = employee;

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
}

export async function setup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { first_name, last_name, email, password } = req.body;

  try {
    const employees = await db.getEmployees();
    
    // Setup is only allowed if there are no registered employees in the system
    if (employees.length > 0) {
      res.status(400).json({ message: 'System setup is already completed. Please log in.' });
      return;
    }

    if (!first_name || !last_name || !email || !password) {
      res.status(400).json({ message: 'All fields are required for setup.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 1. Create Default Engineering Department
    const defaultDept = await db.createDepartment('Executive Board', 'EXEC', 'HQ and Executive Management');

    // 2. Create Admin Employee
    const admin = await db.createEmployee({
      employee_id: 'EMP-001',
      first_name,
      last_name,
      email,
      password: hashedPassword,
      designation: 'Managing Director / CEO',
      status: 'Active',
      joining_date: new Date().toISOString().split('T')[0],
      role: 'Admin',
      phone: '+1 (555) 000-1111',
      bio: 'System Administrator & Managing Director.',
      department_id: defaultDept.id
    });

    await db.logActivity(admin.id, 'EMPLOYEE_CREATED', `Administrator ${first_name} ${last_name} configured the system.`);

    res.status(201).json({
      message: 'System initialized successfully. Please log in.',
      admin: { id: admin.id, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ message: 'Internal server error during setup.' });
  }
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const employee = await db.getEmployeeById(req.user.id);
    if (!employee) {
      res.status(404).json({ message: 'Employee profile not found.' });
      return;
    }

    const { password: _, ...userWithoutPassword } = employee;
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Profile fetching error:', err);
    res.status(500).json({ message: 'Internal server error fetching user.' });
  }
}
