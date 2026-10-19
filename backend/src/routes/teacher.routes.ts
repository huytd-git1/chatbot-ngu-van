import { Router } from 'express';
import multer from 'multer';
import { TeacherController } from '../controllers/teacher.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

export const teacherRouter = Router();

// Configure memory storage for multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Require teacher or admin role
teacherRouter.use(authMiddleware(true));
teacherRouter.use(requireRole(['teacher', 'admin']));

teacherRouter.get('/overview', TeacherController.getOverview);
teacherRouter.get('/classes', TeacherController.getClasses);
teacherRouter.post('/classes', TeacherController.createClass);
teacherRouter.get('/classes/:classId/students', TeacherController.getStudentsInClass);

// CSV import routes
teacherRouter.get('/csv-sample', TeacherController.getSampleCsvTemplate);
teacherRouter.post('/classes/:classId/preview-csv', upload.single('file'), TeacherController.previewCsv);
teacherRouter.post('/classes/:classId/import-csv', TeacherController.executeCsvImport);

// Student account management
teacherRouter.put('/students/:studentId/lock', TeacherController.toggleStudentLock);
teacherRouter.post('/students/:studentId/reset-password', TeacherController.resetStudentPassword);
teacherRouter.post('/students/:studentId/grant-quota', TeacherController.grantExtraQuota);
teacherRouter.delete('/students/:studentId', TeacherController.deleteStudent);

// Works & Documents management
teacherRouter.get('/works', TeacherController.getWorks);
teacherRouter.post('/works', TeacherController.createWork);
teacherRouter.put('/works/:workId/classes', TeacherController.updateWorkClasses);
teacherRouter.get('/works/:workId/documents', TeacherController.getDocumentsForWork);
teacherRouter.post('/works/:workId/documents', upload.single('file'), TeacherController.uploadDocument);
teacherRouter.put('/documents/:documentId/activate-primary', TeacherController.activatePrimaryDocument);
teacherRouter.put('/documents/:documentId/classification', TeacherController.updateDocumentClassification);
teacherRouter.get('/documents/:documentId/paragraphs', TeacherController.getDocumentParagraphs);
teacherRouter.get('/works/:workId/document-diff-report', TeacherController.getDocumentDiffReport);
teacherRouter.get('/documents/:documentId/download', TeacherController.downloadDocument);
teacherRouter.put('/documents/:documentId/reupload', upload.single('file'), TeacherController.reuploadDocument);
teacherRouter.delete('/documents/:documentId', TeacherController.deleteDocument);

// Learning settings
teacherRouter.get('/classes/:classId/works/:workId/learning-settings', TeacherController.getLearningSettings);
teacherRouter.put('/classes/:classId/works/:workId/learning-settings', TeacherController.updateLearningSettings);
