import { Router } from 'express';
import {
  getAssets,
  getAssetById,
  getAssetHistory,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset
} from '../controllers/assetController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { EmployeeRole } from '../types';

const router = Router();

// Retrieve all assets (filtered by RBAC inside controller)
router.get('/', authenticateToken as any, getAssets as any);

// Retrieve global history (filtered by RBAC inside controller)
router.get('/history', authenticateToken as any, getAssetHistory as any);

// Retrieve history for a specific asset (access checked inside controller)
router.get('/history/:id', authenticateToken as any, getAssetHistory as any);

// Retrieve a single asset details (access checked inside controller)
router.get('/:id', authenticateToken as any, getAssetById as any);

// Write operations (Restricted to Super Admin, Admin, and HR)
const writeRoles: EmployeeRole[] = ['Super Admin', 'Admin', 'HR'];

router.post('/', authenticateToken as any, requireRole(writeRoles) as any, createAsset as any);
router.post('/assign', authenticateToken as any, requireRole(writeRoles) as any, assignAsset as any);
router.post('/return', authenticateToken as any, requireRole(writeRoles) as any, returnAsset as any);
router.put('/:id', authenticateToken as any, requireRole(writeRoles) as any, updateAsset as any);
router.delete('/:id', authenticateToken as any, requireRole(writeRoles) as any, deleteAsset as any);

export default router;
