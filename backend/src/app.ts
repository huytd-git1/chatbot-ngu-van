import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { csrfMiddleware } from './middlewares/csrf.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { studentRouter } from './routes/student.routes.js';
import { teacherRouter } from './routes/teacher.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export const app = express();

// Trust reverse proxy headers (Render, Cloudflare, load balancers)
app.set('trust proxy', 1);

// 1. Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS configuration
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? true : env.APP_ORIGIN,
    credentials: true,
  })
);

// 3. Body & Cookie Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.SESSION_SECRET));

// 4. CSRF Middleware
app.use(csrfMiddleware());

// Health & Status check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    appName: 'Cô Dương dạy văn dễ thương',
    time: new Date().toISOString(),
    env: env.NODE_ENV,
    geminiConfigured: !!(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== ''),
  });
});

// Provide CSRF token to frontend
app.get('/api/csrf-token', (req, res) => {
  res.status(200).json({ csrfToken: req.cookies?.csrf_token });
});

// 5. API Routes
app.use('/api/auth', authRouter);
app.use('/api/student', studentRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/admin', adminRouter);

// 6. Serve static files from Frontend build in production
const possibleDistPaths = [
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'dist/frontend'),
  path.resolve(process.cwd(), '../dist/frontend'),
];
const distPath = possibleDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || possibleDistPaths[0];

if (fs.existsSync(distPath)) {
  console.log('[Server] Phục vụ giao diện Frontend từ thư mục:', distPath);
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('[Server] Cảnh báo: Chưa tìm thấy thư mục build frontend. Danh sách đường dẫn đã kiểm tra:', possibleDistPaths);
  app.get('/', (_req, res) => {
    res.status(200).send('<h2>Hệ thống "Cô Dương dạy văn dễ thương" đang hoạt động!</h2><p>Đang chuẩn bị giao diện web, vui lòng làm mới trang sau vài giây...</p>');
  });
}

// 7. Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[GlobalErrorHandler]', err);
  const status = err.status || 500;
  const message = env.NODE_ENV === 'production' && status === 500
    ? 'Đã xảy ra lỗi nội bộ máy chủ. Vui lòng thử lại sau.'
    : err.message || 'Lỗi không xác định.';
  res.status(status).json({ error: message });
});
