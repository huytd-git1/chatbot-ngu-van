import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

// Rate limit login attempts: max 100 requests per minute per IP (accommodating classroom NAT)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Quá nhiều yêu cầu đăng nhập từ mạng này. Vui lòng thử lại sau 1 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

authRouter.post('/login', loginLimiter, AuthController.login);
authRouter.post('/logout', AuthController.logout);
authRouter.get('/me', authMiddleware(false), AuthController.getMe);
authRouter.post('/change-password', authMiddleware(true), AuthController.changePassword);

// TOTP endpoints for teacher and admin
authRouter.post('/totp/setup', authMiddleware(true), AuthController.setupTotp);
authRouter.post('/totp/confirm', authMiddleware(true), AuthController.confirmTotp);
authRouter.post('/totp/disable', authMiddleware(true), AuthController.disableTotp);
