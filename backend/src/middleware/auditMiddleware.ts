import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import db from '../config/db';
import { AuditLogModule } from '../types';

export async function auditLogger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Only intercept mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Intercept the finish event of the response to ensure we only log successful operations
  res.on('finish', async () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const actorId = req.user ? req.user.id : null;
        let actorName = 'System';
        
        if (actorId) {
          const employee = await db.getEmployeeById(actorId);
          if (employee) {
            actorName = `${employee.first_name} ${employee.last_name}`;
          } else if (req.user) {
            actorName = req.user.email;
          }
        }

        // Determine Module
        let module: AuditLogModule = 'SYSTEM';
        const path = req.originalUrl.toLowerCase();
        if (path.includes('/api/auth')) module = 'AUTH';
        else if (path.includes('/api/employees')) module = 'EMPLOYEES';
        else if (path.includes('/api/departments')) module = 'DEPARTMENTS';
        else if (path.includes('/api/leaves')) module = 'LEAVES';
        else if (path.includes('/api/attendance')) module = 'ATTENDANCE';
        else if (path.includes('/api/tasks')) module = 'TASKS';
        else if (path.includes('/api/projects')) module = 'PROJECTS';
        else if (path.includes('/api/teams')) module = 'TEAMS';

        // Determine Action
        let action = `${req.method} ${req.originalUrl}`;
        if (req.method === 'POST') {
          action = `Created ${module.toLowerCase().replace(/s$/, '')}`;
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
          action = `Updated ${module.toLowerCase().replace(/s$/, '')}`;
        } else if (req.method === 'DELETE') {
          action = `Deleted ${module.toLowerCase().replace(/s$/, '')}`;
        }

        // Specific actions refinements
        if (path.includes('/api/auth/login')) {
          action = 'User Login';
          module = 'AUTH';
        } else if (path.includes('/api/auth/register')) {
          action = 'User Registration';
          module = 'AUTH';
        }

        // Log request body as new value, scrubbing password
        let newValue: string | null = null;
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyCopy = { ...req.body };
          if (bodyCopy.password) bodyCopy.password = '******';
          newValue = JSON.stringify(bodyCopy);
        }

        await db.logAuditEvent(actorId, actorName, action, module, null, newValue);
      } catch (err) {
        console.error('[Audit Log] Failed to write audit event:', err);
      }
    }
  });

  next();
}
