import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import { initializeDatabase } from './config/db';

// Import routers
import authRouter from './routes/authRoutes';
import employeeRouter from './routes/employeeRoutes';
import departmentRouter from './routes/departmentRoutes';
import skillRouter from './routes/skillRoutes';
import documentRouter from './routes/documentRoutes';
import dashboardRouter from './routes/dashboardRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // For local dev, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve file uploads statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Routes mounting
app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/skills', skillRouter);
app.use('/api/documents', documentRouter);
app.use('/api/dashboard', dashboardRouter);

// Basic status check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Express Error Handled]:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error occurred.'
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
