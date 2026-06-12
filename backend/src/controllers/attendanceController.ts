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

    // Check if there is a pending request before updating
    const requests = await db.getAttendanceCorrectionRequests({ status: 'Pending' });
    const pendingReq = requests.find(r => r.attendance_id === recordId);

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

    // Notify employee about approval / correction
    if (pendingReq) {
      await db.createNotification(
        pendingReq.employee_id,
        'Attendance Correction Approved',
        `Your attendance correction request for ${existingRecord.date} has been approved.`,
        'ATTENDANCE'
      );
    } else {
      await db.createNotification(
        existingRecord.employee_id,
        'Attendance Log Corrected',
        `Your attendance log for ${existingRecord.date} has been corrected by management.`,
        'ATTENDANCE'
      );
    }

    res.json(updated);
  } catch (err) {
    console.error('updateAttendance error:', err);
    res.status(500).json({ message: 'Error updating attendance record.' });
  }
}

export async function submitCorrectionRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const attendanceId = parseInt(req.params.id as string);
  if (isNaN(attendanceId)) {
    res.status(400).json({ message: 'Invalid attendance record ID.' });
    return;
  }

  const { requested_status, requested_check_in, requested_check_out, reason } = req.body;
  if (!requested_status || !reason) {
    res.status(400).json({ message: 'Requested status and reason are required.' });
    return;
  }

  try {
    const allLogs = await db.getAttendanceTeam();
    const record = allLogs.find((l: any) => l.id === attendanceId);

    if (!record) {
      res.status(404).json({ message: 'Attendance record not found.' });
      return;
    }

    if (record.employee_id !== req.user.id && req.user.role === 'Employee') {
      res.status(403).json({ message: 'Forbidden: Cannot request correction for another employee.' });
      return;
    }

    const request = await db.createAttendanceCorrectionRequest(attendanceId, req.user.id, {
      requested_status,
      requested_check_in: requested_check_in || null,
      requested_check_out: requested_check_out || null,
      reason
    });

    const employee = await db.getEmployeeById(req.user.id);
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'An employee';

    const notifTitle = 'Attendance Correction Submitted';
    const notifMsg = `${employeeName} has submitted an attendance correction request for ${record.date}.`;

    // Notify manager
    let notifiedManager = false;
    if (employee && employee.department_id) {
      const dept = await db.getDepartmentById(employee.department_id);
      if (dept && dept.manager_id) {
        await db.createNotification(dept.manager_id, notifTitle, notifMsg, 'ATTENDANCE');
        notifiedManager = true;
      }
    }

    // Notify Admins/HR
    const allEmployees = await db.getEmployees();
    const hrAdmins = allEmployees.filter(e => ['Super Admin', 'Admin', 'HR'].includes(e.role));
    for (const hrAdmin of hrAdmins) {
      if (hrAdmin.id !== req.user.id) {
        await db.createNotification(hrAdmin.id, notifTitle, notifMsg, 'ATTENDANCE');
      }
    }

    res.status(201).json(request);
  } catch (err) {
    console.error('submitCorrectionRequest error:', err);
    res.status(500).json({ message: 'Error submitting attendance correction request.' });
  }
}

export async function rejectCorrectionRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const allowedRoles = ['Super Admin', 'Admin', 'HR', 'Manager'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
    return;
  }

  const requestId = parseInt(req.params.id as string);
  if (isNaN(requestId)) {
    res.status(400).json({ message: 'Invalid request ID.' });
    return;
  }

  const { remarks } = req.body;

  try {
    const requests = await db.getAttendanceCorrectionRequests();
    const request = requests.find(r => r.id === requestId);

    if (!request) {
      res.status(404).json({ message: 'Correction request not found.' });
      return;
    }

    if (request.status !== 'Pending') {
      res.status(400).json({ message: 'Request is already processed.' });
      return;
    }

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (!managedDept || request.employee?.department_id !== managedDept.id) {
        res.status(403).json({ message: 'Forbidden: Managers can only modify records for department members.' });
        return;
      }
    }

    const updatedRequest = await db.rejectAttendanceCorrectionRequest(requestId, remarks || '');

    const allLogs = await db.getAttendanceTeam();
    const attendanceRecord = allLogs.find((l: any) => l.id === request.attendance_id);
    const dateStr = attendanceRecord ? attendanceRecord.date : '';

    await db.createNotification(
      request.employee_id,
      'Attendance Correction Rejected',
      `Your attendance correction request for ${dateStr} has been rejected.${remarks ? ' Remarks: ' + remarks : ''}`,
      'ATTENDANCE'
    );

    res.json(updatedRequest);
  } catch (err) {
    console.error('rejectCorrectionRequest error:', err);
    res.status(500).json({ message: 'Error rejecting attendance correction.' });
  }
}

export async function getCorrectionRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const allowedRoles = ['Super Admin', 'Admin', 'HR', 'Manager'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
    return;
  }

  try {
    const filters: { status?: string; employeeId?: number } = {};
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.employeeId) {
      filters.employeeId = parseInt(req.query.employeeId as string);
    }

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        const list = await db.getAttendanceCorrectionRequests(filters);
        const filtered = list.filter(r => r.employee?.department_id === managedDept.id);
        res.json(filtered);
        return;
      } else {
        res.json([]);
        return;
      }
    }

    const list = await db.getAttendanceCorrectionRequests(filters);
    res.json(list);
  } catch (err) {
    console.error('getCorrectionRequests error:', err);
    res.status(500).json({ message: 'Error retrieving correction requests.' });
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

export async function submitHeartbeat(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { status, mouseClicks, keyboardPresses, activeWindow, screenshotUrl } = req.body;
  if (!status || !['Active', 'Idle', 'Break'].includes(status)) {
    res.status(400).json({ message: 'Valid status (Active, Idle, Break) is required.' });
    return;
  }

  try {
    const attendance = await db.getAttendanceToday(req.user.id);
    if (!attendance) {
      res.status(400).json({ message: 'Not checked in today.' });
      return;
    }

    if (attendance.check_out) {
      res.status(400).json({ message: 'Already checked out for today.' });
      return;
    }

    const hb = await db.addHeartbeat(
      req.user.id,
      attendance.id,
      status,
      mouseClicks || 0,
      keyboardPresses || 0,
      activeWindow || null,
      screenshotUrl || null
    );

    res.status(201).json(hb);
  } catch (err) {
    console.error('submitHeartbeat error:', err);
    res.status(500).json({ message: 'Error saving activity heartbeat.' });
  }
}

const PRODUCTIVITY_RULES = {
  activeWeight: 0.7,
  taskWeight: 0.3,
  taskCompletedBonus: 15,
  maxTaskBonus: 30,
  lateArrivalPenalty: 10,
  breakLimitMinutes: 60,
  breakPenaltyPerQuarterHour: 5
};

export async function getLiveWorkforce(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    let targetDeptId: number | undefined = undefined;

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        targetDeptId = managedDept.id;
      } else {
        res.json({ employees: [], stats: { total: 0, active: 0, idle: 0, break: 0, offline: 0 }, alerts: [] });
        return;
      }
    } else if (req.query.departmentId) {
      targetDeptId = parseInt(req.query.departmentId as string);
    }

    const allEmployees = await db.getEmployees();
    const targetEmployees = allEmployees.filter(e => {
      if (e.status !== 'Active' && e.status !== 'Probation') return false;
      if (targetDeptId !== undefined && e.department_id !== targetDeptId) return false;
      return true;
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const liveDataList: any[] = [];
    const alerts: any[] = [];
    let activeCount = 0;
    let idleCount = 0;
    let breakCount = 0;
    let offlineCount = 0;

    // Performance Optimization: Fetch all tasks and completed tasks today in bulk
    const allDoneTasks = await db.getTasks({ status: 'Done' });
    const todayDoneTasks = allDoneTasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === todayStr);
    const completedTasksMap: Record<number, number> = {};
    todayDoneTasks.forEach((t: any) => {
      if (t.assignee_id) {
        completedTasksMap[t.assignee_id] = (completedTasksMap[t.assignee_id] || 0) + 1;
      }
    });

    for (const emp of targetEmployees) {
      const attendance = await db.getAttendanceToday(emp.id);
      const latestHb = await db.getLatestHeartbeatForEmployee(emp.id);
      const heartbeatsToday = await db.getHeartbeatsForDate(emp.id, todayStr);

      let currentStatus = 'Offline';
      let activeMinutes = 0;
      let idleMinutes = 0;
      let breakMinutes = 0;
      let totalMinutes = 0;
      
      // Consecutive idle checks
      let consecutiveIdleCount = 0;
      let isIdleStreak = true;

      // Reverse loop to check latest idle streak
      for (let i = heartbeatsToday.length - 1; i >= 0; i--) {
        const hb = heartbeatsToday[i];
        if (isIdleStreak && hb.status === 'Idle') {
          consecutiveIdleCount++;
        } else {
          isIdleStreak = false;
        }
        
        if (hb.status === 'Active') activeMinutes += 0.5;
        else if (hb.status === 'Idle') idleMinutes += 0.5;
        else if (hb.status === 'Break') breakMinutes += 0.5;
        totalMinutes += 0.5;
      }

      // 1. Calculate Base Productivity Ratio
      const measuredMinutes = activeMinutes + idleMinutes;
      let baseScore = 100;
      if (measuredMinutes > 0) {
        baseScore = Math.round((activeMinutes / measuredMinutes) * 100);
      }

      // 2. Add Task Completion Bonus
      const completedTaskCount = completedTasksMap[emp.id] || 0;
      const taskBonus = Math.min(PRODUCTIVITY_RULES.maxTaskBonus, completedTaskCount * PRODUCTIVITY_RULES.taskCompletedBonus);

      // 3. Apply Penalties
      let penalties = 0;
      if (attendance && attendance.status === 'Late') {
        penalties += PRODUCTIVITY_RULES.lateArrivalPenalty;
      }
      if (breakMinutes > PRODUCTIVITY_RULES.breakLimitMinutes) {
        const extraBreakMins = breakMinutes - PRODUCTIVITY_RULES.breakLimitMinutes;
        penalties += Math.floor(extraBreakMins / 15) * PRODUCTIVITY_RULES.breakPenaltyPerQuarterHour;
      }

      // Final Score calculation
      const productivityScore = Math.max(0, Math.min(100, Math.round(baseScore * PRODUCTIVITY_RULES.activeWeight + taskBonus - penalties)));

      if (attendance && !attendance.check_out) {
        const now = new Date();
        const lastHbTime = latestHb ? new Date(latestHb.timestamp) : null;
        const diffSeconds = lastHbTime ? (now.getTime() - lastHbTime.getTime()) / 1000 : 9999;

        if (diffSeconds <= 90) {
          currentStatus = latestHb.status;
        } else {
          currentStatus = 'Idle';
        }
      } else {
        currentStatus = 'Offline';
      }

      if (currentStatus === 'Active') activeCount++;
      else if (currentStatus === 'Idle') idleCount++;
      else if (currentStatus === 'Break') breakCount++;
      else offlineCount++;

      const empName = `${emp.first_name} ${emp.last_name}`;

      // SMART ALERTS GENERATOR
      if (attendance && !attendance.check_out) {
        // Late Check-in Alert
        if (attendance.status === 'Late') {
          alerts.push({
            id: `late-${emp.id}-${todayStr}`,
            employeeId: emp.id,
            employeeName: empName,
            avatarUrl: emp.avatar_url,
            type: 'LATE_ARRIVAL',
            severity: 'info',
            message: `${empName} clocked in late at ${new Date(attendance.check_in as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            timestamp: attendance.check_in
          });
        }

        // Excessive Idle Alert (>15 minutes)
        if (currentStatus === 'Idle' && consecutiveIdleCount * 0.5 > 15) {
          alerts.push({
            id: `idle-${emp.id}-${Date.now()}`,
            employeeId: emp.id,
            employeeName: empName,
            avatarUrl: emp.avatar_url,
            type: 'EXCESSIVE_IDLE',
            severity: 'warning',
            message: `${empName} has been idle for ${Math.round(consecutiveIdleCount * 0.5)} minutes.`,
            timestamp: latestHb ? latestHb.timestamp : new Date().toISOString()
          });
        }

        // Long Break Alert (>60 minutes)
        if (breakMinutes > PRODUCTIVITY_RULES.breakLimitMinutes) {
          alerts.push({
            id: `break-${emp.id}-${todayStr}`,
            employeeId: emp.id,
            employeeName: empName,
            avatarUrl: emp.avatar_url,
            type: 'LONG_BREAK',
            severity: 'warning',
            message: `${empName} has exceeded their break limit (Break Time: ${Math.round(breakMinutes)} mins).`,
            timestamp: new Date().toISOString()
          });
        }

        // Low Productivity Alert (<50% after 1 hour of tracked work)
        if (totalMinutes >= 60 && productivityScore < 50) {
          alerts.push({
            id: `productivity-${emp.id}-${todayStr}`,
            employeeId: emp.id,
            employeeName: empName,
            avatarUrl: emp.avatar_url,
            type: 'LOW_PRODUCTIVITY',
            severity: 'error',
            message: `${empName} has a critically low productivity score of ${productivityScore}%.`,
            timestamp: new Date().toISOString()
          });
        }
      }

      liveDataList.push({
        id: emp.id,
        employee_id: emp.employee_id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        designation: emp.designation,
        email: emp.email,
        avatar_url: emp.avatar_url,
        currentStatus,
        lastActive: latestHb ? latestHb.timestamp : null,
        activeWindow: latestHb && currentStatus !== 'Offline' ? latestHb.active_window : null,
        todayStats: {
          activeHours: parseFloat((activeMinutes / 60).toFixed(2)),
          idleHours: parseFloat((idleMinutes / 60).toFixed(2)),
          breakHours: parseFloat((breakMinutes / 60).toFixed(2)),
          totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
          productivityScore
        }
      });
    }

    res.json({
      employees: liveDataList,
      stats: {
        total: targetEmployees.length,
        active: activeCount,
        idle: idleCount,
        break: breakCount,
        offline: offlineCount
      },
      alerts
    });
  } catch (err) {
    console.error('getLiveWorkforce error:', err);
    res.status(500).json({ message: 'Error fetching live workforce status.' });
  }
}

export async function getProductivityDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  let employeeId = req.user.id;
  if (req.query.employeeId) {
    const parsedId = parseInt(req.query.employeeId as string);
    if (!isNaN(parsedId)) {
      employeeId = parsedId;
    }
  }

  if (req.user.role === 'Employee' && req.user.id !== employeeId) {
    res.status(403).json({ message: 'Forbidden: Cannot access other employee\'s productivity.' });
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const dateStr = (req.query.date as string) || todayStr;

  try {
    if (req.user.role === 'Manager' && req.user.id !== employeeId) {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      const targetEmp = await db.getEmployeeById(employeeId);
      if (!managedDept || !targetEmp || targetEmp.department_id !== managedDept.id) {
        res.status(403).json({ message: 'Forbidden: Managers can only view department members\' productivity.' });
        return;
      }
    }

    const heartbeats = await db.getHeartbeatsForDate(employeeId, dateStr);
    const attendanceRecord = await db.getAttendanceToday(employeeId);
    
    // Calculate Today's stats using updated logic
    let activeMinutes = 0;
    let idleMinutes = 0;
    let breakMinutes = 0;
    heartbeats.forEach(h => {
      if (h.status === 'Active') activeMinutes += 0.5;
      else if (h.status === 'Idle') idleMinutes += 0.5;
      else if (h.status === 'Break') breakMinutes += 0.5;
    });

    const measuredMinutes = activeMinutes + idleMinutes;
    let baseScore = 100;
    if (measuredMinutes > 0) {
      baseScore = Math.round((activeMinutes / measuredMinutes) * 100);
    }

    // Fetch done tasks for completed count
    const tasks = await db.getTasks({ assigneeId: employeeId, status: 'Done' });
    const completedToday = tasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === dateStr);
    const taskBonus = Math.min(PRODUCTIVITY_RULES.maxTaskBonus, completedToday.length * PRODUCTIVITY_RULES.taskCompletedBonus);

    let penalties = 0;
    if (attendanceRecord && attendanceRecord.status === 'Late') {
      penalties += PRODUCTIVITY_RULES.lateArrivalPenalty;
    }
    if (breakMinutes > PRODUCTIVITY_RULES.breakLimitMinutes) {
      const extraBreakMins = breakMinutes - PRODUCTIVITY_RULES.breakLimitMinutes;
      penalties += Math.floor(extraBreakMins / 15) * PRODUCTIVITY_RULES.breakPenaltyPerQuarterHour;
    }

    const productivityScore = Math.max(0, Math.min(100, Math.round(baseScore * PRODUCTIVITY_RULES.activeWeight + taskBonus - penalties)));

    // Generate Weekly History (last 7 days)
    const weeklySummary: any[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const hbs = await db.getHeartbeatsForDate(employeeId, dStr);

      let actMins = 0;
      let idlMins = 0;
      let brkMins = 0;
      hbs.forEach(h => {
        if (h.status === 'Active') actMins += 0.5;
        else if (h.status === 'Idle') idlMins += 0.5;
        else if (h.status === 'Break') brkMins += 0.5;
      });

      const measMins = actMins + idlMins;
      let dayBaseScore = 100;
      if (measMins > 0) {
        dayBaseScore = Math.round((actMins / measMins) * 100);
      }

      const completedOnDay = tasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === dStr);
      const dayTaskBonus = Math.min(PRODUCTIVITY_RULES.maxTaskBonus, completedOnDay.length * PRODUCTIVITY_RULES.taskCompletedBonus);

      // We won't penalize historical late/breaks heavily without full logs, but let's calculate reasonably
      let dayPenalties = 0;
      if (brkMins > PRODUCTIVITY_RULES.breakLimitMinutes) {
        const extraMins = brkMins - PRODUCTIVITY_RULES.breakLimitMinutes;
        dayPenalties += Math.floor(extraMins / 15) * PRODUCTIVITY_RULES.breakPenaltyPerQuarterHour;
      }

      const dayScore = Math.max(0, Math.min(100, Math.round(dayBaseScore * PRODUCTIVITY_RULES.activeWeight + dayTaskBonus - dayPenalties)));

      weeklySummary.push({
        date: dStr,
        activeHours: parseFloat((actMins / 60).toFixed(2)),
        idleHours: parseFloat((idlMins / 60).toFixed(2)),
        breakHours: parseFloat((brkMins / 60).toFixed(2)),
        productivityScore: dayScore
      });
    }

    res.json({
      date: dateStr,
      heartbeats,
      summary: {
        activeHours: parseFloat((activeMinutes / 60).toFixed(2)),
        idleHours: parseFloat((idleMinutes / 60).toFixed(2)),
        breakHours: parseFloat((breakMinutes / 60).toFixed(2)),
        totalHours: parseFloat(((activeMinutes + idleMinutes + breakMinutes) / 60).toFixed(2)),
        productivityScore
      },
      weeklySummary
    });
  } catch (err) {
    console.error('getProductivityDetails error:', err);
    res.status(500).json({ message: 'Error retrieving productivity details.' });
  }
}
