import { query } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import { AuthService } from '../services/auth.service.js';

async function createTestTeacher() {
  await runMigrations();

  const username = process.env.TEST_TEACHER_USERNAME || process.argv[2] || 'giaovientest';
  const password = process.env.TEST_TEACHER_PASSWORD || process.argv[3] || 'TestTeacher@123';
  const fullName = process.env.TEST_TEACHER_NAME || process.argv[4] || 'Giáo viên Kiểm thử RAG';

  console.log(`[CreateTestTeacher] Tạo tài khoản Giáo viên Test (miễn hạn mức cá nhân): "${username}"...`);

  const existing = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
  const hash = await AuthService.hashPassword(password);

  if (existing.rows.length > 0) {
    console.log(`[CreateTestTeacher] Tài khoản "${username}" đã tồn tại. Cập nhật quyền test_teacher và mật khẩu...`);
    await query(
      `UPDATE users
       SET role = 'teacher', is_test_teacher = TRUE, password_hash = $1, is_active = TRUE, must_change_password = TRUE
       WHERE id = $2`,
      [hash, existing.rows[0].id]
    );
  } else {
    await query(
      `INSERT INTO users (username, role, is_test_teacher, password_hash, full_name, is_active, must_change_password)
       VALUES ($1, 'teacher', TRUE, $2, $3, TRUE, TRUE)`,
      [username, hash, fullName]
    );
  }

  console.log(`[CreateTestTeacher] Thành công! Giáo viên Test: ${username} / Mật khẩu tạm: ${password}`);
  console.log(`Lưu ý: Học viên/giáo viên sẽ được yêu cầu đổi mật khẩu lần đầu đăng nhập.`);
  process.exit(0);
}

createTestTeacher().catch((err) => {
  console.error('[CreateTestTeacher] Lỗi:', err);
  process.exit(1);
});
