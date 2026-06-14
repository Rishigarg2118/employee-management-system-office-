import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function registerDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const {
    device_uuid,
    os_platform,
    hostname,
    platform,
    architecture,
    app_version,
    agent_version,
    timezone,
    language,
    screen_resolution,
    device_name,
    hardware_fingerprint,
    installation_id
  } = req.body;

  if (!device_uuid || !os_platform) {
    res.status(400).json({ message: 'device_uuid and os_platform are required fields.' });
    return;
  }

  try {
    const device = await db.registerDevice(req.user.id, {
      device_uuid,
      os_platform,
      hostname,
      platform,
      architecture,
      app_version,
      agent_version,
      timezone,
      language,
      screen_resolution,
      device_name,
      hardware_fingerprint,
      installation_id
    });

    // Log the audit event for registration
    await db.logAuditEvent(
      req.user.id,
      req.user.email,
      `Device ${device_name || hostname || device_uuid} registered with UUID ${device_uuid} and Fingerprint ${hardware_fingerprint || 'N/A'}.`,
      'SYSTEM',
      null,
      `UUID: ${device_uuid}`
    );

    res.status(201).json({
      message: 'Device registered successfully.',
      device
    });
  } catch (err) {
    console.error('registerDevice error:', err);
    res.status(500).json({ message: 'Error registering agent device.' });
  }
}

export async function getEmployeeDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const employeeId = req.user.id;

  try {
    if (db.isPostgres()) {
      const result = await db.query('SELECT * FROM agent_devices WHERE employee_id = $1', [employeeId]);
      res.json(result.rows);
    } else {
      const fallbackDb = (db as any).getJsonDb ? (db as any).getJsonDb() : {};
      const devices = fallbackDb.agent_devices || [];
      const filtered = devices.filter((d: any) => d.employee_id === employeeId);
      res.json(filtered);
    }
  } catch (err) {
    console.error('getEmployeeDevices error:', err);
    res.status(500).json({ message: 'Error retrieving employee devices.' });
  }
}

export async function getAllDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { status, departmentId } = req.query;

  try {
    const devices = await db.getAllDevices({
      status: status ? String(status) : undefined,
      department_id: departmentId ? parseInt(String(departmentId)) : undefined
    });
    res.json(devices);
  } catch (err) {
    console.error('getAllDevices error:', err);
    res.status(500).json({ message: 'Error retrieving device list.' });
  }
}

export async function updateDeviceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['Approved', 'Rejected', 'Revoked', 'Pending', 'Blocked'].includes(status)) {
    res.status(400).json({ message: 'Valid status value is required.' });
    return;
  }

  try {
    const updated = await db.updateDeviceStatus(parseInt(id as string), status as string);
    if (!updated) {
      res.status(404).json({ message: 'Device not found.' });
      return;
    }

    // Log the audit event
    await db.logAuditEvent(
      req.user.id,
      req.user.email,
      `Device ${updated.device_name || updated.device_uuid} status updated to ${status}.`,
      'SYSTEM',
      updated.status,
      status
    );

    res.json({
      message: `Device status updated to ${status} successfully.`,
      device: updated
    });
  } catch (err) {
    console.error('updateDeviceStatus error:', err);
    res.status(500).json({ message: 'Error updating device status.' });
  }
}
