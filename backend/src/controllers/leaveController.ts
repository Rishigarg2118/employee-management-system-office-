import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper to calculate weekdays (excluding Saturday and Sunday)
function calculateBusinessDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }
  
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function getLeaveTypes(req: Request, res: Response): Promise<void> {
  try {
    const types = await db.getLeaveTypes();
    res.json(types);
  } catch (err) {
    console.error('getLeaveTypes error:', err);
    res.status(500).json({ message: 'Error retrieving leave types.' });
  }
}

export async function getLeaveBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
  const employeeId = parseInt(req.params.employeeId as string);
  
  if (isNaN(employeeId)) {
    res.status(400).json({ message: 'Invalid employee ID.' });
    return;
  }

  // Security check: Employees can only view their own balance. Managers and Admins can view any.
  if (req.user && req.user.role === 'Employee' && req.user.id !== employeeId) {
    res.status(403).json({ message: 'Forbidden: You can only view your own leave balance.' });
    return;
  }

  try {
    const balances = await db.getLeaveBalances(employeeId);
    res.json(balances);
  } catch (err) {
    console.error('getLeaveBalances error:', err);
    res.status(500).json({ message: 'Error retrieving leave balances.' });
  }
}

export async function getLeaveRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters: { status?: string; departmentId?: number; employeeId?: number } = {};
    
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    
    if (req.query.departmentId) {
      filters.departmentId = parseInt(req.query.departmentId as string);
    }

    if (req.query.employeeId) {
      filters.employeeId = parseInt(req.query.employeeId as string);
    }

    // Role restrictions:
    // Employees can ONLY see their own requests.
    if (req.user && req.user.role === 'Employee') {
      filters.employeeId = req.user.id;
    }

    // Managers can see their department team requests.
    if (req.user && req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        filters.departmentId = managedDept.id;
      } else {
        // Manager doesn't manage a department, restrict to their own requests
        filters.employeeId = req.user.id;
      }
    }

    const requests = await db.getLeaveRequests(filters);
    res.json(requests);
  } catch (err) {
    console.error('getLeaveRequests error:', err);
    res.status(500).json({ message: 'Error retrieving leave requests.' });
  }
}

export async function getLeaveRequestById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid request ID.' });
    return;
  }

  try {
    const request = await db.getLeaveRequestById(id);
    if (!request) {
      res.status(404).json({ message: 'Leave request not found.' });
      return;
    }

    // Role check: Employees can only view their own request. Managers can view requests in their department. Admins can view any.
    if (req.user && req.user.role === 'Employee' && request.employee_id !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You can only view your own leave request.' });
      return;
    }

    if (req.user && req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (!managedDept || request.employee?.department_id !== managedDept.id) {
        // Unless it is their own request, deny access
        if (request.employee_id !== req.user.id) {
          res.status(403).json({ message: 'Forbidden: You can only view requests from your team.' });
          return;
        }
      }
    }

    res.json(request);
  } catch (err) {
    console.error('getLeaveRequestById error:', err);
    res.status(500).json({ message: 'Error retrieving leave request.' });
  }
}

export async function applyLeave(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { leave_type_id, start_date, end_date, reason } = req.body;

  if (!leave_type_id || !start_date || !end_date || !reason) {
    res.status(400).json({ message: 'All fields (leave_type_id, start_date, end_date, reason) are required.' });
    return;
  }

  const start = new Date(start_date);
  const end = new Date(end_date);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json({ message: 'Invalid dates provided.' });
    return;
  }

  if (start > end) {
    res.status(400).json({ message: 'Start date cannot be after end date.' });
    return;
  }

  // Calculate weekdays/business days
  const totalDays = calculateBusinessDays(start_date, end_date);
  if (totalDays === 0) {
    res.status(400).json({ message: 'Leave duration must include at least one weekday (Monday - Friday).' });
    return;
  }

  const employeeId = req.user?.id;
  if (!employeeId) {
    res.status(401).json({ message: 'Unauthorized employee context.' });
    return;
  }

  const attachmentPath = req.file ? `uploads/${req.file.filename}` : null;

  try {
    const newRequest = await db.applyLeave({
      employee_id: employeeId,
      leave_type_id: parseInt(leave_type_id),
      start_date,
      end_date,
      total_days: totalDays,
      reason,
      attachment_path: attachmentPath
    });

    res.status(201).json(newRequest);
  } catch (err: any) {
    console.error('applyLeave error:', err);
    res.status(400).json({ message: err.message || 'Error submitting leave application.' });
  }
}

export async function approveLeaveWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { stage, status, remarks } = req.body;

  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid request ID.' });
    return;
  }

  if (!stage || !status) {
    res.status(400).json({ message: 'Stage and Status are required.' });
    return;
  }

  if (!['Manager Review', 'HR Review'].includes(stage)) {
    res.status(400).json({ message: 'Invalid workflow stage.' });
    return;
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    res.status(400).json({ message: 'Invalid workflow status.' });
    return;
  }

  const approverId = req.user?.id;
  if (!approverId) {
    res.status(401).json({ message: 'Unauthorized approver context.' });
    return;
  }

  try {
    const request = await db.getLeaveRequestById(id);
    if (!request) {
      res.status(404).json({ message: 'Leave request not found.' });
      return;
    }

    // Role check and verification:
    // Manager Review: must be manager of the department or Admin.
    if (stage === 'Manager Review') {
      if (req.user?.role !== 'Manager' && req.user?.role !== 'Admin') {
        res.status(403).json({ message: 'Forbidden: Only managers or admins can review this stage.' });
        return;
      }
      
      if (req.user?.role === 'Manager') {
        const depts = await db.getDepartments();
        const managedDept = depts.find(d => d.manager_id === req.user?.id);
        if (!managedDept || request.employee?.department_id !== managedDept.id) {
          res.status(403).json({ message: 'Forbidden: You can only approve leaves for your own department team.' });
          return;
        }
      }
    }

    // HR Review: must be Admin (HR represents Admin in our system).
    if (stage === 'HR Review') {
      if (req.user?.role !== 'Admin') {
        res.status(403).json({ message: 'Forbidden: HR approvals require Administrator role privileges.' });
        return;
      }
    }

    const updatedRequest = await db.approveLeaveWorkflow(id, approverId, stage, status, remarks);
    res.json(updatedRequest);
  } catch (err: any) {
    console.error('approveLeaveWorkflow error:', err);
    res.status(400).json({ message: err.message || 'Error processing workflow transition.' });
  }
}

export async function cancelLeave(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid request ID.' });
    return;
  }

  const employeeId = req.user?.id;
  if (!employeeId) {
    res.status(401).json({ message: 'Unauthorized context.' });
    return;
  }

  try {
    const updatedRequest = await db.cancelLeave(id, employeeId);
    res.json(updatedRequest);
  } catch (err: any) {
    console.error('cancelLeave error:', err);
    res.status(400).json({ message: err.message || 'Error cancelling leave request.' });
  }
}

export async function getLeaveAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters: { departmentId?: number; employeeId?: number } = {};

    // Role scoping:
    // Employee: only see their own analytics
    if (req.user && req.user.role === 'Employee') {
      filters.employeeId = req.user.id;
    }
    // Manager: see department analytics
    if (req.user && req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        filters.departmentId = managedDept.id;
      } else {
        filters.employeeId = req.user.id;
      }
    }

    const analytics = await db.getLeaveAnalytics(filters);
    res.json(analytics);
  } catch (err) {
    console.error('getLeaveAnalytics error:', err);
    res.status(500).json({ message: 'Error compiling leave analytics.' });
  }
}

export async function getLeaveCalendar(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters: { departmentId?: number } = {};

    if (req.query.departmentId) {
      filters.departmentId = parseInt(req.query.departmentId as string);
    }

    // Manager role scoping for calendar
    if (req.user && req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        filters.departmentId = managedDept.id;
      }
    }

    const calendarEvents = await db.getLeaveCalendar(filters);
    res.json(calendarEvents);
  } catch (err) {
    console.error('getLeaveCalendar error:', err);
    res.status(500).json({ message: 'Error compiling calendar events.' });
  }
}

export async function getLeaveReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  // Only Admins or Managers can retrieve reporting grids
  if (req.user && req.user.role === 'Employee') {
    res.status(403).json({ message: 'Forbidden: Insufficient permissions to view reports.' });
    return;
  }

  try {
    const filters: { departmentId?: number; employeeId?: number; startDate?: string; endDate?: string; leaveTypeId?: number } = {};

    if (req.query.departmentId) {
      filters.departmentId = parseInt(req.query.departmentId as string);
    }
    if (req.query.employeeId) {
      filters.employeeId = parseInt(req.query.employeeId as string);
    }
    if (req.query.leaveTypeId) {
      filters.leaveTypeId = parseInt(req.query.leaveTypeId as string);
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate as string;
    }

    // Manager role scoping
    if (req.user && req.user.role === 'Manager') {
      const depts = await db.getDepartments();
      const managedDept = depts.find(d => d.manager_id === req.user?.id);
      if (managedDept) {
        filters.departmentId = managedDept.id;
      } else {
        // If manager has no department, they cannot view reports
        res.json([]);
        return;
      }
    }

    const reportData = await db.getLeaveReports(filters);
    res.json(reportData);
  } catch (err) {
    console.error('getLeaveReports error:', err);
    res.status(500).json({ message: 'Error retrieving reports.' });
  }
}
