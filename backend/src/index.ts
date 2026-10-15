import { app } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { DocumentService } from './services/document.service.js';
import { GeminiService } from './services/gemini.service.js';

async function bootstrap() {
  try {
    console.log(`[Server] Khởi động "Cô Dương dạy văn dễ thương" trên cổng ${env.PORT}...`);

    // 1. Run migrations & auto seed for memory DB
    await runMigrations();
    if (env.DATABASE_URL === 'memory') {
      await seedDatabase();
    }

    // 2. Load dynamic AI settings
    await GeminiService.initFromDb();

    // 3. Reconcile unfinished background indexing jobs
    await DocumentService.reconcilePendingJobs();

    // 3. Start server
    const server = app.listen(env.PORT, () => {
      console.log(`[Server] Ứng dụng đã sẵn sàng tại: http://localhost:${env.PORT}`);
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
