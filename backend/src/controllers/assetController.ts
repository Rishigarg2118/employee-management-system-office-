import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper to get actor name for audit logs
async function getActorName(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) return 'System';
  const emp = await db.getEmployeeById(req.user.id);
  return emp ? `${emp.first_name} ${emp.last_name}` : req.user.email;
}

export async function getAssets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, assetType, search } = req.query;
    
    // Fetch all assets from db (using filters if provided)
    const assets = await db.getAssets({
      status: status ? String(status) : undefined,
      assetType: assetType ? String(assetType) : undefined,
      search: search ? String(search) : undefined
    });

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const role = req.user.role;
    const userId = req.user.id;

    // Enforce RBAC visibility rules
    if (role === 'Super Admin' || role === 'Admin' || role === 'HR') {
      res.json(assets);
      return;
    }

    if (role === 'Manager') {
      const managerInfo = await db.getEmployeeById(userId);
      if (!managerInfo) {
        res.status(404).json({ message: 'Manager profile not found.' });
        return;
      }

      const managerDeptId = managerInfo.department_id;
      const filtered = assets.filter(asset => {
        // Manager can see assets assigned to themselves
        if (asset.assigned_to_id === userId) return true;
        // Manager can see assets assigned to members of their department
        if (managerDeptId && asset.department_id === managerDeptId) return true;
        return false;
      });

      res.json(filtered);
      return;
    }

    // Employees and Interns: See only their assigned assets
    const filtered = assets.filter(asset => asset.assigned_to_id === userId);
    res.json(filtered);
  } catch (err) {
    console.error('getAssets error:', err);
    res.status(500).json({ message: 'Error fetching assets.', error: err instanceof Error ? err.message : err });
  }
}

export async function getAssetById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid asset ID.' });
      return;
    }

    const asset = await db.getAssetById(id);
    if (!asset) {
      res.status(404).json({ message: 'Asset not found.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const role = req.user.role;
    const userId = req.user.id;

    // Enforce RBAC visibility rules for single view
    if (role === 'Super Admin' || role === 'Admin' || role === 'HR') {
      res.json(asset);
      return;
    }

    if (role === 'Manager') {
      const managerInfo = await db.getEmployeeById(userId);
      const managerDeptId = managerInfo ? managerInfo.department_id : null;
      
      const isSelf = asset.assigned_to_id === userId;
      const isDeptMember = managerDeptId && asset.department_id === managerDeptId;

      if (isSelf || isDeptMember) {
        res.json(asset);
        return;
      }
    } else {
      // Employee / Intern
      if (asset.assigned_to_id === userId) {
        res.json(asset);
        return;
      }
    }

    res.status(403).json({ message: 'Forbidden: You do not have permission to view this asset.' });
  } catch (err) {
    console.error('getAssetById error:', err);
    res.status(500).json({ message: 'Error retrieving asset details.', error: err instanceof Error ? err.message : err });
  }
}

export async function getAssetHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id ? parseInt(req.params.id as string) : undefined;
    
    if (id !== undefined && isNaN(id)) {
      res.status(400).json({ message: 'Invalid asset ID.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const role = req.user.role;
    const userId = req.user.id;

    // For a specific asset history, first check permission to view that asset
    if (id !== undefined) {
      const asset = await db.getAssetById(id);
      if (!asset) {
        res.status(404).json({ message: 'Asset not found.' });
        return;
      }

      let hasAccess = false;
      if (role === 'Super Admin' || role === 'Admin' || role === 'HR') {
        hasAccess = true;
      } else if (role === 'Manager') {
        const managerInfo = await db.getEmployeeById(userId);
        const managerDeptId = managerInfo ? managerInfo.department_id : null;
        hasAccess = (asset.assigned_to_id === userId) || (!!managerDeptId && asset.department_id === managerDeptId);
      } else {
        hasAccess = (asset.assigned_to_id === userId);
      }

      if (!hasAccess) {
        res.status(403).json({ message: 'Forbidden: You do not have access to view this asset\'s history.' });
        return;
      }

      const history = await db.getAssetHistory(id);
      res.json(history);
      return;
    }

    // Global history is only accessible by Super Admin, Admin, HR, and Manager (filtered)
    if (role === 'Super Admin' || role === 'Admin' || role === 'HR') {
      const history = await db.getAssetHistory();
      res.json(history);
      return;
    }

    if (role === 'Manager') {
      const managerInfo = await db.getEmployeeById(userId);
      const managerDeptId = managerInfo ? managerInfo.department_id : null;
      const history = await db.getAssetHistory();
      
      // Filter global history: manager can see actions on assets assigned to themselves or their department
      // To filter, we can check each history record's asset details
      const filteredHistory = [];
      for (const h of history) {
        const asset = await db.getAssetById(h.asset_id);
        if (asset && ((asset.assigned_to_id === userId) || (managerDeptId && asset.department_id === managerDeptId))) {
          filteredHistory.push(h);
        }
      }
      res.json(filteredHistory);
      return;
    }

    // Employees and Interns can only see history of assets assigned to them
    const history = await db.getAssetHistory();
    const filteredHistory = [];
    for (const h of history) {
      const asset = await db.getAssetById(h.asset_id);
      if (asset && asset.assigned_to_id === userId) {
        filteredHistory.push(h);
      }
    }
    res.json(filteredHistory);
  } catch (err) {
    console.error('getAssetHistory error:', err);
    res.status(500).json({ message: 'Error retrieving asset history.', error: err instanceof Error ? err.message : err });
  }
}

export async function createAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { asset_code, asset_name, asset_type, brand, model, serial_number, purchase_date, purchase_cost, warranty_expiry, asset_condition, status, notes } = req.body;

    if (!asset_code || !asset_name || !asset_type) {
      res.status(400).json({ message: 'Asset code, name, and type are required.' });
      return;
    }

    // Check duplicate code
    const existingAssets = await db.getAssets({ search: asset_code });
    const isDuplicate = existingAssets.some(a => a.asset_code.toLowerCase() === asset_code.toLowerCase());
    if (isDuplicate) {
      res.status(400).json({ message: `Asset code "${asset_code}" is already registered.` });
      return;
    }

    const userId = req.user ? req.user.id : null;
    const newAsset = await db.createAsset({
      asset_code,
      asset_name,
      asset_type,
      brand,
      model,
      serial_number,
      purchase_date,
      purchase_cost: purchase_cost ? parseFloat(purchase_cost) : undefined,
      warranty_expiry,
      asset_condition,
      status,
      notes
    }, userId);

    // Write to audit log
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      userId,
      actorName,
      `Created Asset: ${asset_name} (${asset_code})`,
      'ASSETS',
      null,
      JSON.stringify(newAsset)
    );

    res.status(201).json(newAsset);
  } catch (err) {
    console.error('createAsset error:', err);
    res.status(500).json({ message: 'Error creating asset.', error: err instanceof Error ? err.message : err });
  }
}

export async function updateAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid asset ID.' });
      return;
    }

    const existing = await db.getAssetById(id);
    if (!existing) {
      res.status(404).json({ message: 'Asset not found.' });
      return;
    }

    const userId = req.user ? req.user.id : null;
    const updated = await db.updateAsset(id, req.body, userId);

    // Write to audit log
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      userId,
      actorName,
      `Updated Asset: ${existing.asset_name} (${existing.asset_code})`,
      'ASSETS',
      JSON.stringify(existing),
      JSON.stringify(updated)
    );

    res.json(updated);
  } catch (err) {
    console.error('updateAsset error:', err);
    res.status(500).json({ message: 'Error updating asset.', error: err instanceof Error ? err.message : err });
  }
}

export async function deleteAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid asset ID.' });
      return;
    }

    const existing = await db.getAssetById(id);
    if (!existing) {
      res.status(404).json({ message: 'Asset not found.' });
      return;
    }

    // Check if it's currently assigned
    if (existing.status === 'Assigned') {
      res.status(400).json({ message: 'Cannot delete an asset that is currently assigned. Please return it first.' });
      return;
    }

    const success = await db.deleteAsset(id);
    if (!success) {
      res.status(500).json({ message: 'Failed to delete asset.' });
      return;
    }

    // Write to audit log
    const userId = req.user ? req.user.id : null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      userId,
      actorName,
      `Deleted Asset: ${existing.asset_name} (${existing.asset_code})`,
      'ASSETS',
      JSON.stringify(existing),
      null
    );

    res.json({ message: 'Asset deleted successfully.' });
  } catch (err) {
    console.error('deleteAsset error:', err);
    res.status(500).json({ message: 'Error deleting asset.', error: err instanceof Error ? err.message : err });
  }
}

export async function assignAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { asset_id, employee_id, expected_return_date, remarks } = req.body;

    if (!asset_id || !employee_id) {
      res.status(400).json({ message: 'Asset ID and Employee ID are required.' });
      return;
    }

    const assetIdNum = parseInt(asset_id);
    const employeeIdNum = parseInt(employee_id);

    const asset = await db.getAssetById(assetIdNum);
    if (!asset) {
      res.status(404).json({ message: 'Asset not found.' });
      return;
    }

    if (asset.status === 'Retired' || asset.status === 'Lost') {
      res.status(400).json({ message: `Cannot assign an asset that is in status: ${asset.status}` });
      return;
    }

    const employee = await db.getEmployeeById(employeeIdNum);
    if (!employee) {
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    const assignerId = req.user ? req.user.id : null;
    if (!assignerId) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const assignment = await db.assignAsset({
      asset_id: assetIdNum,
      employee_id: employeeIdNum,
      assigned_by: assignerId,
      expected_return_date,
      remarks
    });

    // Send system notification to assigned employee
    await db.createNotification(
      employeeIdNum,
      'Asset Assigned',
      `${asset.asset_name} (${asset.asset_code}) has been assigned to you.`,
      'ASSET'
    );

    // Audit trail logging
    const actorName = await getActorName(req);
    const empName = `${employee.first_name} ${employee.last_name}`;
    await db.logAuditEvent(
      assignerId,
      actorName,
      `Assigned Asset ${asset.asset_name} to ${empName}`,
      'ASSETS',
      JSON.stringify(asset),
      JSON.stringify(assignment)
    );

    res.status(200).json(assignment);
  } catch (err) {
    console.error('assignAsset error:', err);
    res.status(500).json({ message: 'Error assigning asset.', error: err instanceof Error ? err.message : err });
  }
}

export async function returnAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { assignment_id, actual_return_date, return_condition, remarks, status } = req.body;

    if (!assignment_id || !actual_return_date || !return_condition) {
      res.status(400).json({ message: 'Assignment ID, actual return date, and return condition are required.' });
      return;
    }

    const assignmentIdNum = parseInt(assignment_id);

    // Under-the-hood returnAsset takes assignmentId and updates DB
    const updatedAssignment = await db.returnAsset(assignmentIdNum, {
      actual_return_date,
      return_condition,
      remarks,
      status: status || 'Available'
    });

    const asset = await db.getAssetById(updatedAssignment.asset_id);
    const assetName = asset ? asset.asset_name : 'Asset';
    const assetCode = asset ? asset.asset_code : '';

    // Send system notification to the employee who returned the asset
    await db.createNotification(
      updatedAssignment.employee_id,
      'Asset Return Recorded',
      `${assetName} (${assetCode}) returned successfully. Status: ${status || 'Available'}.`,
      'ASSET'
    );

    // Audit trail logging
    const actorId = req.user ? req.user.id : null;
    const actorName = await getActorName(req);
    await db.logAuditEvent(
      actorId,
      actorName,
      `Returned Asset: ${assetName} (Assignment ID: ${assignment_id})`,
      'ASSETS',
      null,
      JSON.stringify(updatedAssignment)
    );

    res.status(200).json(updatedAssignment);
  } catch (err) {
    console.error('returnAsset error:', err);
    res.status(500).json({ message: 'Error returning asset.', error: err instanceof Error ? err.message : err });
  }
}
