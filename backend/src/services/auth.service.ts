import argon2 from 'argon2';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { query } from '../db/pool.js';

export interface UserRow {
  id: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  is_test_teacher: boolean;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
  totp_secret: string | null;
  totp_enabled: boolean;
  totp_recovery_codes: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  revoked: boolean;
  user_agent: string | null;
  ip_address: string | null;
}

interface CachedSession {
  user: UserRow;
  session: SessionRow;
  expiresAtMs: number;
}

const sessionCache = new Map<string, CachedSession>();
const lastActiveUpdateMap = new Map<string, number>();

export class AuthService {
  /**
   * Hashes a password with Argon2id using safe parameters (19MB per OWASP for cloud containers)
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456, // 19 MB (OWASP recommended for cloud/container environments to prevent OOM)
      timeCost: 2,
      parallelism: 1,
    });
  }

  /**
   * Verifies a password against an Argon2id hash
   */
  static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Creates or regenerates a server-side session
   */
  static async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, userId, expiresAt.toISOString(), userAgent || null, ipAddress || null]
    );

    return sessionId;
  }

  /**
   * Validates a session ID and returns the user if active and unexpired.
   * Utilizes a short in-memory cache (15s) to prevent database connection spikes when multiple users load pages.
   */
  static async validateSession(sessionId: string): Promise<{ user: UserRow; session: SessionRow } | null> {
    const now = Date.now();
    const cached = sessionCache.get(sessionId);
    if (cached && now < cached.expiresAtMs) {
      return { user: cached.user, session: cached.session };
    }

    const { rows } = await query<UserRow & SessionRow & { session_id: string }>(
      `SELECT u.*, s.id as session_id, s.expires_at, s.revoked
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.revoked = FALSE AND s.expires_at > NOW() AND u.is_active = TRUE`,
      [sessionId]
    );

    if (rows.length === 0) {
      sessionCache.delete(sessionId);
      return null;
    }

    const row = rows[0];

    // Throttle last_active_at updates to once every 5 minutes per session to prevent DB lock contention
    const lastUpdate = lastActiveUpdateMap.get(sessionId) || 0;
    if (now - lastUpdate > 5 * 60 * 1000) {
      lastActiveUpdateMap.set(sessionId, now);
      query(`UPDATE sessions SET last_active_at = NOW() WHERE id = $1`, [sessionId]).catch(() => {});
    }

    const user: UserRow = {
      id: row.id,
      username: row.username,
      role: row.role,
      is_test_teacher: row.is_test_teacher,
      password_hash: row.password_hash,
      full_name: row.full_name,
      is_active: row.is_active,
      must_change_password: row.must_change_password,
      totp_secret: row.totp_secret,
      totp_enabled: row.totp_enabled,
      totp_recovery_codes: row.totp_recovery_codes,
      failed_login_attempts: row.failed_login_attempts,
      locked_until: row.locked_until,
      created_at: row.created_at,
    };

    const session: SessionRow = {
      id: row.session_id,
      user_id: row.id,
      created_at: row.created_at,
      expires_at: row.expires_at,
      last_active_at: row.last_active_at,
      revoked: row.revoked,
      user_agent: row.user_agent,
      ip_address: row.ip_address,
    };

    // Cache valid session for 15 seconds
    sessionCache.set(sessionId, { user, session, expiresAtMs: now + 15000 });

    return { user, session };
  }

  /**
   * Invalidates cached sessions for a specific user ID
   */
  static invalidateUserCache(userId: string): void {
    for (const [key, val] of sessionCache.entries()) {
      if (val.user.id === userId) {
        sessionCache.delete(key);
      }
    }
  }

  /**
   * Invalidates a specific session ID from cache
   */
  static invalidateSessionCache(sessionId?: string): void {
    if (sessionId) {
      sessionCache.delete(sessionId);
    } else {
      sessionCache.clear();
    }
  }

  /**
   * Revokes a specific session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    sessionCache.delete(sessionId);
    lastActiveUpdateMap.delete(sessionId);
    await query(`UPDATE sessions SET revoked = TRUE WHERE id = $1`, [sessionId]);
  }

  /**
   * Revokes all sessions for a user (e.g. after password change, lockout or role modification)
   */
  static async revokeAllUserSessions(userId: string): Promise<void> {
    sessionCache.clear();
    lastActiveUpdateMap.clear();
    await query(`UPDATE sessions SET revoked = TRUE WHERE user_id = $1`, [userId]);
  }

  /**
   * Generates TOTP secret and backup recovery codes
   */
  static generateTotpSecret(username: string): { secret: string; otpauth: string; recoveryCodes: string[] } {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(username, 'Co Duong Day Van', secret);
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      recoveryCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return { secret, otpauth, recoveryCodes };
  }

  /**
   * Verifies TOTP token or recovery code
   */
  static verifyTotp(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }

  /**
   * Hashes recovery codes for safe storage
   */
  static hashRecoveryCodes(codes: string[]): string[] {
    return codes.map(c => crypto.createHash('sha256').update(c.trim().toUpperCase()).digest('hex'));
  }

  /**
   * Verifies and burns a recovery code
   */
  static async useRecoveryCode(userId: string, code: string, storedHashedCodesJson: string | null): Promise<boolean> {
    if (!storedHashedCodesJson) return false;
    try {
      const hashedList: string[] = JSON.parse(storedHashedCodesJson);
      const targetHash = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
      const idx = hashedList.indexOf(targetHash);
      if (idx === -1) return false;

      // Remove the used code
      hashedList.splice(idx, 1);
      await query(`UPDATE users SET totp_recovery_codes = $1 WHERE id = $2`, [JSON.stringify(hashedList), userId]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handles failed login attempt and applies progressive lockout
   */
  static async recordFailedAttempt(userId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;
    let lockedUntil: string | null = null;

    if (attempts >= 5) {
      // Lock for 15 minutes
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    await query(
      `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
      [attempts, lockedUntil, userId]
    );
  }

  /**
   * Resets failed login attempts upon successful login
   */
  static async resetFailedAttempts(userId: string): Promise<void> {
    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [userId]
    );
  }
}
