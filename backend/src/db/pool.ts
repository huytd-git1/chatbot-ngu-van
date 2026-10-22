import pg from 'pg';
import { newDb, DataType } from 'pg-mem';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface IDbPool {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  getClient(): Promise<pg.PoolClient>;
  end(): Promise<void>;
}

let dbInstance: IDbPool | null = null;

export function getDb(): IDbPool {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL && env.DATABASE_URL !== 'memory') {
    const isLocal =
      env.DATABASE_URL.includes('localhost') ||
      env.DATABASE_URL.includes('127.0.0.1') ||
      env.DATABASE_URL.includes('@postgres:') ||
      env.DATABASE_URL.includes('@postgres/') ||
      env.DATABASE_URL.includes('@db:') ||
      env.DATABASE_URL.includes('@db/');
    const isExplicitNoSsl =
      env.DATABASE_URL.includes('sslmode=disable') ||
      env.DATABASE_URL.includes('ssl=false') ||
      process.env.DB_SSL === 'false';
    const isExplicitSsl =
      env.DATABASE_URL.includes('sslmode=require') ||
      process.env.DB_SSL === 'true';
    const sslConfig = isExplicitNoSsl
      ? undefined
      : isExplicitSsl || !isLocal
      ? { rejectUnauthorized: false }
      : undefined;

    // Chuẩn hóa connection string: gỡ bỏ channel_binding=require nếu copy từ Neon để tránh node-postgres bị hang
    let cleanConnStr = env.DATABASE_URL;
    cleanConnStr = cleanConnStr.replace(/([?&])channel_binding=[^&]+(&|$)/g, '$1').replace(/[?&]$/, '');

    const pool = new pg.Pool({
      connectionString: cleanConnStr,
      ssl: sslConfig,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      console.warn('[PostgreSQL Pool] Cảnh báo kết nối nhàn rỗi (idle client):', err?.message || err);
    });

    dbInstance = {
      query: async (sql, params) => {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
          try {
            const res = await pool.query(sql, params);
            return { rows: res.rows, rowCount: res.rowCount ?? 0 };
          } catch (err: any) {
            attempts++;
            const msg = (err?.message || '').toLowerCase();
            const isConnErr =
              msg.includes('connection terminated') ||
              msg.includes('connection timeout') ||
              msg.includes('closed') ||
              err?.code === 'ECONNRESET' ||
              err?.code === '57P01';

            if (isConnErr && attempts < maxAttempts) {
              console.warn(`[PostgreSQL Pool] Lỗi kết nối (${err?.message}), tự động thử lại kết nối mới (${attempts}/${maxAttempts})...`);
              await new Promise((r) => setTimeout(r, 500 * attempts));
              continue;
            }
            throw err;
          }
        }
        throw new Error('PostgreSQL query failed');
      },
      getClient: () => pool.connect(),
      end: () => pool.end(),
    };
  } else {
    // In-memory PostgreSQL instance with pg-mem for local dev without PG or tests
    const memDb = newDb({ noAstCoverageCheck: true });
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });

    const memAdapter = memDb.adapters.createPg();
    const memPool = new memAdapter.Pool();

    dbInstance = {
      query: async (sql, params) => {
        const res = await memPool.query(sql, params);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
      getClient: () => memPool.connect(),
      end: () => memPool.end(),
    };
  }

  return dbInstance;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  return getDb().query<T>(sql, params);
}
