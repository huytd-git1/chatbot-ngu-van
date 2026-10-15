import { query } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import { AuthService } from '../services/auth.service.js';

async function createAdmin() {
  await runMigrations();

  const username = process.env.ADMIN_USERNAME || process.argv[2] || 'admin';
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || 'Admin@2026!';
  const fullName = process.env.ADMIN_NAME || process.argv[4] || 'Quản trị viên hệ thống';

  console.log(`[CreateAdmin] Tạo tài khoản Quản trị viên: "${username}"...`);

  const existing = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
  if (existing.rows.length > 0) {
    console.log(`[CreateAdmin] Tài khoản "${username}" đã tồn tại. Cập nhật mật khẩu mới...`);
    const hash = await AuthService.hashPassword(password);
    await query(`UPDATE users SET password_hash = $1, role = 'admin', is_active = TRUE WHERE id = $2`, [hash, existing.rows[0].id]);
    console.log('[CreateAdmin] Cập nhật thành công.');
    process.exit(0);
  }

  const hash = await AuthService.hashPassword(password);
  await query(
    `INSERT INTO users (username, role, password_hash, full_name, is_active, must_change_password)
     VALUES ($1, 'admin', $2, $3, TRUE, FALSE)`,
    [username, hash, fullName]
  );

  console.log(`[CreateAdmin] Thành công! Quản trị viên: ${username} / Mật khẩu: ${password}`);
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('[CreateAdmin] Lỗi:', err);
  process.exit(1);
});
