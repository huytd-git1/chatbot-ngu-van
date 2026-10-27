import { Request, Response } from 'express';
import { z } from 'zod';
import qrcode from 'qrcode';
import { query } from '../db/pool.js';
import { AuthService, UserRow } from '../services/auth.service.js';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc mã học sinh.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
  totpCode: z.string().optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu cũ.'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự.'),
});

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
      return;
    }

    const { username, password, totpCode } = parse.data;

    // Look up user
    const { rows } = await query<UserRow>(
      `SELECT * FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    // Generic error to avoid username enumeration
    const genericError = 'Tên đăng nhập hoặc mật khẩu không chính xác.';

    if (rows.length === 0) {
      res.status(401).json({ error: genericError });
      return;
    }

    const user = rows[0];

    // Check active
    if (!user.is_active) {
      res.status(403).json({ error: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ giáo viên hoặc quản trị viên.' });
      return;
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitMin = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      res.status(429).json({
        error: `Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitMin} phút.`,
      });
      return;
    }

    // Verify Argon2id password
    const passwordValid = await AuthService.verifyPassword(user.password_hash, password);
    if (!passwordValid) {
      await AuthService.recordFailedAttempt(user.id, user.failed_login_attempts);
      res.status(401).json({ error: genericError });
      return;
    }

    // Check TOTP 2FA if enabled
    if (user.totp_enabled && user.totp_secret) {
      if (!totpCode) {
        res.status(200).json({ require2fa: true, message: 'Vui lòng nhập mã xác thực 2 bước (TOTP).' });
        return;
      }

      const isTotpValid = AuthService.verifyTotp(totpCode, user.totp_secret);
      if (!isTotpValid) {
        // Try recovery code
        const usedRecovery = await AuthService.useRecoveryCode(user.id, totpCode, user.totp_recovery_codes);
        if (!usedRecovery) {
          res.status(401).json({ error: 'Mã xác thực 2 bước hoặc mã khôi phục không hợp lệ.' });
          return;
        }
      }
    }

    // Successful login: reset failed attempts
    await AuthService.resetFailedAttempts(user.id);

    // Create session (regenerates session ID)
    const sessionId = await AuthService.createSession(
      user.id,
      req.headers['user-agent'],
      req.ip || req.socket.remoteAddress
    );

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const cookieSecure = process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : (process.env.NODE_ENV === 'production' && isHttps);

    // Set secure cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      message: 'Đăng nhập thành công.',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isTestTeacher: user.is_test_teacher,
        mustChangePassword: user.must_change_password,
        totpEnabled: user.totp_enabled,
      },
    });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
      await AuthService.revokeSession(sessionId);
    }
    res.clearCookie('session_id', { path: '/' });
    res.status(200).json({ message: 'Đăng xuất thành công.' });
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    res.status(200).json({
      user: {
        id: req.user.id,
        username: req.user.username,
        fullName: req.user.full_name,
        role: req.user.role,
        isTestTeacher: req.user.is_test_teacher,
        mustChangePassword: req.user.must_change_password,
        totpEnabled: req.user.totp_enabled,
      },
    });
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const parse = changePasswordSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
      return;
    }

    const { oldPassword, newPassword } = parse.data;

    // Verify old password
    const userRes = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );
    const isValid = await AuthService.verifyPassword(userRes.rows[0].password_hash, oldPassword);
    if (!isValid) {
      res.status(400).json({ error: 'Mật khẩu cũ không chính xác.' });
      return;
    }

    // Hash new password with Argon2id
    const newHash = await AuthService.hashPassword(newPassword);

    await query(
      `UPDATE users
       SET password_hash = $1, must_change_password = FALSE, updated_at = NOW()
       WHERE id = $2`,
      [newHash, req.user.id]
    );

    // Keep current session, revoke others
    const currentSessionId = req.cookies?.session_id;
    if (currentSessionId) {
      await query(`UPDATE sessions SET revoked = TRUE WHERE user_id = $1 AND id != $2`, [req.user.id, currentSessionId]);
    }

    // Immediately invalidate user and session in memory cache
    AuthService.invalidateUserCache(req.user.id);
    if (currentSessionId) {
      AuthService.invalidateSessionCache(currentSessionId);
    }
    req.user.must_change_password = false;

    res.status(200).json({
      message: 'Đổi mật khẩu thành công.',
      user: {
        id: req.user.id,
        username: req.user.username,
        fullName: req.user.full_name,
        role: req.user.role,
        isTestTeacher: req.user.is_test_teacher,
        mustChangePassword: false,
        totpEnabled: req.user.totp_enabled,
      },
    });
  }

  static async setupTotp(req: Request, res: Response): Promise<void> {
    if (!req.user || req.user.role === 'student') {
      res.status(403).json({ error: 'Tính năng TOTP 2FA chỉ áp dụng cho Giáo viên và Quản trị viên.' });
      return;
    }

    const { secret, otpauth, recoveryCodes } = AuthService.generateTotpSecret(req.user.username);
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    // Temporarily save secret without enabling yet
    await query(`UPDATE users SET totp_secret = $1 WHERE id = $2`, [secret, req.user.id]);

    res.status(200).json({
      secret,
      qrDataUrl,
      recoveryCodes,
      message: 'Quét mã QR bằng Google Authenticator và xác nhận mã để hoàn tất.',
    });
  }

  static async confirmTotp(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { token, recoveryCodes } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Vui lòng nhập mã 6 số từ ứng dụng xác thực.' });
      return;
    }

    const userRes = await query<{ totp_secret: string | null }>(
      `SELECT totp_secret FROM users WHERE id = $1`,
      [req.user.id]
    );
    const secret = userRes.rows[0]?.totp_secret;
    if (!secret) {
      res.status(400).json({ error: 'Chưa bắt đầu thiết lập 2FA.' });
      return;
    }

    const isValid = AuthService.verifyTotp(token, secret);
    if (!isValid) {
      res.status(400).json({ error: 'Mã xác thực không đúng. Vui lòng thử lại.' });
      return;
    }

    // Save hashed recovery codes and enable TOTP
    const hashedCodes = Array.isArray(recoveryCodes) ? AuthService.hashRecoveryCodes(recoveryCodes) : [];

    await query(
      `UPDATE users
       SET totp_enabled = TRUE, totp_recovery_codes = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(hashedCodes), req.user.id]
    );

    AuthService.invalidateUserCache(req.user.id);

    res.status(200).json({ message: 'Đã kích hoạt xác thực 2 bước (TOTP) thành công.' });
  }

  static async disableTotp(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    await query(
      `UPDATE users
       SET totp_enabled = FALSE, totp_secret = NULL, totp_recovery_codes = NULL, updated_at = NOW()
       WHERE id = $1`,
      [req.user.id]
    );

    AuthService.invalidateUserCache(req.user.id);

    res.status(200).json({ message: 'Đã tắt xác thực 2 bước.' });
  }
}
