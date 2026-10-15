import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { query } from '../db/pool.js';
import { CsvService } from '../services/csv.service.js';

describe('CSV Student Import', () => {
  let testClassId: string;

  beforeAll(async () => {
    await runMigrations();

    const cRes = await query<{ id: string }>(
      `INSERT INTO classes (name, grade, academic_year) VALUES ('Lớp CSV Test', 9, '2026-2027') RETURNING id`
    );
    testClassId = cRes.rows[0].id;
  });

  it('generates sample CSV template with UTF-8 BOM', () => {
    const csv = CsvService.getSampleCsv();
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Mã học sinh');
    expect(csv).toContain('Họ và tên');
  });

  it('detects duplicate student codes inside CSV and against database', async () => {
    // 1. Insert existing student into DB
    const existingCode = 'HS_EXISTING_999';
    const uRes = await query<{ id: string }>(
      `INSERT INTO users (username, role, password_hash, full_name)
       VALUES ('${existingCode}', 'student', 'hash', 'Học sinh có sẵn') RETURNING id`
    );
    await query(
      `INSERT INTO students (user_id, student_code, class_id) VALUES ($1, $2, $3)`,
      [uRes.rows[0].id, existingCode, testClassId]
    );

    // 2. CSV containing: 1 valid, 1 duplicate in file, 1 duplicate in DB, 1 empty code
    const rawCsv = `Mã học sinh,Họ và tên,Mật khẩu ban đầu,Ghi chú
HS_NEW_001,Trần Văn Mới,MatKhau123,Học sinh mới
HS_DUP_002,Lê Thị Trùng,MatKhau123,Lần 1
HS_DUP_002,Lê Thị Trùng 2,MatKhau123,Lần 2 trùng
${existingCode},Học sinh trùng DB,MatKhau123,Trùng database
,Học sinh thiếu mã,MatKhau123,Thiếu mã`;

    const preview = await CsvService.previewStudentsCsv(rawCsv, testClassId);
    expect(preview.totalRows).toBe(5);
    expect(preview.validRowsCount).toBe(2); // HS_NEW_001 and first HS_DUP_002
    expect(preview.invalidRowsCount).toBe(3); // second HS_DUP_002, existingCode, empty code

    const dupFileRow = preview.rows.find(r => r.lineNumber === 4);
    expect(dupFileRow?.errors.some(e => e.includes('trùng lặp trong chính file'))).toBe(true);

    const dupDbRow = preview.rows.find(r => r.studentCode === existingCode);
    expect(dupDbRow?.errors.some(e => e.includes('đã tồn tại trong hệ thống'))).toBe(true);
  });

  it('successfully imports valid previewed students into database', async () => {
    const rawCsv = `Mã học sinh,Họ và tên,Mật khẩu ban đầu,Ghi chú
HS_IMPORT_A,Võ Thị Kim A,MatKhau123,Nhập đợt 1
HS_IMPORT_B,Đỗ Hoàng B,MatKhau123,Nhập đợt 1`;

    const preview = await CsvService.previewStudentsCsv(rawCsv, testClassId);
    expect(preview.validRowsCount).toBe(2);

    const result = await CsvService.importValidStudents(preview.rows, testClassId, 'teacher_id');
    expect(result.importedCount).toBe(2);

    const { rows } = await query(
      `SELECT s.student_code, u.full_name, u.must_change_password
       FROM students s JOIN users u ON s.user_id = u.id
       WHERE s.student_code IN ('HS_IMPORT_A', 'HS_IMPORT_B')`
    );
    expect(rows.length).toBe(2);
    expect(rows[0].must_change_password).toBe(true); // Must change on first login
  });
});
