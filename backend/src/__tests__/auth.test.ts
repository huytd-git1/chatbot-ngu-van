import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { AuthService } from '../services/auth.service.js';
import { query } from '../db/pool.js';

describe('Auth & Security Services', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('hashes passwords using Argon2id and verifies correctly', async () => {
    const rawPass = 'MatKhauSieuKho123!';
    const hash = await AuthService.hashPassword(rawPass);

    expect(hash).toContain('$argon2id$');
    const isValid = await AuthService.verifyPassword(hash, rawPass);
    expect(isValid).toBe(true);

    const isWrong = await AuthService.verifyPassword(hash, 'SaiMatKhau');
    expect(isWrong).toBe(false);
  });

  it('creates and validates persistent sessions', async () => {
    // Insert dummy user
    const hash = await AuthService.hashPassword('Pass123');
    const userRes = await query<{ id: string }>(
      `INSERT INTO users (username, role, password_hash, full_name)
       VALUES ('test_user_session', 'student', $1, 'Nguyễn Văn Session')
       RETURNING id`,
      [hash]
    );
    const userId = userRes.rows[0].id;

    const sessionId = await AuthService.createSession(userId, 'Vitest-Agent', '127.0.0.1');
    expect(sessionId).toBeDefined();
    expect(sessionId.length).toBe(64); // 32 bytes hex

    const validAuth = await AuthService.validateSession(sessionId);
    expect(validAuth).not.toBeNull();
    expect(validAuth?.user.username).toBe('test_user_session');

    // Revoke session
    await AuthService.revokeSession(sessionId);
    const afterRevoke = await AuthService.validateSession(sessionId);
    expect(afterRevoke).toBeNull();
  });

  it('handles account lockout after 5 failed login attempts', async () => {
    const hash = await AuthService.hashPassword('LockPass123');
    const userRes = await query<{ id: string }>(
      `INSERT INTO users (username, role, password_hash, full_name)
       VALUES ('user_to_lock', 'student', $1, 'Nguyễn Văn Lock')
       RETURNING id`,
      [hash]
    );
    const userId = userRes.rows[0].id;

    for (let i = 0; i < 4; i++) {
      await AuthService.recordFailedAttempt(userId, i);
    }

    let userCheck = await query<{ failed_login_attempts: number; locked_until: string | null }>(
      `SELECT failed_login_attempts, locked_until FROM users WHERE id = $1`,
      [userId]
    );
    expect(userCheck.rows[0].failed_login_attempts).toBe(4);
    expect(userCheck.rows[0].locked_until).toBeNull();

    // 5th attempt locks the account
    await AuthService.recordFailedAttempt(userId, 4);
    userCheck = await query<{ failed_login_attempts: number; locked_until: string | null }>(
      `SELECT failed_login_attempts, locked_until FROM users WHERE id = $1`,
      [userId]
    );
    expect(userCheck.rows[0].failed_login_attempts).toBe(5);
    expect(userCheck.rows[0].locked_until).not.toBeNull();

    // Resetting on successful login clears lock
    await AuthService.resetFailedAttempts(userId);
    userCheck = await query<{ failed_login_attempts: number; locked_until: string | null }>(
      `SELECT failed_login_attempts, locked_until FROM users WHERE id = $1`,
      [userId]
    );
    expect(userCheck.rows[0].failed_login_attempts).toBe(0);
    expect(userCheck.rows[0].locked_until).toBeNull();
  });

  it('generates and verifies TOTP 2FA with recovery codes', async () => {
    const { secret, recoveryCodes } = AuthService.generateTotpSecret('teacher_totp_test');
    expect(secret).toBeDefined();
    expect(recoveryCodes.length).toBe(8);

    const hashedCodes = AuthService.hashRecoveryCodes(recoveryCodes);
    const jsonCodes = JSON.stringify(hashedCodes);

    // Insert user with TOTP
    const hash = await AuthService.hashPassword('Pass123');
    const uRes = await query<{ id: string }>(
      `INSERT INTO users (username, role, password_hash, full_name, totp_secret, totp_enabled, totp_recovery_codes)
       VALUES ('user_totp', 'teacher', $1, 'Cô Giáo TOTP', $2, TRUE, $3)
       RETURNING id`,
      [hash, secret, jsonCodes]
    );
    const userId = uRes.rows[0].id;

    // Use recovery code 1
    const firstCode = recoveryCodes[0];
    const usedOk = await AuthService.useRecoveryCode(userId, firstCode, jsonCodes);
    expect(usedOk).toBe(true);

    // Reuse same code must fail
    const { rows } = await query<{ totp_recovery_codes: string }>(
      `SELECT totp_recovery_codes FROM users WHERE id = $1`,
      [userId]
    );
    const reused = await AuthService.useRecoveryCode(userId, firstCode, rows[0].totp_recovery_codes);
    expect(reused).toBe(false);
  });
});
