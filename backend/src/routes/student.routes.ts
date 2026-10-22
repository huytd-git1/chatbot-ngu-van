import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { StudentController } from '../controllers/student.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

export const studentRouter = Router();

// Chat rate limiter: max 40 questions per 5 minutes per user (keyed by user ID, not shared classroom IP)
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  message: { error: 'Bạn thao tác quá nhanh. Vui lòng chậm lại một chút để suy ngẫm nhé!' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skip: (req: any) => req.user?.role === 'admin' || !!req.user?.is_test_teacher,
});

studentRouter.use(authMiddleware(true));
// Allow student, teacher_test and admin to access student RAG interface
studentRouter.get('/works', StudentController.getAssignedWorks);
studentRouter.get('/works/:workId/suggestions', StudentController.getWorkSuggestions);
studentRouter.get('/quota', StudentController.getQuota);
studentRouter.post('/ask', chatLimiter, StudentController.askQuestion);
studentRouter.get('/history', StudentController.getHistory);
studentRouter.delete('/history', StudentController.clearHistory);
