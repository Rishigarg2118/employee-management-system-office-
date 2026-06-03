import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  const employeeId = parseInt((req.body.employee_id || req.params.employeeId) as string);
  
  if (isNaN(employeeId)) {
    res.status(400).json({ message: 'Valid employee ID is required.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded.' });
    return;
  }

  try {
    const employee = await db.getEmployeeById(employeeId);
    if (!employee) {
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    const filePath = `uploads/${req.file.filename}`;
    const newDoc = await db.createDocument(
      employeeId,
      req.file.originalname,
      filePath,
      req.file.size,
      req.file.mimetype
    );

    const adminName = req.user ? req.user.email : 'System';
    await db.logActivity(
      employeeId, 
      'DOCUMENT_UPLOADED', 
      `Document "${req.file.originalname}" was uploaded by ${adminName}.`
    );

    res.status(201).json(newDoc);
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ message: 'Error registering uploaded document.' });
  }
}

export async function deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid document ID.' });
    return;
  }

  try {
    const doc = await db.getDocumentById(id);
    if (!doc) {
      res.status(404).json({ message: 'Document not found.' });
      return;
    }

    const success = await db.deleteDocument(id);
    if (!success) {
      res.status(500).json({ message: 'Failed to delete document database record.' });
      return;
    }

    const adminName = req.user ? req.user.email : 'System';
    await db.logActivity(
      doc.employee_id, 
      'DOCUMENT_DELETED', 
      `Document "${doc.name}" was removed by ${adminName}.`
    );

    res.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('deleteDocument error:', err);
    res.status(500).json({ message: 'Error deleting document.' });
  }
}

export async function getEmployeeDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const employeeId = parseInt(req.params.employeeId as string);
  if (isNaN(employeeId)) {
    res.status(400).json({ message: 'Invalid employee ID.' });
    return;
  }

  try {
    const docs = await db.getEmployeeDocuments(employeeId);
    res.json(docs);
  } catch (err) {
    console.error('getEmployeeDocuments error:', err);
    res.status(500).json({ message: 'Error retrieving files list.' });
  }
}
