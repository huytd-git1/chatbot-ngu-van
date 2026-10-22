import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { RagEvalController } from '../controllers/rag_eval.controller.js';
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

// RAG Evaluation & Inspection Dashboard routes
adminRouter.get('/rag-eval/overview', RagEvalController.getOverview);
adminRouter.get('/rag-eval/documents/:docId/chunks', RagEvalController.getDocumentChunks);
adminRouter.post('/rag-eval/playground', RagEvalController.runPlayground);
adminRouter.get('/rag-eval/traces', RagEvalController.getTraces);
adminRouter.get('/rag-eval/traces/:id', RagEvalController.getTraceDetail);
adminRouter.post('/rag-eval/traces/:id/evaluate', RagEvalController.submitEvaluation);
adminRouter.get('/rag-eval/testsets', RagEvalController.getTestsets);
adminRouter.post('/rag-eval/testsets', RagEvalController.createTestset);
adminRouter.post('/rag-eval/testsets/:testsetId/run', RagEvalController.runBenchmark);
adminRouter.get('/rag-eval/runs', RagEvalController.getRuns);

