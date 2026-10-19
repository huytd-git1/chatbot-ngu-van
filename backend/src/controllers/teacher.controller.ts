import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AuthService } from '../services/auth.service.js';
import { CsvService } from '../services/csv.service.js';
import { DocumentService } from '../services/document.service.js';
import { ParagraphService } from '../services/paragraph.service.js';
import { QuotaService } from '../services/quota.service.js';

export class TeacherController {
  /**
   * Helper: checks if teacher is assigned to class (or is admin)
   */
  private static async verifyClassAccess(teacherId: string, classId: string, role: string): Promise<boolean> {
    if (role === 'admin') return true;
    const res = await query(
      `SELECT id FROM teacher_assignments WHERE teacher_id = $1 AND class_id = $2`,
      [teacherId, classId]
    );
    return res.rows.length > 0;
  }

  /**
   * Teacher overview statistics
   */
  static async getOverview(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const teacherId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const dateVn = QuotaService.getVietnamDateString();

    // Classes assigned to teacher
    let classesFilter = isAdmin
      ? `SELECT id, name, grade FROM classes WHERE is_archived = FALSE`
      : `SELECT c.id, c.name, c.grade FROM classes c
         JOIN teacher_assignments ta ON c.id = ta.class_id
         WHERE ta.teacher_id = '${teacherId}' AND c.is_archived = FALSE`;

    const classesRes = await query<{ id: string; name: string; grade: number }>(classesFilter);
    const classIds = classesRes.rows.map(c => c.id);

    if (classIds.length === 0) {
      res.status(200).json({
        totalClasses: 0,
        totalStudents: 0,
        readyDocsCount: 0,
        todayQuestionsCount: 0,
        studentsOutOfQuotaCount: 0,
        sevenDayStats: [],
      });
      return;
    }

    const classIdsList = classIds.map(id => `'${id}'`).join(',');

    // Total students
    const studentsRes = await query(
      `SELECT COUNT(s.id) as count FROM students s WHERE s.class_id IN (${classIdsList})`
    );
    const totalStudents = parseInt(studentsRes.rows[0]?.count ?? '0', 10);

    // Ready documents
    const docsRes = await query(
      `SELECT COUNT(d.id) as count FROM documents d WHERE d.status = 'ready'`
    );
    const readyDocsCount = parseInt(docsRes.rows[0]?.count ?? '0', 10);

    // Today's calls by students in these classes
    const todayRes = await query(
      `SELECT COALESCE(SUM(du.success_count), 0) as today_success,
              COALESCE(SUM(du.no_source_count), 0) as today_no_source
       FROM daily_usage du
       JOIN students s ON du.user_id = s.user_id
       WHERE s.class_id IN (${classIdsList}) AND du.date_vn = $1`,
      [dateVn]
    );
    const todayQuestionsCount = parseInt(todayRes.rows[0]?.today_success ?? '0', 10);

    // 7-day stats
    const sevenDayRes = await query(
      `SELECT du.date_vn,
              COALESCE(SUM(du.success_count), 0) as success_count,
              COALESCE(SUM(du.no_source_count), 0) as no_source_count,
              COALESCE(SUM(du.failed_count), 0) as failed_count
       FROM daily_usage du
       JOIN students s ON du.user_id = s.user_id
       WHERE s.class_id IN (${classIdsList})
       GROUP BY du.date_vn
       ORDER BY du.date_vn DESC
       LIMIT 7`
    );

    res.status(200).json({
      totalClasses: classesRes.rows.length,
      totalStudents,
      readyDocsCount,
      todayQuestionsCount,
      studentsOutOfQuotaCount: 0,
      sevenDayStats: sevenDayRes.rows.reverse(),
    });
  }

  /**
   * List teacher's classes
   */
  static async getClasses(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const isAdmin = req.user.role === 'admin';
    const sql = isAdmin
      ? `SELECT c.id, c.name, c.grade, c.academic_year, c.is_archived, c.created_at,
                COUNT(s.id) as student_count
         FROM classes c
         LEFT JOIN students s ON c.id = s.class_id
         GROUP BY c.id, c.name, c.grade, c.academic_year, c.is_archived, c.created_at
         ORDER BY c.grade, c.name`
      : `SELECT c.id, c.name, c.grade, c.academic_year, c.is_archived, c.created_at,
                COUNT(s.id) as student_count
         FROM classes c
         JOIN teacher_assignments ta ON c.id = ta.class_id
         LEFT JOIN students s ON c.id = s.class_id
         WHERE ta.teacher_id = $1
         GROUP BY c.id, c.name, c.grade, c.academic_year, c.is_archived, c.created_at
         ORDER BY c.grade, c.name`;

    const params = isAdmin ? [] : [req.user.id];
    const { rows } = await query(sql, params);
    res.status(200).json({ classes: rows });
  }

  /**
   * Create class
   */
  static async createClass(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const schema = z.object({
      name: z.string().trim().min(2, 'Tên lớp phải có ít nhất 2 ký tự.'),
      grade: z.coerce.number().min(6).max(12),
      academicYear: z.string().default('2026-2027'),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message });
      return;
    }

    const { name, grade, academicYear } = parse.data;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO classes (name, grade, academic_year) VALUES ($1, $2, $3) RETURNING id`,
      [name, grade, academicYear]
    );
    const newClassId = rows[0].id;

    // Automatically assign creating teacher to class
    await query(
      `INSERT INTO teacher_assignments (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, newClassId]
    );

    res.status(201).json({ message: 'Tạo lớp học thành công.', classId: newClassId });
  }

  /**
   * List students in a class
   */
  static async getStudentsInClass(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { classId } = req.params;
    const hasAccess = await TeacherController.verifyClassAccess(req.user.id, classId, req.user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Bạn không được phân công quản lý lớp này.' });
      return;
    }

    const dateVn = QuotaService.getVietnamDateString();
    const { rows } = await query(
      `SELECT s.id, s.student_code, s.notes, u.id as user_id, u.full_name, u.is_active, u.must_change_password,
              COALESCE(du.success_count, 0) as today_used,
              COALESCE(qeg.extra_total, 0) as today_extra
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN daily_usage du ON s.user_id = du.user_id AND du.date_vn = $2
       LEFT JOIN (
         SELECT student_id, SUM(extra_count) as extra_total
         FROM quota_extra_grants
         WHERE date_vn = $2
         GROUP BY student_id
       ) qeg ON s.id = qeg.student_id
       WHERE s.class_id = $1
       ORDER BY s.student_code`,
      [classId, dateVn]
    );

    res.status(200).json({ students: rows });
  }

  /**
   * Preview CSV import
   */
  static async previewCsv(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { classId } = req.params;
    const hasAccess = await TeacherController.verifyClassAccess(req.user.id, classId, req.user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Không có quyền truy cập lớp học này.' });
      return;
    }

    const csvText = req.body?.csvText || (req.file ? req.file.buffer.toString('utf-8') : '');
    if (!csvText) {
      res.status(400).json({ error: 'Vui lòng cung cấp nội dung file CSV.' });
      return;
    }

    const preview = await CsvService.previewStudentsCsv(csvText, classId);
    res.status(200).json(preview);
  }

  /**
   * Execute CSV import
   */
  static async executeCsvImport(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { classId } = req.params;
    const hasAccess = await TeacherController.verifyClassAccess(req.user.id, classId, req.user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Không có quyền truy cập lớp học này.' });
      return;
    }

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Danh sách học sinh nhập không hợp lệ.' });
      return;
    }

    const result = await CsvService.importValidStudents(rows, classId, req.user.id);
    res.status(200).json({
      message: `Đã nhập thành công ${result.importedCount} học sinh vào lớp.`,
      errors: result.errors,
    });
  }

  /**
   * Get sample CSV template
   */
  static getSampleCsvTemplate(req: Request, res: Response): void {
    const csv = CsvService.getSampleCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mau_nhap_hoc_sinh.csv"');
    res.send(csv);
  }

  /**
   * Lock / Unlock student account
   */
  static async toggleStudentLock(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { studentId } = req.params;
    const { isActive } = req.body;

    const studentRes = await query<{ user_id: string; class_id: string }>(
      `SELECT user_id, class_id FROM students WHERE id = $1`,
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Học sinh không tồn tại.' });
      return;
    }

    const hasAccess = await TeacherController.verifyClassAccess(req.user.id, studentRes.rows[0].class_id, req.user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Không có quyền thao tác học sinh thuộc lớp khác.' });
      return;
    }

    await query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
      [!!isActive, studentRes.rows[0].user_id]
    );

    // If locked, revoke active sessions
    if (!isActive) {
      await AuthService.revokeAllUserSessions(studentRes.rows[0].user_id);
    }

    res.status(200).json({ message: isActive ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản học sinh.' });
  }

  /**
   * Reset student password with temporary password (never reveals old password)
   */
  static async resetStudentPassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { studentId } = req.params;
    const { tempPassword } = req.body;
    const pass = tempPassword?.trim() || 'MatKhauMoi123';

    if (pass.length < 6) {
      res.status(400).json({ error: 'Mật khẩu tạm thời phải có ít nhất 6 ký tự.' });
      return;
    }

    const studentRes = await query<{ user_id: string; class_id: string }>(
      `SELECT user_id, class_id FROM students WHERE id = $1`,
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Học sinh không tồn tại.' });
      return;
    }

    const hasAccess = await TeacherController.verifyClassAccess(req.user.id, studentRes.rows[0].class_id, req.user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Không có quyền đặt lại mật khẩu học sinh lớp khác.' });
      return;
    }

    const passHash = await AuthService.hashPassword(pass);
    await query(
      `UPDATE users
       SET password_hash = $1, must_change_password = TRUE, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [passHash, studentRes.rows[0].user_id]
    );

    // Revoke previous sessions
    await AuthService.revokeAllUserSessions(studentRes.rows[0].user_id);

    res.status(200).json({
      message: `Đã đặt lại mật khẩu tạm thời thành công: "${pass}". Học sinh sẽ được yêu cầu đổi mật khẩu trong lần đăng nhập đầu tiên.`,
    });
  }

  /**
   * Grant extra queries to a student for today
   */
  static async grantExtraQuota(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { studentId } = req.params;
    const { extraCount, reason } = req.body;
    const count = parseInt(extraCount, 10);
    if (isNaN(count) || count <= 0 || count > 50) {
      res.status(400).json({ error: 'Số lượt cấp thêm phải từ 1 đến 50 lượt.' });
      return;
    }

    const dateVn = QuotaService.getVietnamDateString();
    await query(
      `INSERT INTO quota_extra_grants (student_id, date_vn, extra_count, granted_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [studentId, dateVn, count, req.user.id, reason || 'Giáo viên cấp thêm lượt ôn tập']
    );

    res.status(200).json({ message: `Đã cấp thêm ${count} lượt hỏi cho học sinh trong ngày hôm nay (${dateVn}).` });
  }

  /**
   * List works and their assigned classes
   */
  static async getWorks(req: Request, res: Response): Promise<void> {
    const { rows } = await query(
      `SELECT w.id, w.title, w.author, w.grade, w.description, w.status, w.created_at,
              COUNT(d.id) as total_docs,
              COUNT(d.id) as ready_docs
       FROM works w
       LEFT JOIN documents d ON w.id = d.work_id AND d.status = 'ready'
       GROUP BY w.id, w.title, w.author, w.grade, w.description, w.status, w.created_at
       ORDER BY w.grade, w.title`
    );

    // Get assigned class IDs for each work
    const accessRes = await query<{ work_id: string; class_id: string }>(
      `SELECT work_id, class_id FROM class_work_access`
    );
    const accessMap: Record<string, string[]> = {};
    for (const row of accessRes.rows) {
      if (!accessMap[row.work_id]) accessMap[row.work_id] = [];
      accessMap[row.work_id].push(row.class_id);
    }

    const worksWithAccess = rows.map(w => ({
      ...w,
      assignedClassIds: accessMap[w.id] || [],
    }));

    res.status(200).json({ works: worksWithAccess });
  }

  /**
   * Create work
   */
  static async createWork(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const schema = z.object({
      title: z.string().trim().min(2, 'Tên tác phẩm không được để trống.'),
      author: z.string().trim().min(2, 'Tác giả không được để trống.'),
      grade: z.coerce.number().min(6).max(12),
      description: z.string().optional(),
      assignedClassIds: z.array(z.string().uuid()).optional(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message });
      return;
    }

    const { title, author, grade, description, assignedClassIds = [] } = parse.data;

    const { rows } = await query<{ id: string }>(
      `INSERT INTO works (title, author, grade, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, author, grade, description || null, req.user.id]
    );
    const workId = rows[0].id;

    for (const classId of assignedClassIds) {
      await query(
        `INSERT INTO class_work_access (class_id, work_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [classId, workId, req.user.id]
      );
    }

    res.status(201).json({ message: 'Tạo tác phẩm thành công.', workId });
  }

  /**
   * Toggle work access for class
   */
  static async updateWorkClasses(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { workId } = req.params;
    const { classIds } = req.body;

    if (!Array.isArray(classIds)) {
      res.status(400).json({ error: 'Danh sách classIds không hợp lệ.' });
      return;
    }

    // Replace access list
    await query(`DELETE FROM class_work_access WHERE work_id = $1`, [workId]);
    for (const classId of classIds) {
      await query(
        `INSERT INTO class_work_access (class_id, work_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [classId, workId, req.user.id]
      );
    }

    res.status(200).json({ message: 'Đã cập nhật phân quyền lớp cho tác phẩm.' });
  }

  /**
   * List documents for a work
   */
  static async getDocumentsForWork(req: Request, res: Response): Promise<void> {
    const { workId } = req.params;
    const { rows } = await query(
      `SELECT d.*, u.full_name as creator_name, r.full_name as reviewer_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN users r ON d.reviewed_by = r.id
       WHERE d.work_id = $1
       ORDER BY
         CASE WHEN d.document_role = 'primary' AND d.is_active = true THEN 0
              WHEN d.document_role = 'reference' THEN 1
              ELSE 2
         END,
         d.created_at DESC`,
      [workId]
    );

    res.status(200).json({ documents: rows });
  }

  /**
   * Upload document for a work
   */
  static async uploadDocument(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { workId } = req.params;
    const { title, docType, documentRole, referenceType } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Vui lòng chọn file tài liệu để tải lên.' });
      return;
    }

    if (!title || !docType) {
      res.status(400).json({ error: 'Tiêu đề tài liệu và loại phân loại không được để trống.' });
      return;
    }

    const val = DocumentService.validateFile({
      mimetype: file.mimetype,
      size: file.size,
      originalname: file.originalname,
    });
    if (!val.valid) {
      res.status(400).json({ error: val.error });
      return;
    }

    try {
      const result = await DocumentService.uploadDocument({
        workId,
        title,
        docType,
        documentRole,
        referenceType,
        file: {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
        userId: req.user.id,
      });

      res.status(201).json({
        message: 'Tài liệu đã được tải lên và đang được lập chỉ mục (File Search Store Indexing).',
        documentId: result.documentId,
        status: result.status,
        documentRole: result.documentRole,
      });
    } catch (err: any) {
      console.error('[TeacherController] Upload error:', err);
      res.status(500).json({ error: err.message || 'Lỗi xử lý file.' });
    }
  }

  /**
   * Activate document as primary original text (atomic switch)
   */
  static async activatePrimaryDocument(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { documentId } = req.params;
    const docRes = await query<{ work_id: string }>(`SELECT work_id FROM documents WHERE id = $1`, [documentId]);
    if (docRes.rows.length === 0) {
      res.status(404).json({ error: 'Tài liệu không tồn tại.' });
      return;
    }

    try {
      const updated = await DocumentService.activatePrimaryDocument({
        workId: docRes.rows[0].work_id,
        documentId,
        userId: req.user.id,
      });

      res.status(200).json({
        message: 'Đã kích hoạt làm Văn bản tác phẩm gốc (Duy nhất) có hiệu lực.',
        document: updated,
      });
    } catch (err: any) {
      console.error('[TeacherController] activatePrimaryDocument error:', err);
      res.status(500).json({ error: err.message || 'Lỗi kích hoạt văn bản gốc.' });
    }
  }

  /**
   * Update document classification (role, reference_type)
   */
  static async updateDocumentClassification(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { documentId } = req.params;
    const schema = z.object({
      documentRole: z.enum(['primary', 'reference', 'unclassified']),
      referenceType: z.enum(['analysis', 'context', 'lesson_plan', 'other', 'qa_guide']).optional().nullable(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message });
      return;
    }

    try {
      const updated = await DocumentService.updateDocumentClassification({
        documentId,
        documentRole: parse.data.documentRole,
        referenceType: parse.data.referenceType,
        userId: req.user.id,
      });

      res.status(200).json({
        message: 'Đã cập nhật phân loại tài liệu thành công.',
        document: updated,
      });
    } catch (err: any) {
      console.error('[TeacherController] updateDocumentClassification error:', err);
      res.status(500).json({ error: err.message || 'Lỗi cập nhật phân loại tài liệu.' });
    }
  }

  /**
   * Get extracted paragraphs of a document for preview / OCR verification
   */
  static async getDocumentParagraphs(req: Request, res: Response): Promise<void> {
    const { documentId } = req.params;
    const paragraphs = await ParagraphService.getParagraphsForDocument(documentId);
    res.status(200).json({ paragraphs });
  }

  /**
   * Get document diff and alignment report
   */
  static async getDocumentDiffReport(req: Request, res: Response): Promise<void> {
    const { workId } = req.params;
    const report = await ParagraphService.generateDocumentDiffReport(workId);
    res.status(200).json({ report });
  }

  /**
   * Delete document
   */
  static async deleteDocument(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { documentId } = req.params;
    await DocumentService.deleteDocument(documentId);
    res.status(200).json({ message: 'Đã xóa tài liệu khỏi hệ thống.' });
  }

  /**
   * Download original raw text / markdown content of a document
   */
  static async downloadDocument(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { documentId } = req.params;
    try {
      const doc = await DocumentService.getDocumentForDownload(documentId);
      if (!doc.raw_content) {
        res.status(404).json({ error: 'Tài liệu này không có nội dung văn bản để tải về.' });
        return;
      }

      const fileName = doc.file_name || `${doc.title}.txt`;
      const isMd = fileName.toLowerCase().endsWith('.md');
      res.setHeader('Content-Type', isMd ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.send(doc.raw_content);
    } catch (err: any) {
      console.error('[TeacherController] downloadDocument error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi tải tài liệu.' });
    }
  }

  /**
   * Re-upload / replace content of a document with a new .txt or .md file
   */
  static async reuploadDocument(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { documentId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Vui lòng chọn tệp .txt hoặc .md mới để tải lại.' });
      return;
    }

    const val = DocumentService.validateFile({
      mimetype: file.mimetype,
      size: file.size,
      originalname: file.originalname,
    });
    if (!val.valid) {
      res.status(400).json({ error: val.error });
      return;
    }

    try {
      const updated = await DocumentService.reuploadDocument({
        documentId,
        file: {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
        userId: req.user.id,
      });

      res.status(200).json({
        message: 'Đã tải lại và cập nhật nội dung văn bản thành công. Các đoạn văn đã được lập chỉ mục lại.',
        document: updated,
      });
    } catch (err: any) {
      console.error('[TeacherController] reuploadDocument error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi tải lại tệp tài liệu.' });
    }
  }

  /**
   * Get learning settings for class & work
   */
  static async getLearningSettings(req: Request, res: Response): Promise<void> {
    const { classId, workId } = req.params;
    const { rows } = await query(
      `SELECT * FROM learning_settings WHERE class_id = $1 AND work_id = $2`,
      [classId, workId]
    );

    if (rows.length === 0) {
      res.status(200).json({ settings: null });
      return;
    }

    res.status(200).json({ settings: rows[0] });
  }

  /**
   * Update learning settings for class & work
   */
  static async updateLearningSettings(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { classId, workId } = req.params;
    const { prepQuestions, reviewQuestions, learningGoals } = req.body;

    await query(
      `INSERT INTO learning_settings (class_id, work_id, prep_questions, review_questions, learning_goals, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (class_id, work_id)
       DO UPDATE SET prep_questions = $3, review_questions = $4, learning_goals = $5, updated_at = NOW()`,
      [classId, workId, prepQuestions || null, reviewQuestions || null, learningGoals || null]
    );

    res.status(200).json({ message: 'Đã lưu cấu hình bài học thành công.' });
  }

  /**
   * Delete a student from assigned class
   */
  static async deleteStudent(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Chưa đăng nhập.' });
        return;
      }

      const { studentId } = req.params;
      const teacherId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      const studentRes = await query<{
        id: string;
        user_id: string;
        class_id: string;
        student_code: string;
        full_name: string;
        class_name: string;
      }>(
        `SELECT s.id, s.user_id, s.class_id, s.student_code, u.full_name, c.name as class_name
         FROM students s
         JOIN users u ON s.user_id = u.id
         JOIN classes c ON s.class_id = c.id
         WHERE s.id = $1`,
        [studentId]
      );

      if (studentRes.rows.length === 0) {
        res.status(404).json({ error: 'Không tìm thấy học sinh cần xóa.' });
        return;
      }

      const st = studentRes.rows[0];

      // Verify teacher assignment if not admin
      if (!isAdmin) {
        const hasAccess = await TeacherController.verifyClassAccess(teacherId, st.class_id, req.user.role);
        if (!hasAccess) {
          res.status(403).json({ error: 'Bạn không có quyền quản lý học sinh của lớp này.' });
          return;
        }
      }

      // Delete student and underlying user record
      await query(`DELETE FROM students WHERE id = $1`, [studentId]);
      await query(`DELETE FROM users WHERE id = $1`, [st.user_id]);

      // Audit log
      await query(
        `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'DELETE_STUDENT', 'student', $2, $3, $4)`,
        [
          req.user.id,
          studentId,
          JSON.stringify({ studentCode: st.student_code, fullName: st.full_name, className: st.class_name }),
          req.ip,
        ]
      );

      res.status(200).json({
        message: `Đã xóa học sinh ${st.full_name} (${st.student_code}) khỏi lớp ${st.class_name} thành công.`,
      });
    } catch (err: any) {
      console.error('Error in TeacherController.deleteStudent:', err);
      res.status(500).json({ error: 'Không thể xóa học sinh.' });
    }
  }
}
