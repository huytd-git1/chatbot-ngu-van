import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { query } from '../db/pool.js';
import { AuthService, UserRow } from '../services/auth.service.js';
import { QuotaService } from '../services/quota.service.js';

describe('Quota Engine & Anti-abuse', () => {
  let studentUser: UserRow;
  let testTeacherUser: UserRow;
  let sampleWorkId: string;
  let sampleClassId: string;

  beforeAll(async () => {
    await runMigrations();

    // Create a student user
    const hash = await AuthService.hashPassword('Pass123');
    const uRes = await query<UserRow>(
      `INSERT INTO users (username, role, password_hash, full_name)
       VALUES ('quota_student_1', 'student', $1, 'Học Sinh Quota')
       RETURNING *`,
      [hash]
    );
    studentUser = uRes.rows[0];

    // Create a test teacher user
    const tRes = await query<UserRow>(
      `INSERT INTO users (username, role, is_test_teacher, password_hash, full_name)
       VALUES ('quota_teacher_test', 'teacher', TRUE, $1, 'Giáo Viên Test Quota')
       RETURNING *`,
      [hash]
    );
    testTeacherUser = tRes.rows[0];

    // Create class and assign student
    const cRes = await query<{ id: string }>(
      `INSERT INTO classes (name, grade, academic_year) VALUES ('Lớp Quota', 9, '2026-2027') RETURNING id`
    );
    sampleClassId = cRes.rows[0].id;

    await query(
      `INSERT INTO students (user_id, student_code, class_id) VALUES ($1, 'HS_QUOTA_01', $2)`,
      [studentUser.id, sampleClassId]
    );

    // Create work
    const wRes = await query<{ id: string }>(
      `INSERT INTO works (title, author, grade) VALUES ('Tác phẩm Quota', 'Tác giả', 9) RETURNING id`
    );
    sampleWorkId = wRes.rows[0].id;
  });

  it('respects timezone Asia/Ho_Chi_Minh and returns YYYY-MM-DD', () => {
    const vnDate = QuotaService.getVietnamDateString();
    expect(vnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves quota precedence: Student > Class > System', async () => {
    // 1. Default system quota is 20
    const limitDefault = await QuotaService.getEffectiveLimit(studentUser.id);
    expect(limitDefault).toBe(20);

    // 2. Set Class quota to 25
    await query(
      `INSERT INTO quota_settings (scope_type, scope_id, daily_limit) VALUES ('class', $1, 25)
       ON CONFLICT (scope_type, scope_id) DO UPDATE SET daily_limit = 25`,
      [sampleClassId]
    );
    const limitClass = await QuotaService.getEffectiveLimit(studentUser.id);
    expect(limitClass).toBe(25);

    // 3. Set Student quota to 30
    await query(
      `INSERT INTO quota_settings (scope_type, scope_id, daily_limit) VALUES ('student', $1, 30)
       ON CONFLICT (scope_type, scope_id) DO UPDATE SET daily_limit = 30`,
      [studentUser.id]
    );
    const limitStudent = await QuotaService.getEffectiveLimit(studentUser.id);
    expect(limitStudent).toBe(30);
  });

  it('supports extra daily grants by teacher', async () => {
    const vnDate = QuotaService.getVietnamDateString();
    const studentRes = await query<{ id: string }>(`SELECT id FROM students WHERE user_id = $1`, [studentUser.id]);
    const studentId = studentRes.rows[0].id;

    await query(
      `INSERT INTO quota_extra_grants (student_id, date_vn, extra_count, granted_by, reason)
       VALUES ($1, $2, 5, $3, 'Cấp thêm lượt ôn thi')`,
      [studentId, vnDate, testTeacherUser.id]
    );

    const extra = await QuotaService.getExtraGrants(studentUser.id, vnDate);
    expect(extra).toBe(5);

    const info = await QuotaService.getUserQuotaInfo(studentUser);
    expect(info.extraGranted).toBe(5);
    expect(info.limit).toBe(30 + 5); // 30 student base + 5 extra
  });

  it('atomically reserves quota and handles idempotency deduplication', async () => {
    const idempKey = 'idemp_key_123456';
    const prompt = 'Nhân vật anh thanh niên có phẩm chất gì?';

    // 1. First attempt: allowed
    const res1 = await QuotaService.reserveQuota(studentUser, sampleWorkId, prompt, 'qa', idempKey);
    expect(res1.allowed).toBe(true);

    // Record as success
    await QuotaService.recordSuccess(studentUser.id, idempKey, 'Anh thanh niên rất nhiệt huyết.', [], 100);

    // 2. Retry with SAME key and SAME prompt: returns existing without extra charge
    const resRetry = await QuotaService.reserveQuota(studentUser, sampleWorkId, prompt, 'qa', idempKey);
    expect(resRetry.allowed).toBe(false);
    expect(resRetry.existingResponse).toBe('Anh thanh niên rất nhiệt huyết.');

    // 3. Retry with SAME key but DIFFERENT prompt: rejected as tampering collision
    const resTamper = await QuotaService.reserveQuota(studentUser, sampleWorkId, 'Câu hỏi khác', 'qa', idempKey);
    expect(resTamper.allowed).toBe(false);
    expect(resTamper.reason).toContain('Idempotency key collision');
  });

  it('exempts teacher_test from daily quota limit while tracking usage', async () => {
    const idempKey = 'test_teacher_idemp_999';
    const prompt = 'Thầy cô hỏi câu hỏi kiểm thử';

    const info = await QuotaService.getUserQuotaInfo(testTeacherUser);
    expect(info.isUnlimited).toBe(true);
    expect(info.remaining).toBe(999999);

    const res = await QuotaService.reserveQuota(testTeacherUser, sampleWorkId, prompt, 'qa', idempKey);
    expect(res.allowed).toBe(true);

    await QuotaService.recordSuccess(testTeacherUser.id, idempKey, 'Phản hồi test', [], 50);

    // Verify usage recorded
    const vnDate = QuotaService.getVietnamDateString();
    const { rows } = await query(
      `SELECT success_count FROM daily_usage WHERE user_id = $1 AND date_vn = $2`,
      [testTeacherUser.id, vnDate]
    );
    expect(rows[0].success_count).toBeGreaterThanOrEqual(1);
  });
});
