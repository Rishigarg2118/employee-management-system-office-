import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { verifyGoogleToken } from '../middleware/googleAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_hrms_super_secure_jwt_secret_key_2026';

// Persistent database-backed sessions are used instead of in-memory activeSessions Set.

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

    // Generate Access & Refresh tokens
    const accessToken = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token session to database
    await db.addSession(employee.id, refreshToken, new Date(Date.now() + 7 * 24 * 3600 * 1000));

    // Remove password from response
    const { password: _, ...userWithoutPassword } = employee;

    res.json({
      token: accessToken, // Keep key name "token" for frontend compatibility or send separately
      refreshToken,
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

export async function refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token is required.' });
    return;
  }

  const sessionExists = await db.hasSession(refreshToken);
  
  if (!sessionExists) {
    // RTR Theft Detection: If token is valid but session does not exist, it was previously rotated.
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      await db.revokeAllSessionsForEmployee(decoded.id);
      await db.logActivity(
        decoded.id, 
        'SECURITY_ALERT', 
        `Potential Token Theft Detected: Rotated refresh token was reused. All active sessions for user have been revoked.`
      );
      res.status(401).json({ message: 'Security Alert: Unauthorized session reuse detected. Session terminated.' });
      return;
    } catch {
      res.status(401).json({ message: 'Invalid or expired refresh session.' });
      return;
    }
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    
    // Check if employee still exists and is Active
    const employee = await db.getEmployeeById(decoded.id);
    if (!employee || employee.status === 'Inactive') {
      await db.removeSession(refreshToken);
      res.status(403).json({ message: 'Access denied. Employee status is inactive.' });
      return;
    }

    // Generate new Access & Refresh tokens (token rotation)
    const newAccessToken = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Rotate refresh token
    await db.removeSession(refreshToken);
    await db.addSession(employee.id, newRefreshToken, new Date(Date.now() + 7 * 24 * 3600 * 1000));

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    await db.removeSession(refreshToken);
    res.status(403).json({ message: 'Refresh session expired or invalid.' });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.removeSession(refreshToken);
  }
  res.json({ message: 'Logged out successfully.' });
}

export async function systemStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employees = await db.getEmployees();
    res.json({
      initialized: employees.length > 0
    });
  } catch (err) {
    console.error('System status check error:', err);
    res.status(500).json({ message: 'Error checking system initialization status.' });
  }
}

export async function googleLogin(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ message: 'Google ID Token is required.' });
    return;
  }

  try {
    const payload = await verifyGoogleToken(idToken);
    if (!payload || !payload.email) {
      res.status(401).json({ message: 'Invalid Google Identity token.' });
      return;
    }

    let employee = await db.getEmployeeByEmail(email);

    if (!employee) {
      // Auto-register employee if not registered in HRMS
      const depts = await db.getDepartments();
      const defaultDeptId = depts.length > 0 ? depts[0].id : null;
      
      const newEmpId = 'EMP-G' + Math.floor(1000 + Math.random() * 9000);
      employee = await db.createEmployee({
        employee_id: newEmpId,
        first_name: payload.given_name || payload.name?.split(' ')[0] || 'Google',
        last_name: payload.family_name || payload.name?.split(' ')[1] || 'User',
        email,
        password: '', // no local password needed for Google SSO
        designation: 'Staff Associate',
        status: 'Active',
        joining_date: new Date().toISOString().split('T')[0],
        role: 'Employee',
        phone: '',
        bio: 'Google OAuth auto-registered user.',
        department_id: defaultDeptId
      });
      await db.logActivity(employee.id, 'EMPLOYEE_CREATED', `Google OAuth user ${email} auto-registered upon login.`);
    }

    if (employee.status === 'Inactive') {
      res.status(403).json({ message: 'Account is deactivated. Contact HR admin.' });
      return;
    }

    // Generate Access & Refresh tokens
    const accessToken = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token session to database
    await db.addSession(employee.id, newRefreshToken, new Date(Date.now() + 7 * 24 * 3600 * 1000));

    // Remove password from response
    const { password: _, ...userWithoutPassword } = employee;

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      user: userWithoutPassword
    });
  } catch (err: any) {
    console.error('Google Login verification error:', err);
    res.status(500).json({ message: 'Internal server error verifying Google credentials.' });
  }
}
