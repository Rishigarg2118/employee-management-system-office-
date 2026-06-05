import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import { initializeDatabase } from './config/db';

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
import { auditLogger } from './middleware/auditMiddleware';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { createRateLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers via helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Restrict CORS origins whitelist
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  process.env.FRONTEND_URL || ''
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
  max: 150,
  message: 'Too many requests from this IP. Please try again after 15 minutes.'
});
app.use('/api', globalLimiter);

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

// Initialize database then start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Enterprise HRMS Backend listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[Server] Critical: Failed to boot database system. Express server aborted.', err);
});
