import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function csrfMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Ensure csrf_token cookie exists
    let csrfToken = req.cookies?.csrf_token;
    if (!csrfToken) {
      csrfToken = crypto.randomBytes(24).toString('hex');
      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const cookieSecure = process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === 'true'
        : (process.env.NODE_ENV === 'production' && isHttps);

      res.cookie('csrf_token', csrfToken, {
        httpOnly: false, // Readable by client JS to send in x-csrf-token header
        secure: cookieSecure,
        sameSite: 'lax',
        path: '/',
      });
    }

    // 2. Safe HTTP methods don't require verification
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // 3. For state-changing methods, verify token
    const clientHeader = req.headers['x-csrf-token'] as string | undefined;
    if (!clientHeader || clientHeader !== csrfToken) {
      res.status(403).json({ error: 'CSRF token không hợp lệ hoặc bị thiếu.' });
      return;
    }

    next();
  };
}
