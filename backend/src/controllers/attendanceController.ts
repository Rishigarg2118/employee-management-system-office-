import { Response } from 'express';
import zlib from 'zlib';
import { db } from '../config/db';
import { telemetryQueue } from '../config/telemetryQueue';
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

    // Buffer heartbeat packet to the async bulk-insert queue
    telemetryQueue.enqueue({
      employeeId: req.user.id,
      attendanceId: attendance.id,
      status,
      mouseClicks: mouseClicks || 0,
      keyboardPresses: keyboardPresses || 0,
      activeWindow: activeWindow || undefined,
      screenshotUrl: screenshotUrl || undefined,
      timestamp: new Date().toISOString()
    });

    res.status(202).json({ message: 'Heartbeat enqueued successfully for bulk sync.' });
  } catch (err) {
    console.error('submitHeartbeat error:', err);
    res.status(500).json({ message: 'Error enqueuing activity heartbeat.' });
  }
}

export async function bulkSyncHeartbeats(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { compressedData } = req.body;
  if (!compressedData) {
    res.status(400).json({ message: 'compressedData is required' });
    return;
  }

  try {
    const compressedBuffer = Buffer.from(compressedData, 'base64');
    const decompressedJson = zlib.gunzipSync(compressedBuffer).toString('utf-8');
    const packetList = JSON.parse(decompressedJson);

    const attendance = await db.getAttendanceToday(req.user.id);
    if (!attendance) {
      res.status(400).json({ message: 'Not checked in today.' });
      return;
    }

    // Map packets to schema names and execute bulk insert statement
    const mapped = packetList.map((packet: any) => ({
      employee_id: req.user!.id,
      attendance_id: attendance.id,
      status: packet.status || 'Active',
      mouse_clicks: packet.mouseClicks || 0,
      keyboard_presses: packet.keyboardPresses || 0,
      active_window: packet.activeWindow || null,
      screenshot_url: packet.screenshotUrl || null,
      timestamp: packet.timestamp || new Date().toISOString()
    }));

    const saved = await db.addHeartbeatsBulk(mapped);
    res.status(201).json({ count: saved.length });
  } catch (err) {
    console.error('bulkSyncHeartbeats error:', err);
    res.status(500).json({ message: 'Error processing bulk heartbeats sync.' });
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

function getHeartbeatClassification(activeWindow: string | null | undefined, rules: any[]) {
  if (!activeWindow) return { category: 'Neutral', tag: 'Research', score: 80 };
  
  const labelLower = activeWindow.toLowerCase();
  let bestMatch: any = null;
  
  for (const rule of rules) {
    const pat = rule.pattern.toLowerCase();
    if (labelLower.includes(pat)) {
      if (!bestMatch || pat.length > bestMatch.pattern.length) {
        bestMatch = rule;
      }
    }
  }
  
  if (bestMatch) {
    return {
      category: bestMatch.category,
      tag: bestMatch.tag,
      score: bestMatch.score
    };
  }
  
  const labelLowerClean = labelLower.trim();
  if (labelLowerClean.includes('code') || labelLowerClean.includes('vs code') || labelLowerClean.includes('editor')) {
    return { category: 'Productive', tag: 'Deep Work', score: 100 };
  }
  return { category: 'Neutral', tag: 'Research', score: 80 };
}

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

    const allDepts = await db.getDepartments();
    const allEmployees = await db.getEmployees();
    const targetEmployees = allEmployees.filter(e => {
      if (e.status !== 'Active' && e.status !== 'Probation') return false;
      if (targetDeptId !== undefined && e.department_id !== targetDeptId) return false;
      return true;
    }).map(e => {
      const dept = allDepts.find(d => d.id === e.department_id);
      const manager = dept && dept.manager_id ? allEmployees.find(m => m.id === dept.manager_id) : null;
      return {
        ...e,
        department: dept || null,
        manager: manager || null
      };
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

    const rules = await db.getProductivityClassifications();

    for (const emp of targetEmployees) {
      const attendance = await db.getAttendanceToday(emp.id);
      const latestHb = await db.getLatestHeartbeatForEmployee(emp.id);
      const heartbeatsToday = await db.getHeartbeatsForDate(emp.id, todayStr);

      let currentStatus = 'Offline';
      let activeMinutes = 0;
      let idleMinutes = 0;
      let breakMinutes = 0;
      let totalMinutes = 0;
      let deepWorkMinutes = 0;
      let totalActiveScoreSum = 0;
      let activeHeartbeatCount = 0;
      
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
        
        if (hb.status === 'Active') {
          activeMinutes += 0.5;
          const classification = getHeartbeatClassification(hb.active_window || hb.activeWindow, rules);
          totalActiveScoreSum += classification.score;
          activeHeartbeatCount++;
          if (classification.category === 'Productive' && classification.tag === 'Deep Work') {
            deepWorkMinutes += 0.5;
          }
        }
        else if (hb.status === 'Idle') idleMinutes += 0.5;
        else if (hb.status === 'Break') breakMinutes += 0.5;
        totalMinutes += 0.5;
      }

      // Calculate Focus Score
      const focusScore = activeHeartbeatCount > 0 ? Math.round(totalActiveScoreSum / activeHeartbeatCount) : 100;
      const activePct = totalMinutes > 0 ? Math.round((activeMinutes / totalMinutes) * 100) : 0;
      const idlePct = totalMinutes > 0 ? Math.round((idleMinutes / totalMinutes) * 100) : 0;
      const breakPct = totalMinutes > 0 ? Math.round((breakMinutes / totalMinutes) * 100) : 0;

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
      const productivityScore = Math.max(0, Math.min(100, Math.round(focusScore * PRODUCTIVITY_RULES.activeWeight + taskBonus - penalties)));

      // Fetch weekly and monthly historical aggregates
      const date7DaysAgo = new Date();
      date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
      const date7DaysAgoStr = date7DaysAgo.toISOString().split('T')[0];

      const date30DaysAgo = new Date();
      date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
      const date30DaysAgoStr = date30DaysAgo.toISOString().split('T')[0];

      const heartbeatsPastMonth = await db.getHeartbeatsForRange(emp.id, date30DaysAgoStr, todayStr);
      let weeklyScoreSum = 0;
      let weeklyCount = 0;
      let monthlyScoreSum = 0;
      let monthlyCount = 0;

      heartbeatsPastMonth.forEach((hb: any) => {
        if (hb.status === 'Active') {
          const classification = getHeartbeatClassification(hb.active_window || hb.activeWindow, rules);
          const hbDate = new Date(hb.timestamp).getTime();
          
          monthlyScoreSum += classification.score;
          monthlyCount++;

          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - hbDate <= sevenDaysMs) {
            weeklyScoreSum += classification.score;
            weeklyCount++;
          }
        }
      });

      const dailyScore = focusScore;
      const weeklyScore = weeklyCount > 0 ? Math.round(weeklyScoreSum / weeklyCount) : focusScore;
      const monthlyScore = monthlyCount > 0 ? Math.round(monthlyScoreSum / monthlyCount) : focusScore;

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
        department: (emp as any).department ? (emp as any).department.name : 'Unassigned',
        manager: (emp as any).manager ? `${(emp as any).manager.first_name} ${(emp as any).manager.last_name}` : 'No Manager',
        todayStats: {
          activeHours: parseFloat((activeMinutes / 60).toFixed(2)),
          idleHours: parseFloat((idleMinutes / 60).toFixed(2)),
          breakHours: parseFloat((breakMinutes / 60).toFixed(2)),
          totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
          productivityScore: productivityScore,
          focusScore,
          deepWorkMinutes: Math.round(deepWorkMinutes),
          activePercentage: activePct,
          idlePercentage: idlePct,
          breakPercentage: breakPct,
          dailyScore,
          weeklyScore,
          monthlyScore,
          machineName: latestHb ? (latestHb.machine_name || latestHb.machineName || 'Workstation') : 'Workstation'
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
    res.status(500).json({ message: 'Error retrieving live workforce command metrics.' });
  }
}

function parseDomain(windowTitle: string | null): string | null {
  if (!windowTitle) return null;
  const match = windowTitle.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

function classifyAppOrDomainDynamic(windowTitle: string | null, classifications: any[]): 'Productive' | 'Unproductive' | 'Neutral' {
  if (!windowTitle) return 'Neutral';
  const val = windowTitle.toLowerCase();
  
  const match = classifications.find(c => val.includes(c.pattern));
  if (match) {
    return match.category;
  }

  const productivePatterns = [
    'code.exe', 'vscode', 'idea64.exe', 'visual studio', 'slack', 'teams.exe', 
    'slack.exe', 'cmd.exe', 'powershell.exe', 'git', 'docker', 'github.com', 
    'stackoverflow.com', 'figma.com', 'localhost', 'enterprise.io', 'excel.exe', 
    'word.exe', 'powerpnt.exe', 'outlook.exe', 'postman.exe', 'chrome.exe - google search'
  ];
  
  const unproductivePatterns = [
    'youtube.com', 'facebook.com', 'reddit.com', 'twitter.com', 'instagram.com', 
    'netflix.com', 'steam.exe', 'game.exe', 'discord.exe', 'roblox', 'tiktok.com'
  ];

  if (productivePatterns.some(p => val.includes(p))) {
    return 'Productive';
  }
  if (unproductivePatterns.some(p => val.includes(p))) {
    return 'Unproductive';
  }
  return 'Neutral';
}

function calculateProductivityMetrics(
  heartbeats: any[], 
  completedTasksCount: number, 
  isLate: boolean,
  breakLimitMinutes: number = 60,
  classifications: any[] = []
) {
  let activeIntervals = 0;
  let idleIntervals = 0;
  let breakIntervals = 0;
  let totalInputs = 0;
  let contextSwitches = 0;
  
  const appDurations: { [app: string]: number } = {};
  const webDurations: { [web: string]: number } = {};
  
  const hourlySums = Array(24).fill(0);
  const hourlyCounts = Array(24).fill(0);
  
  let prevWindow: string | null = null;
  
  const sortedHbs = [...heartbeats].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  sortedHbs.forEach((h) => {
    const status = h.status || 'Active';
    const activeWindow = h.active_window || h.activeWindow || null;
    const clicks = h.mouse_clicks || h.mouseClicks || 0;
    const presses = h.keyboard_presses || h.keyboardPresses || 0;
    const inputs = clicks + presses;
    totalInputs += inputs;
    
    const hDate = new Date(h.timestamp);
    const hour = hDate.getHours();
    
    const category = classifyAppOrDomainDynamic(activeWindow, classifications);
    let appName = 'Unknown';
    if (activeWindow) {
      const parts = activeWindow.split(' - ');
      appName = parts[parts.length - 1] || activeWindow;
    }
    
    const domain = parseDomain(activeWindow);
    
    if (status === 'Active') {
      activeIntervals++;
      appDurations[appName] = (appDurations[appName] || 0) + 0.5;
      if (domain) {
        webDurations[domain] = (webDurations[domain] || 0) + 0.5;
      }
    } else if (status === 'Idle') {
      idleIntervals++;
    } else if (status === 'Break') {
      breakIntervals++;
    }
    
    if (activeWindow && prevWindow && activeWindow.toLowerCase() !== prevWindow.toLowerCase()) {
      contextSwitches++;
    }
    if (activeWindow) {
      prevWindow = activeWindow;
    }
    
    if (status !== 'Break') {
      const weight = category === 'Productive' ? 1.0 : (category === 'Neutral' ? 0.5 : 0.0);
      const density = Math.min(1.0, inputs / 30);
      const score = weight * density * 100;
      hourlySums[hour] += score;
      hourlyCounts[hour]++;
    }
  });
  
  const measuredIntervals = activeIntervals + idleIntervals;
  const totalIntervals = measuredIntervals + breakIntervals;
  
  const activeHours = parseFloat((activeIntervals / 120).toFixed(2));
  const idleHours = parseFloat((idleIntervals / 120).toFixed(2));
  const breakHours = parseFloat((breakIntervals / 120).toFixed(2));
  const totalHours = parseFloat((totalIntervals / 120).toFixed(2));
  
  const idlePercentage = totalIntervals > 0 ? parseFloat(((idleIntervals / totalIntervals) * 100).toFixed(1)) : 0;
  const breakPercentage = totalIntervals > 0 ? parseFloat(((breakIntervals / totalIntervals) * 100).toFixed(1)) : 0;
  
  let baseScoreSum = 0;
  sortedHbs.forEach(h => {
    if (h.status !== 'Break') {
      const activeWindow = h.active_window || h.activeWindow || null;
      const clicks = h.mouse_clicks || h.mouseClicks || 0;
      const presses = h.keyboard_presses || h.keyboardPresses || 0;
      const inputs = clicks + presses;
      const category = classifyAppOrDomainDynamic(activeWindow, classifications);
      const weight = category === 'Productive' ? 1.0 : (category === 'Neutral' ? 0.5 : 0.0);
      const density = Math.min(1.0, inputs / 30);
      baseScoreSum += weight * density;
    }
  });
  
  let productivityScore = 0;
  if (measuredIntervals > 0) {
    const baseScore = (baseScoreSum / measuredIntervals) * 100;
    
    const taskBonus = Math.min(15, completedTasksCount * 5);
    
    let penalties = 0;
    if (isLate) penalties += 10;
    const breakMinutes = breakIntervals * 0.5;
    if (breakMinutes > breakLimitMinutes) {
      const extraBreak = breakMinutes - breakLimitMinutes;
      penalties += Math.floor(extraBreak / 15) * 5;
    }
    
    productivityScore = Math.round(Math.max(0, Math.min(100, baseScore + taskBonus - penalties)));
  }
  
  let focusBlocksCount = 0;
  const windowSize = 30; 
  for (let i = 0; i <= sortedHbs.length - windowSize; i += windowSize) {
    const slice = sortedHbs.slice(i, i + windowSize);
    let sliceActiveIdle = 0;
    let sliceProductive = 0;
    let sliceUnproductive = 0;
    let sliceIdle = 0;
    let slicePrevWin: string | null = null;
    let sliceSwitches = 0;
    
    slice.forEach(h => {
      const status = h.status || 'Active';
      const activeWindow = h.active_window || h.activeWindow || null;
      if (status === 'Active' || status === 'Idle') {
        sliceActiveIdle++;
        const category = classifyAppOrDomainDynamic(activeWindow, classifications);
        if (category === 'Productive') sliceProductive++;
        if (category === 'Unproductive') sliceUnproductive++;
        if (status === 'Idle') sliceIdle++;
        
        if (activeWindow && slicePrevWin && activeWindow.toLowerCase() !== slicePrevWin.toLowerCase()) {
          sliceSwitches++;
        }
        if (activeWindow) slicePrevWin = activeWindow;
      }
    });
    
    if (sliceActiveIdle >= 10) {
      const productiveRatio = sliceProductive / sliceActiveIdle;
      if (productiveRatio >= 0.8 && sliceUnproductive === 0 && sliceIdle <= 6) {
        focusBlocksCount++;
      }
    }
  }
  
  const workingMinutes = measuredIntervals * 0.5;
  const focusScore = workingMinutes > 0 ? Math.round(Math.min(100, (focusBlocksCount * 15 / workingMinutes) * 100)) : 0;
  
  const inputRate = activeIntervals > 0 ? (totalInputs / (activeIntervals * 0.5)) : 0;
  const inputMultiplier = Math.min(1.0, inputRate / 40);
  const idleRatio = measuredIntervals > 0 ? (idleIntervals / measuredIntervals) : 0;
  const deepWorkScore = Math.round(focusScore * (1.0 - idleRatio) * inputMultiplier);
  
  const workingHours = measuredIntervals / 120;
  const switchesPerHour = workingHours > 0 ? (contextSwitches / workingHours) : 0;
  const efficiencyScore = Math.round(productivityScore * (1.0 - Math.min(0.40, switchesPerHour / 50)));
  
  const timeline: any[] = [];
  for (let i = 0; i < sortedHbs.length; i += windowSize) {
    const slice = sortedHbs.slice(i, i + windowSize);
    if (slice.length === 0) continue;
    
    const startStr = slice[0].timestamp;
    const endStr = slice[slice.length - 1].timestamp;
    
    let activeC = 0, idleC = 0, breakC = 0, inputC = 0;
    const appFreq: { [app: string]: number } = {};
    const webFreq: { [web: string]: number } = {};
    
    slice.forEach(h => {
      const status = h.status || 'Active';
      const activeWindow = h.active_window || h.activeWindow || null;
      const clicks = h.mouse_clicks || h.mouseClicks || 0;
      const presses = h.keyboard_presses || h.keyboardPresses || 0;
      inputC += (clicks + presses);
      
      if (status === 'Active') {
        activeC++;
        if (activeWindow) {
          const parts = activeWindow.split(' - ');
          const app = parts[parts.length - 1] || activeWindow;
          appFreq[app] = (appFreq[app] || 0) + 1;
          const dom = parseDomain(activeWindow);
          if (dom) webFreq[dom] = (webFreq[dom] || 0) + 1;
        }
      } else if (status === 'Idle') {
        idleC++;
      } else {
        breakC++;
      }
    });
    
    let dominantApp = 'None';
    let maxAppCount = 0;
    for (const app in appFreq) {
      if (appFreq[app] > maxAppCount) {
        maxAppCount = appFreq[app];
        dominantApp = app;
      }
    }
    
    let dominantWeb = 'None';
    let maxWebCount = 0;
    for (const web in webFreq) {
      if (webFreq[web] > maxWebCount) {
        maxWebCount = webFreq[web];
        dominantWeb = web;
      }
    }
    
    let dominantStatus = 'Break';
    if (activeC >= idleC && activeC >= breakC) dominantStatus = 'Active';
    else if (idleC >= activeC && idleC >= breakC) dominantStatus = 'Idle';
    
    timeline.push({
      start: startStr,
      end: endStr,
      status: dominantStatus,
      app: dominantApp,
      website: dominantWeb,
      inputs: inputC
    });
  }
  
  const heatmap = hourlySums.map((sum, hr) => {
    const count = hourlyCounts[hr];
    return count > 0 ? Math.round(sum / count) : 0;
  });
  
  const insights: string[] = [];
  if (idleRatio > 0.25 && measuredIntervals > 10) {
    insights.push(`Workstation idle ratio is high (${Math.round(idleRatio * 100)}%). Investigate if the employee is doing offline tasks, physical paperwork, or collaborative meetings.`);
  }
  if (switchesPerHour > 20 && measuredIntervals > 10) {
    insights.push(`High multitasking detected (${Math.round(switchesPerHour)} switches/hr). Recommend task grouping or 'do not disturb' sessions to enhance focus.`);
  }
  if (breakIntervals * 0.5 < 15 && workingMinutes > 510) {
    insights.push(`Long work hours detected with minimal breaks. Remind the employee to take short breaks to avoid fatigue.`);
  }
  if (activeIntervals > 120 && inputRate < 5) {
    insights.push(`High active app duration but extremely low mouse/keyboard inputs. Check if this aligns with video conference participation or extensive document review.`);
  }
  if (focusScore < 30 && workingMinutes > 120) {
    insights.push(`Sustained focus blocks are sparse today. Suggest scheduling a designated 90-minute deep work block daily with chat notifications muted.`);
  }
  
  return {
    productivityScore,
    focusScore,
    deepWorkScore,
    efficiencyScore,
    contextSwitches,
    switchesPerHour: parseFloat(switchesPerHour.toFixed(1)),
    activeHours,
    idleHours,
    breakHours,
    totalHours,
    idlePercentage,
    breakPercentage,
    appUsage: appDurations,
    webUsage: webDurations,
    timeline,
    heatmap,
    insights
  };
}
export async function getProductivityClassifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const list = await db.getProductivityClassifications();
    res.json(list);
  } catch (err) {
    console.error('getProductivityClassifications error:', err);
    res.status(500).json({ message: 'Error fetching productivity classifications.' });
  }
}

export async function createOrUpdateProductivityClassification(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { pattern, category } = req.body;
  if (!pattern || !category || !['Productive', 'Unproductive', 'Neutral'].includes(category)) {
    res.status(400).json({ message: 'pattern and valid category (Productive, Unproductive, Neutral) are required.' });
    return;
  }

  try {
    const record = await db.createOrUpdateProductivityClassification(pattern, category);
    
    await db.logActivity(
      req.user.id,
      'SYSTEM',
      `Productivity classification updated: ${pattern} set to ${category}.`
    );

    res.json({
      message: 'Productivity classification saved successfully.',
      classification: record
    });
  } catch (err) {
    console.error('createOrUpdateProductivityClassification error:', err);
    res.status(500).json({ message: 'Error saving productivity classification.' });
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

    const classifications = await db.getProductivityClassifications();
    const heartbeats = await db.getHeartbeatsForDate(employeeId, dateStr);
    const attendanceRecord = await db.getAttendanceToday(employeeId);
    
    const tasks = await db.getTasks({ assigneeId: employeeId, status: 'Done' });
    const completedToday = tasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === dateStr);

    const metrics = calculateProductivityMetrics(
      heartbeats,
      completedToday.length,
      attendanceRecord ? attendanceRecord.status === 'Late' : false,
      PRODUCTIVITY_RULES.breakLimitMinutes,
      classifications
    );

    // Generate Weekly History (last 7 days)
    const weeklySummary: any[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const hbs = await db.getHeartbeatsForDate(employeeId, dStr);
      const completedOnDay = tasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === dStr);
      
      const dayMetrics = calculateProductivityMetrics(
        hbs,
        completedOnDay.length,
        false, // late penalties excluded historical rollup
        PRODUCTIVITY_RULES.breakLimitMinutes,
        classifications
      );

      weeklySummary.push({
        date: dStr,
        activeHours: dayMetrics.activeHours,
        idleHours: dayMetrics.idleHours,
        breakHours: dayMetrics.breakHours,
        productivityScore: dayMetrics.productivityScore,
        focusScore: dayMetrics.focusScore,
        deepWorkScore: dayMetrics.deepWorkScore
      });
    }

    res.json({
      date: dateStr,
      heartbeats,
      summary: {
        activeHours: metrics.activeHours,
        idleHours: metrics.idleHours,
        breakHours: metrics.breakHours,
        totalHours: metrics.totalHours,
        productivityScore: metrics.productivityScore,
        focusScore: metrics.focusScore,
        deepWorkScore: metrics.deepWorkScore,
        efficiencyScore: metrics.efficiencyScore,
        contextSwitches: metrics.contextSwitches,
        idlePercentage: metrics.idlePercentage,
        breakPercentage: metrics.breakPercentage
      },
      appUsage: metrics.appUsage,
      webUsage: metrics.webUsage,
      timeline: metrics.timeline,
      heatmap: metrics.heatmap,
      insights: metrics.insights,
      weeklySummary
    });
  } catch (err) {
    console.error('getProductivityDetails error:', err);
    res.status(500).json({ message: 'Error retrieving productivity details.' });
  }
}

export async function getProductivityLeaderboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const dateStr = (req.query.date as string) || todayStr;

  try {
    let targetDeptId: number | undefined = undefined;

    if (req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (!managedDept) {
        res.status(403).json({ message: 'Forbidden: Manager does not manage any department.' });
        return;
      }
      targetDeptId = managedDept.id;
    } else if (req.query.departmentId) {
      targetDeptId = parseInt(req.query.departmentId as string);
    }

    const classifications = await db.getProductivityClassifications();
    const employees = await db.getEmployees();
    const filteredEmps = targetDeptId ? employees.filter(e => e.department_id === targetDeptId) : employees;

    const leaderboard = [];
    for (const emp of filteredEmps) {
      const hbs = await db.getHeartbeatsForDate(emp.id, dateStr);
      const tasks = await db.getTasks({ assigneeId: emp.id, status: 'Done' });
      const completedOnDay = tasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === dateStr);

      const metrics = calculateProductivityMetrics(
        hbs,
        completedOnDay.length,
        false,
        PRODUCTIVITY_RULES.breakLimitMinutes,
        classifications
      );

      leaderboard.push({
        employeeId: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        role: emp.role,
        productivityScore: metrics.productivityScore,
        focusScore: metrics.focusScore,
        deepWorkScore: metrics.deepWorkScore,
        activeHours: metrics.activeHours
      });
    }

    leaderboard.sort((a, b) => b.productivityScore - a.productivityScore);

    res.json({
      date: dateStr,
      leaderboard
    });
  } catch (err) {
    console.error('getProductivityLeaderboard error:', err);
    res.status(500).json({ message: 'Error retrieving productivity leaderboard.' });
  }
}

export async function getProductivityInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const dateStr = (req.query.date as string) || todayStr;

  try {
    let employeeId = req.user.id;
    if (req.query.employeeId) {
      employeeId = parseInt(req.query.employeeId as string);
    }

    if (req.user.role === 'Employee' && req.user.id !== employeeId) {
      res.status(403).json({ message: 'Forbidden: Cannot access other employee\'s insights.' });
      return;
    }

    const classifications = await db.getProductivityClassifications();
    const heartbeats = await db.getHeartbeatsForDate(employeeId, dateStr);
    const tasks = await db.getTasks({ assigneeId: employeeId, status: 'Done' });
    const completedToday = tasks.filter((t: any) => t.updated_at && new Date(t.updated_at).toISOString().split('T')[0] === dateStr);

    const metrics = calculateProductivityMetrics(
      heartbeats,
      completedToday.length,
      false,
      PRODUCTIVITY_RULES.breakLimitMinutes,
      classifications
    );

    res.json({
      date: dateStr,
      employeeId,
      insights: metrics.insights
    });
  } catch (err) {
    console.error('getProductivityInsights error:', err);
    res.status(500).json({ message: 'Error retrieving productivity insights.' });
  }
}
