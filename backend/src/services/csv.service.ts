import { query } from '../db/pool.js';
import { AuthService } from './auth.service.js';

export interface CsvStudentRow {
  lineNumber: number;
  studentCode: string;
  fullName: string;
  password?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export interface CsvPreviewResult {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: CsvStudentRow[];
}

export class CsvService {
  /**
   * Generates a sample CSV string with UTF-8 BOM for Excel compatibility
   */
  static getSampleCsv(): string {
    const bom = '\uFEFF';
    const header = 'Mã học sinh,Họ và tên,Mật khẩu ban đầu,Ghi chú\n';
    const sampleRows = [
      'HS2026001,Nguyễn Văn An,MatKhau123,Học sinh lớp 9A1',
      'HS2026002,Trần Thị Bình,MatKhau123,Học sinh lớp 9A1',
      'HS2026003,Lê Hoàng Cường,MatKhau123,Đội tuyển Ngữ văn',
    ].join('\n');
    return bom + header + sampleRows;
  }

  /**
   * Parses CSV lines manually to handle quotes, commas, and various line endings safely
   */
  static parseCsvLines(csvText: string): string[][] {
    // Remove BOM if present
    const cleanText = csvText.replace(/^\uFEFF/, '').trim();
    const lines: string[][] = [];
    const rawLines = cleanText.split(/\r?\n/);

    for (const rawLine of rawLines) {
      if (!rawLine.trim()) continue;
      // Parse CSV line handling quotes
      const row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < rawLine.length; i++) {
        const char = rawLine[i];
        if (char === '"') {
          if (inQuotes && rawLine[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      lines.push(row);
    }
    return lines;
  }

  /**
   * Previews CSV and identifies duplicates and invalid rows
   */
  static async previewStudentsCsv(csvText: string, targetClassId: string): Promise<CsvPreviewResult> {
    const lines = this.parseCsvLines(csvText);
    if (lines.length === 0) {
      return { totalRows: 0, validRowsCount: 0, invalidRowsCount: 0, rows: [] };
    }

    // Determine header mapping
    const header = lines[0].map(h => h.toLowerCase());
    let codeIdx = header.findIndex(h => h.includes('mã') || h.includes('code'));
    let nameIdx = header.findIndex(h => h.includes('tên') || h.includes('name'));
    let passIdx = header.findIndex(h => h.includes('mật khẩu') || h.includes('pass'));
    let noteIdx = header.findIndex(h => h.includes('ghi chú') || h.includes('note'));

    if (codeIdx === -1) codeIdx = 0;
    if (nameIdx === -1) nameIdx = 1;
    if (passIdx === -1) passIdx = 2;
    if (noteIdx === -1) noteIdx = 3;

    const dataLines = lines.slice(1);
    const seenCodesInFile = new Set<string>();
    const evaluatedRows: CsvStudentRow[] = [];

    // Query existing student codes in DB
    const existingCodesRes = await query<{ student_code: string }>(
      `SELECT student_code FROM students`
    );
    const existingCodesInDb = new Set(existingCodesRes.rows.map(r => r.student_code.toLowerCase()));

    for (let i = 0; i < dataLines.length; i++) {
      const lineNum = i + 2; // 1-indexed, skipping header
      const row = dataLines[i];
      const studentCode = (row[codeIdx] || '').trim();
      const fullName = (row[nameIdx] || '').trim();
      const password = (row[passIdx] || 'MatKhau123').trim();
      const notes = (row[noteIdx] || '').trim();

      const errors: string[] = [];

      if (!studentCode) {
        errors.push('Mã học sinh không được để trống.');
      } else {
        const lowerCode = studentCode.toLowerCase();
        if (seenCodesInFile.has(lowerCode)) {
          errors.push(`Mã học sinh "${studentCode}" bị trùng lặp trong chính file CSV.`);
        } else {
          seenCodesInFile.add(lowerCode);
        }

        if (existingCodesInDb.has(lowerCode)) {
          errors.push(`Mã học sinh "${studentCode}" đã tồn tại trong hệ thống.`);
        }
      }

      if (!fullName) {
        errors.push('Họ và tên không được để trống.');
      }

      if (password && password.length < 6) {
        errors.push('Mật khẩu ban đầu phải có ít nhất 6 ký tự.');
      }

      evaluatedRows.push({
        lineNumber: lineNum,
        studentCode,
        fullName,
        password,
        notes,
        isValid: errors.length === 0,
        errors,
      });
    }

    const validCount = evaluatedRows.filter(r => r.isValid).length;
    const invalidCount = evaluatedRows.length - validCount;

    return {
      totalRows: evaluatedRows.length,
      validRowsCount: validCount,
      invalidRowsCount: invalidCount,
      rows: evaluatedRows,
    };
  }

  /**
   * Commits the valid rows from the CSV preview into database
   */
  static async importValidStudents(
    previewRows: CsvStudentRow[],
    classId: string,
    importedByTeacherId: string
  ): Promise<{ importedCount: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const row of previewRows) {
      if (!row.isValid) continue;

      try {
        const tempPass = row.password || 'MatKhau123';
        const passHash = await AuthService.hashPassword(tempPass);

        // 1. Create user account
        const userRes = await query<{ id: string }>(
          `INSERT INTO users (username, role, password_hash, full_name, must_change_password)
           VALUES ($1, 'student', $2, $3, TRUE)
           RETURNING id`,
          [row.studentCode, passHash, row.fullName]
        );
        const userId = userRes.rows[0].id;

        // 2. Create student record
        await query(
          `INSERT INTO students (user_id, student_code, class_id, notes)
           VALUES ($1, $2, $3, $4)`,
          [userId, row.studentCode, classId, row.notes || null]
        );

        imported++;
      } catch (err: any) {
        errors.push(`Dòng ${row.lineNumber} (${row.studentCode}): ${err.message}`);
      }
    }

    return { importedCount: imported, errors };
  }
}
