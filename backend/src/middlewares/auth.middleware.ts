import { Request, Response, NextFunction } from 'express';
import { AuthService, UserRow, SessionRow } from '../services/auth.service.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
      sessionData?: SessionRow;
    }
  }
}

export function authMiddleware(required = true) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sessionId = req.cookies?.session_id;

    if (!sessionId) {
      if (required) {
        res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã kết thúc.' });
        return;
      }
      return next();
    }

    try {
      const auth = await AuthService.validateSession(sessionId);
      if (!auth) {
        res.clearCookie('session_id');
        if (required) {
          res.status(401).json({ error: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.' });
          return;
        }
        return next();
      }

      req.user = auth.user;
      req.sessionData = auth.session;

      // If user must change password and is accessing other endpoints, block
      if (
        auth.user.must_change_password &&
        !req.path.includes('/auth/change-password') &&
        !req.path.includes('/auth/logout') &&
        !req.path.includes('/auth/me')
      ) {
        res.status(403).json({
          error: 'Vui lòng đổi mật khẩu trong lần đăng nhập đầu tiên trước khi tiếp tục.',
          code: 'MUST_CHANGE_PASSWORD',
        });
        return;
      }

      next();
    } catch (err) {
      console.error('[AuthMiddleware] Error validating session:', err);
      res.status(500).json({ error: 'Lỗi xác thực phiên làm việc.' });
    }
  };
}

export function requireRole(allowedRoles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    // Role check
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
      return;
    }

    next();
  };
}
