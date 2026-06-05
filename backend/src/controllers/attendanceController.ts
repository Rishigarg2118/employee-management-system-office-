import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { AttendanceStatus } from '../types';

// Helper to determine if a check-in is late (past 9:30 AM)
function isLateCheckIn(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return hours > 9 || (hours === 9 && minutes > 30);
}

export async function checkIn(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { status, remarks } = req.body;

  try {
    // Determine check-in status
    let checkInStatus: AttendanceStatus = 'Present';
    
    if (status === 'Work From Home') {
      checkInStatus = 'Work From Home';
    } else if (status === 'Half Day') {
      checkInStatus = 'Half Day';
    } else if (isLateCheckIn()) {
      checkInStatus = 'Late';
    }

    const record = await db.checkIn(req.user.id, checkInStatus, remarks);
    await db.logActivity(
      req.user.id,
      'ATTENDANCE_CHECK_IN',
      `Checked in today as ${checkInStatus}.${remarks ? ' Remarks: ' + remarks : ''}`
    );

    res.status(201).json(record);
  } catch (err) {
    console.error('checkIn error:', err);
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error checking in.' });
  }
}

export async function checkOut(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const record = await db.checkOut(req.user.id);
    await db.logActivity(
      req.user.id,
      'ATTENDANCE_CHECK_OUT',
      `Checked out today. Total hours worked: ${record.working_hours} hours.`
    );
    res.json(record);
  } catch (err) {
    console.error('checkOut error:', err);
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error checking out.' });
  }
}

export async function getAttendanceToday(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const record = await db.getAttendanceToday(req.user.id);
    res.json(record);
  } catch (err) {
    console.error('getAttendanceToday error:', err);
    res.status(500).json({ message: 'Error retrieving today\'s attendance.' });
  }
}

export async function getAttendanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const records = await db.getAttendanceHistory(req.user.id);
    res.json(records);
  } catch (err) {
    console.error('getAttendanceHistory error:', err);
    res.status(500).json({ message: 'Error retrieving attendance history.' });
  }
}

export async function getEmployeeAttendanceHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const employeeId = parseInt(req.params.employeeId as string);
  if (isNaN(employeeId)) {
    res.status(400).json({ message: 'Invalid employee ID.' });
    return;
  }

  if (req.user.role === 'Employee' && req.user.id !== employeeId) {
    res.status(403).json({ message: 'Forbidden: Employees cannot view other employees\' attendance.' });
    return;
  }

  try {
    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      const targetEmp = await db.getEmployeeById(employeeId);
      if (!managedDept || !targetEmp || targetEmp.department_id !== managedDept.id) {
        res.status(403).json({ message: 'Forbidden: Managers can only view department members\' attendance.' });
        return;
      }
    }

    const records = await db.getAttendanceHistory(employeeId);
    res.json(records);
  } catch (err) {
    console.error('getEmployeeAttendanceHistory error:', err);
    res.status(500).json({ message: 'Error retrieving employee attendance history.' });
  }
}

export async function getAttendanceTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (req.user.role === 'Employee') {
    res.status(403).json({ message: 'Forbidden: Access restricted to management.' });
    return;
  }

  try {
    const filters: { departmentId?: number; employeeId?: number; startDate?: string; endDate?: string } = {};

    if (req.query.employeeId) {
      filters.employeeId = parseInt(req.query.employeeId as string);
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate as string;
    }

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        filters.departmentId = managedDept.id;
      } else {
        res.json([]);
        return;
      }
    } else if (req.query.departmentId) {
      filters.departmentId = parseInt(req.query.departmentId as string);
    }

    const list = await db.getAttendanceTeam(filters);
    res.json(list);
  } catch (err) {
    console.error('getAttendanceTeam error:', err);
    res.status(500).json({ message: 'Error retrieving team attendance logs.' });
  }
}

export async function updateAttendance(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (req.user.role === 'Employee') {
    res.status(403).json({ message: 'Forbidden: Corrections restricted to management.' });
    return;
  }

  const recordId = parseInt(req.params.id as string);
  if (isNaN(recordId)) {
    res.status(400).json({ message: 'Invalid attendance record ID.' });
    return;
  }

  const { status, check_in, check_out, remarks } = req.body;

  try {
    // Lookup the record to verify Manager's department access
    const allLogs = await db.getAttendanceTeam();
    const existingRecord = allLogs.find((l: any) => l.id === recordId);

    if (!existingRecord) {
      res.status(404).json({ message: 'Attendance record not found.' });
      return;
    }

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (!managedDept || existingRecord.employee?.department_id !== managedDept.id) {
        res.status(403).json({ message: 'Forbidden: Managers can only modify records for department members.' });
        return;
      }
    }

    const updated = await db.updateAttendance(recordId, {
      status,
      check_in: check_in || null,
      check_out: check_out || null,
      remarks: remarks || null
    });

    await db.logActivity(
      req.user.id,
      'ATTENDANCE_CORRECTED',
      `Corrected attendance log ID ${recordId} (Employee ID: ${existingRecord.employee_id}) to status: ${status}.`
    );

    res.json(updated);
  } catch (err) {
    console.error('updateAttendance error:', err);
    res.status(500).json({ message: 'Error updating attendance record.' });
  }
}

export async function getAttendanceAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (req.user.role === 'Employee') {
    res.status(403).json({ message: 'Forbidden: Analytics restricted to management.' });
    return;
  }

  try {
    const filters: { departmentId?: number; employeeId?: number } = {};

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        filters.departmentId = managedDept.id;
      } else {
        filters.departmentId = -1; // Restrict manager if they don't have department
      }
    } else if (req.query.departmentId) {
      filters.departmentId = parseInt(req.query.departmentId as string);
    }

    if (req.query.employeeId) {
      filters.employeeId = parseInt(req.query.employeeId as string);
    }

    const analytics = await db.getAttendanceAnalytics(filters);
    res.json(analytics);
  } catch (err) {
    console.error('getAttendanceAnalytics error:', err);
    res.status(500).json({ message: 'Error retrieving attendance analytics.' });
  }
}
