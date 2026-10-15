import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

export const adminRouter = Router();

// Require admin role
adminRouter.use(authMiddleware(true));
adminRouter.use(requireRole(['admin']));

adminRouter.get('/teachers', AdminController.getTeachers);
adminRouter.post('/teachers', AdminController.createTeacher);
adminRouter.put('/teachers/:teacherId/test-role', AdminController.toggleTestRole);
adminRouter.put('/teachers/:teacherId/classes', AdminController.assignClasses);

adminRouter.get('/settings', AdminController.getSystemSettings);
adminRouter.put('/settings', AdminController.updateSystemSettings);

adminRouter.get('/ai-settings', AdminController.getAiSettings);
adminRouter.put('/ai-settings', AdminController.updateAiSettings);
adminRouter.post('/ai-settings/test', AdminController.testAiConnection);

adminRouter.get('/audit-logs', AdminController.getAuditLogs);
