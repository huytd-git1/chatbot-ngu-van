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
adminRouter.delete('/teachers/:teacherId', AdminController.deleteTeacher);

// Class management for Admin
adminRouter.get('/classes', AdminController.getAllClasses);
adminRouter.post('/classes', AdminController.createClass);
adminRouter.delete('/classes/:classId', AdminController.deleteClass);
adminRouter.get('/classes/:classId/students', AdminController.getStudentsInClass);
adminRouter.delete('/students/:studentId', AdminController.deleteStudent);

adminRouter.get('/settings', AdminController.getSystemSettings);
adminRouter.put('/settings', AdminController.updateSystemSettings);

adminRouter.get('/ai-settings', AdminController.getAiSettings);
adminRouter.put('/ai-settings', AdminController.updateAiSettings);
adminRouter.put('/ai-settings/key-model', AdminController.updateKeyModel);
adminRouter.post('/ai-settings/test', AdminController.testAiConnection);
adminRouter.delete('/ai-settings/keys/:index', AdminController.deleteAiKey);
adminRouter.delete('/ai-settings/keys', AdminController.clearAllAiKeys);
adminRouter.post('/ai-settings/reset-token-stats', AdminController.resetAiTokenStats);

adminRouter.get('/audit-logs', AdminController.getAuditLogs);
