import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import { initializeDatabase, db } from './config/db';

// Import routers
import authRouter from './routes/authRoutes';
import employeeRouter from './routes/employeeRoutes';
import departmentRouter from './routes/departmentRoutes';
import skillRouter from './routes/skillRoutes';
import documentRouter from './routes/documentRoutes';
import dashboardRouter from './routes/dashboardRoutes';
import leaveRouter from './routes/leaveRoutes';
import attendanceRouter from './routes/attendanceRoutes';
import taskRouter from './routes/taskRoutes';
import projectRouter from './routes/projectRoutes';
import teamRouter from './routes/teamRoutes';
import notificationRouter from './routes/notificationRoutes';
import auditRouter from './routes/auditRoutes';
import searchRouter from './routes/searchRoutes';
import reportRouter from './routes/reportRoutes';
import assetRouter from './routes/assetRoutes';
import deviceRouter from './routes/deviceRoutes';
import productivityRouter from './routes/productivityRoutes';
import { checkUpdate, downloadUpdate, triggerRollbackCommand } from './controllers/updateController';
import { auditLogger } from './middleware/auditMiddleware';
import { verifyRequestSecurity } from './middleware/securityMiddleware';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { createRateLimiter } from './middleware/rateLimiter';

const app = express(); // trigger restart 5
const PORT = process.env.PORT || 5000;

// Security headers via helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Restrict CORS origins whitelist (strips trailing slashes to prevent mismatches)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  process.env.FRONTEND_URL || '',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
].filter(Boolean).map(origin => origin.replace(/\/$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-signature', 'x-nonce', 'x-timestamp', 'x-device-fingerprint', 'x-device-uuid'],
  credentials: true
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Audit Logger Middleware
app.use(auditLogger);

// Global API Rate Limiter
const globalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500,
  message: 'Too many requests from this IP. Please try again after 15 minutes.'
});
app.use('/api', globalLimiter);
app.use('/api', verifyRequestSecurity as any);

// Serve file uploads redirect middleware for Cloudinary
app.get('/uploads/:filename', async (req, res, next) => {
  try {
    const mapping = await db.getCloudinaryMapping(req.params.filename);
    if (mapping) {
      return res.redirect(mapping.cloudinary_url);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Serve file uploads statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Swagger API Documentation Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes mounting
app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/skills', skillRouter);
app.use('/api/documents', documentRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/leaves', leaveRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/projects', projectRouter);
app.use('/api/teams', teamRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/search', searchRouter);
app.use('/api/productivity', productivityRouter);
app.use('/api/reports', reportRouter);
app.use('/api/assets', assetRouter);
app.use('/api/devices', deviceRouter);

// Auto-updater client/server endpoints
app.get('/updates/check', checkUpdate);
app.get('/updates/download/:filename', downloadUpdate);
app.post('/updates/rollback', triggerRollbackCommand);

// Basic status check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Centralized error handling middleware (sanitizes output in production)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Express Error Handled]:', err);
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  
  res.status(status).json({
    message: status === 500 && isProd
      ? 'An unexpected error occurred on the server.'
      : err.message || 'Internal server error occurred.'
  });
});

// Environment Variable Validation (Fail-Fast)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'enterprise_hrms_super_secure_jwt_secret_key_2026')) {
  console.error('[Server] Critical Error: JWT_SECRET must be explicitly configured in production mode.');
  process.exit(1);
}

if (process.env.DB_ENABLED === 'true') {
  const missingDbParams = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'].filter(param => !process.env[param]);
  if (missingDbParams.length > 0) {
    console.error(`[Server] Critical Error: PostgreSQL database connection variables are missing: ${missingDbParams.join(', ')}`);
    process.exit(1);
  }
}

// Initialize database then start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Enterprise HRMS Backend listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[Server] Critical: Failed to boot database system. Express server aborted.', err);
});
