import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or backend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(16).default('co-duong-day-van-sieu-bao-mat-session-secret-2026-key'),
  DATABASE_URL: z.string().default('memory'), // 'memory' triggers pg-mem for zero-config testing
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('models/gemini-embedding-2'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  DEFAULT_DAILY_QUOTA: z.coerce.number().default(20),
  SYSTEM_HARD_CAP_DAILY: z.coerce.number().default(5000),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
