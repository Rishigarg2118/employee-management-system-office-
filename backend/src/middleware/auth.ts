import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_hrms_super_secure_jwt_secret_key_2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern';
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Authentication token required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedRequest['user'];
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired authentication token.' });
    return;
  }
}

export function requireRole(roles: ('Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
      return;
    }

    next();
  };
}

import db from '../config/db';

export async function requireApprovedDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const deviceUuid = req.headers['x-device-uuid'] as string;
  if (!deviceUuid) {
    res.status(400).json({ message: 'Device UUID header x-device-uuid is required.' });
    return;
  }

  try {
    let deviceStatus: string | null = null;

    if (db.isPostgres()) {
      const result = await db.query(
        'SELECT status FROM agent_devices WHERE device_uuid = $1 AND employee_id = $2',
        [deviceUuid, req.user.id]
      );
      if (result.rows.length > 0) {
        deviceStatus = result.rows[0].status;
      }
    } else {
      const fallbackDb = (db as any).getJsonDb ? (db as any).getJsonDb() : {};
      const devices = fallbackDb.agent_devices || [];
      const dev = devices.find((d: any) => d.device_uuid === deviceUuid && d.employee_id === req.user?.id);
      if (dev) {
        deviceStatus = dev.status;
      }
    }

    if (!deviceStatus) {
      res.status(403).json({ message: 'Device is not registered.' });
      return;
    }

    if (deviceStatus !== 'Approved') {
      res.status(403).json({ message: `Device status is ${deviceStatus}. Device must be Approved.` });
      return;
    }

    next();
  } catch (err) {
    console.error('requireApprovedDevice error:', err);
    res.status(500).json({ message: 'Internal server error checking device trust.' });
  }
}
