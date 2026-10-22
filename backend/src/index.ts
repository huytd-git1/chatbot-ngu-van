import { app } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { query } from './db/pool.js';
import { DocumentService } from './services/document.service.js';
import { GeminiService } from './services/gemini.service.js';

async function bootstrap() {
  const port = Number(env.PORT) || 4000;
  const host = '0.0.0.0';

  try {
    console.log(`[Server] Khởi động "Cô Dương dạy văn dễ thương" trên ${host}:${port}...`);

    // 1. Run migrations & auto seed if users table is empty
    try {
      await runMigrations();
      try {
        const { rows: userRows } = await query(`SELECT COUNT(*) as count FROM users`);
        if (parseInt(userRows[0]?.count || '0', 10) === 0) {
          console.log('[Server] Chưa có tài khoản, tự động nạp dữ liệu mẫu ban đầu...');
          await seedDatabase();
        }
      } catch (seedErr) {
        if (env.DATABASE_URL === 'memory') {
          await seedDatabase();
        } else {
          console.warn('[Server] Kiểm tra tài khoản ban đầu:', seedErr);
        }
      }
    } catch (dbErr) {
      console.error('[Server] Cảnh báo lỗi khởi tạo Database (server vẫn tiếp tục khởi động):', dbErr);
    }

    // 2. Load dynamic AI settings
    try {
      await GeminiService.initFromDb();
    } catch (aiErr) {
      console.warn('[Server] Cảnh báo khởi tạo AI settings từ database:', aiErr);
    }

    // 3. Reconcile unfinished background indexing jobs
    try {
      await DocumentService.reconcilePendingJobs();
    } catch (docErr) {
      console.warn('[Server] Cảnh báo kiểm tra indexing jobs:', docErr);
    }

    // 4. Start server (Binding to 0.0.0.0 is required for Render / Docker / Cloud)
    const server = app.listen(port, host, () => {
      console.log(`[Server] Ứng dụng đã sẵn sàng tại: http://${host}:${port}`);
      console.log(`[Server] Chế độ môi trường: ${env.NODE_ENV}`);
      console.log(`[Server] Kho RAG Gemini File Search: ${env.GEMINI_API_KEY ? 'Đã kết nối API thật' : 'Chế độ mô phỏng kiểm thử (Mock Mode)'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('[Server] Đang đóng kết nối an toàn...');
      server.close(() => {
        console.log('[Server] Đã dừng server.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[Server] Khởi động thất bại:', err);
    process.exit(1);
  }
}

bootstrap();
