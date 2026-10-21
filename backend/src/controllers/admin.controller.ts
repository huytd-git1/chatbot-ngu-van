import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AuthService } from '../services/auth.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { QuotaService } from '../services/quota.service.js';

export class AdminController {
  /**
   * List all teachers
   */
  static async getTeachers(req: Request, res: Response): Promise<void> {
    const { rows } = await query(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_test_teacher, u.is_active, u.created_at,
              COUNT(ta.class_id) as assigned_classes_count
       FROM users u
       LEFT JOIN teacher_assignments ta ON u.id = ta.teacher_id
       WHERE u.role = 'teacher'
       GROUP BY u.id, u.username, u.full_name, u.role, u.is_test_teacher, u.is_active, u.created_at
       ORDER BY u.created_at DESC`
    );

    // Get assigned class names
    const assignmentsRes = await query<{ teacher_id: string; class_id: string; class_name: string }>(
      `SELECT ta.teacher_id, ta.class_id, c.name as class_name
       FROM teacher_assignments ta
       JOIN classes c ON ta.class_id = c.id`
    );

    const classMap: Record<string, Array<{ id: string; name: string }>> = {};
    for (const a of assignmentsRes.rows) {
      if (!classMap[a.teacher_id]) classMap[a.teacher_id] = [];
      classMap[a.teacher_id].push({ id: a.class_id, name: a.class_name });
    }

    const teachers = rows.map(t => ({
      ...t,
      assignedClasses: classMap[t.id] || [],
    }));

    res.status(200).json({ teachers });
  }

  /**
   * Create a new teacher
   */
  static async createTeacher(req: Request, res: Response): Promise<void> {
    const schema = z.object({
      username: z.string().trim().min(3, 'Tên đăng nhập tối thiểu 3 ký tự.'),
      password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự.'),
      fullName: z.string().trim().min(2, 'Họ và tên tối thiểu 2 ký tự.'),
      isTestTeacher: z.boolean().default(false),
      assignedClassIds: z.array(z.string().uuid()).optional(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message });
      return;
    }

    const { username, password, fullName, isTestTeacher, assignedClassIds = [] } = parse.data;

    // Check username collision
    const existing = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Tên đăng nhập đã tồn tại trong hệ thống.' });
      return;
    }

    const passHash = await AuthService.hashPassword(password);
    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (username, role, is_test_teacher, password_hash, full_name, must_change_password)
       VALUES ($1, 'teacher', $2, $3, $4, TRUE)
       RETURNING id`,
      [username, isTestTeacher, passHash, fullName]
    );
    const teacherId = rows[0].id;

    for (const classId of assignedClassIds) {
      await query(
        `INSERT INTO teacher_assignments (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [teacherId, classId]
      );
    }

    res.status(201).json({ message: 'Tạo giáo viên thành công.', teacherId });
  }

  /**
   * Toggle teacher_test status
   */
  static async toggleTestRole(req: Request, res: Response): Promise<void> {
    const { teacherId } = req.params;
    const { isTestTeacher } = req.body;

    await query(
      `UPDATE users SET is_test_teacher = $1, updated_at = NOW() WHERE id = $2 AND role = 'teacher'`,
      [!!isTestTeacher, teacherId]
    );

    res.status(200).json({
      message: isTestTeacher
        ? 'Đã cấp quyền Giáo viên Test (miễn hạn mức cá nhân ngày).'
        : 'Đã thu hồi quyền Giáo viên Test (áp dụng lại hạn mức bình thường).',
    });
  }

  /**
   * Assign classes to teacher
   */
  static async assignClasses(req: Request, res: Response): Promise<void> {
    const { teacherId } = req.params;
    const { classIds } = req.body;

    if (!Array.isArray(classIds)) {
      res.status(400).json({ error: 'Danh sách classIds không hợp lệ.' });
      return;
    }

    await query(`DELETE FROM teacher_assignments WHERE teacher_id = $1`, [teacherId]);
    for (const cid of classIds) {
      await query(
        `INSERT INTO teacher_assignments (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [teacherId, cid]
      );
    }

    res.status(200).json({ message: 'Đã cập nhật phân công lớp cho giáo viên.' });
  }

  /**
   * Delete a teacher account and cleanup assignments
   */
  static async deleteTeacher(req: Request, res: Response): Promise<void> {
    const { teacherId } = req.params;

    if (req.user?.id === teacherId) {
      res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình.' });
      return;
    }

    const teacherRes = await query<{ id: string; username: string; full_name: string }>(
      `SELECT id, username, full_name FROM users WHERE id = $1 AND role = 'teacher'`,
      [teacherId]
    );

    if (teacherRes.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy giáo viên cần xóa.' });
      return;
    }

    const teacher = teacherRes.rows[0];

    // Delete teacher assignments, sessions, and user record
    await query(`DELETE FROM teacher_assignments WHERE teacher_id = $1`, [teacherId]);
    await query(`DELETE FROM sessions WHERE user_id = $1`, [teacherId]);
    await query(`DELETE FROM users WHERE id = $1`, [teacherId]);

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, 'DELETE_TEACHER', 'teacher', $2, $3, $4)`,
      [
        req.user?.id || null,
        teacherId,
        JSON.stringify({ username: teacher.username, fullName: teacher.full_name }),
        req.ip,
      ]
    );

    res.status(200).json({
      message: `Đã xóa tài khoản giáo viên "${teacher.full_name}" (@${teacher.username}) thành công.`,
    });
  }

  /**
   * List all classes in the system with student and teacher counts
   */
  static async getAllClasses(req: Request, res: Response): Promise<void> {
    try {
      const { rows } = await query(
        `SELECT c.id, c.name, c.grade, c.academic_year,
                COUNT(DISTINCT s.id) as student_count,
                COUNT(DISTINCT ta.teacher_id) as teacher_count
         FROM classes c
         LEFT JOIN students s ON c.id = s.class_id
         LEFT JOIN teacher_assignments ta ON c.id = ta.class_id
         WHERE c.is_archived = FALSE
         GROUP BY c.id, c.name, c.grade, c.academic_year
         ORDER BY c.grade ASC, c.name ASC`
      );

      res.status(200).json({ classes: rows });
    } catch (err: any) {
      console.error('Error in AdminController.getAllClasses:', err);
      res.status(500).json({ error: 'Không thể tải danh sách lớp học.' });
    }
  }

  /**
   * Create a new class
   */
  static async createClass(req: Request, res: Response): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().trim().min(1, 'Tên lớp không được để trống.'),
        grade: z.number().int().min(6).max(12),
        academicYear: z.string().default('2025-2026'),
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

      res.status(201).json({ message: 'Tạo lớp học thành công.', classId: rows[0].id });
    } catch (err: any) {
      console.error('Error in AdminController.createClass:', err);
      res.status(500).json({ error: 'Không thể tạo lớp học.' });
    }
  }

  /**
   * Delete an empty class
   */
  static async deleteClass(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;

      const stdCount = await query(`SELECT COUNT(id) as count FROM students WHERE class_id = $1`, [classId]);
      if (parseInt(stdCount.rows[0]?.count ?? '0', 10) > 0) {
        res.status(400).json({ error: 'Không thể xóa lớp đang có học sinh. Vui lòng chuyển hoặc xóa học sinh trước.' });
        return;
      }

      await query(`DELETE FROM teacher_assignments WHERE class_id = $1`, [classId]);
      await query(`DELETE FROM class_work_access WHERE class_id = $1`, [classId]);
      await query(`DELETE FROM classes WHERE id = $1`, [classId]);

      res.status(200).json({ message: 'Đã xóa lớp học thành công.' });
    } catch (err: any) {
      console.error('Error in AdminController.deleteClass:', err);
      res.status(500).json({ error: 'Không thể xóa lớp học.' });
    }
  }

  /**
   * List all students in a specific class for Admin view
   */
  static async getStudentsInClass(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;
      const dateVn = QuotaService.getVietnamDateString();

      const { rows } = await query(
        `SELECT s.id, s.student_code, s.notes, s.created_at,
                u.id as user_id, u.username, u.full_name, u.is_active, u.must_change_password,
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
         ORDER BY s.student_code ASC`,
        [classId, dateVn]
      );

      res.status(200).json({ students: rows });
    } catch (err: any) {
      console.error('Error in AdminController.getStudentsInClass:', err);
      res.status(500).json({ error: 'Không thể tải danh sách học sinh: ' + (err.message || 'Lỗi cơ sở dữ liệu') });
    }
  }

  /**
   * Delete a student account (Admin supreme privilege)
   */
  static async deleteStudent(req: Request, res: Response): Promise<void> {
    try {
      const { studentId } = req.params;

      const studentRes = await query<{
        id: string;
        user_id: string;
        student_code: string;
        full_name: string;
        class_name: string;
      }>(
        `SELECT s.id, s.user_id, s.student_code, u.full_name, c.name as class_name
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

      // Cascade deletes sessions and student record when user is deleted
      await query(`DELETE FROM students WHERE id = $1`, [studentId]);
      await query(`DELETE FROM users WHERE id = $1`, [st.user_id]);

      // Audit log
      await query(
        `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'DELETE_STUDENT', 'student', $2, $3, $4)`,
        [
          req.user?.id || null,
          studentId,
          JSON.stringify({ studentCode: st.student_code, fullName: st.full_name, className: st.class_name }),
          req.ip,
        ]
      );

      res.status(200).json({
        message: `Đã xóa học sinh ${st.full_name} (${st.student_code}) khỏi lớp ${st.class_name} thành công.`,
      });
    } catch (err: any) {
      console.error('Error in AdminController.deleteStudent:', err);
      res.status(500).json({ error: 'Không thể xóa học sinh.' });
    }
  }

  /**
   * Get system settings & kill-switch status
   */
  static async getSystemSettings(req: Request, res: Response): Promise<void> {
    const { rows } = await query(
      `SELECT * FROM quota_settings WHERE scope_type = 'system' AND scope_id = 'default'`
    );
    const settings = rows[0] || {
      daily_limit: 20,
      system_hard_cap: 5000,
      is_kill_switch_active: false,
    };

    res.status(200).json({
      settings,
      geminiConfigured: GeminiService.isLiveApiConfigured(),
    });
  }

  /**
   * Update system settings & kill-switch
   */
  static async updateSystemSettings(req: Request, res: Response): Promise<void> {
    const { dailyLimit, systemHardCap, isKillSwitchActive } = req.body;

    await query(
      `UPDATE quota_settings
       SET daily_limit = COALESCE($1, daily_limit),
           system_hard_cap = COALESCE($2, system_hard_cap),
           is_kill_switch_active = COALESCE($3, is_kill_switch_active),
           updated_at = NOW()
       WHERE scope_type = 'system' AND scope_id = 'default'`,
      [dailyLimit, systemHardCap, isKillSwitchActive]
    );

    res.status(200).json({ message: 'Đã cập nhật cấu hình hệ thống thành công.' });
  }

  /**
   * View audit logs
   */
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    const { rows } = await query(
      `SELECT al.*, u.username, u.full_name, u.role
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 100`
    );

    res.status(200).json({ logs: rows });
  }

  /**
   * Get Gemini AI Configuration
   */
  static async getAiSettings(req: Request, res: Response): Promise<void> {
    const { keyUsageMap, tokenStats } = await GeminiService.getKeyUsageStats();
    const summary = GeminiService.getAiConfigSummary(keyUsageMap, tokenStats);
    res.status(200).json(summary);
  }

  /**
   * Update Gemini AI Configuration (API Key & Model, or Third-Party Gateway)
   */
  static async updateAiSettings(req: Request, res: Response): Promise<void> {
    const schema = z.object({
      apiKey: z.string().optional(),
      modelName: z.string().optional(),
      embeddingModel: z.string().optional(),
      providerType: z.enum(['google_official', 'third_party']).optional(),
      customBaseUrl: z.string().optional(),
      customApiKey: z.string().optional(),
      customModelName: z.string().optional(),
      replaceKeys: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dữ liệu cấu hình AI không hợp lệ.' });
      return;
    }

    const {
      apiKey,
      modelName,
      embeddingModel,
      providerType,
      customBaseUrl,
      customApiKey,
      customModelName,
      replaceKeys,
    } = parsed.data;

    await GeminiService.updateAiConfig({
      apiKey,
      modelName,
      embeddingModel,
      providerType,
      customBaseUrl,
      customApiKey,
      customModelName,
      replaceKeys,
    });

    const keyCount = apiKey ? GeminiService.parseKeys(apiKey).length : undefined;
    const customKeyCount = customApiKey ? GeminiService.parseKeys(customApiKey).length : undefined;

    // Log admin action
    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, 'UPDATE_AI_CONFIG', 'system', 'gemini_ai', $2, $3)`,
      [
        req.user?.id || null,
        JSON.stringify({
          providerType,
          modelName,
          customModelName,
          hasNewApiKey: !!(apiKey && apiKey.trim() !== ''),
          hasNewCustomApiKey: !!(customApiKey && customApiKey.trim() !== ''),
          keyCount,
          customKeyCount,
        }),
        req.ip,
      ]
    );

    const { keyUsageMap, tokenStats } = await GeminiService.getKeyUsageStats();
    res.status(200).json({
      message: 'Đã cập nhật cấu hình AI thành công.',
      config: GeminiService.getAiConfigSummary(keyUsageMap, tokenStats),
    });
  }

  /**
   * Test connection to Gemini API or Third-Party Gateway
   */
  static async testAiConnection(req: Request, res: Response): Promise<void> {
    const { apiKey, modelName, providerType, customBaseUrl, customApiKey, customModelName } = req.body;
    const result = await GeminiService.testConnection(apiKey, modelName, {
      providerType,
      customBaseUrl,
      customApiKey,
      customModelName,
    });
    res.status(200).json(result);
  }

  /**
   * Delete a specific API key from the active pool by index
   */
  static async deleteAiKey(req: Request, res: Response): Promise<void> {
    const index = parseInt(req.params.index, 10);
    const provider = (req.query.provider as 'google_official' | 'third_party') || 'google_official';
    if (isNaN(index)) {
      res.status(400).json({ error: 'Chỉ số API Key không hợp lệ.' });
      return;
    }

    try {
      await GeminiService.removeKeyByIndex(index, provider);

      // Log admin action
      await query(
        `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'DELETE_AI_KEY', 'system', 'gemini_ai', $2, $3)`,
        [req.user?.id || null, JSON.stringify({ deletedKeyIndex: index, provider }), req.ip]
      );

      const { keyUsageMap, tokenStats } = await GeminiService.getKeyUsageStats();
      res.status(200).json({
        message: `Đã xóa ${provider === 'third_party' ? 'Token bên thứ 3' : 'API Key'} #${index} thành công.`,
        config: GeminiService.getAiConfigSummary(keyUsageMap, tokenStats),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Không thể xóa API Key.' });
    }
  }

  /**
   * Clear all API keys from the pool (reset to Mock mode)
   */
  static async clearAllAiKeys(req: Request, res: Response): Promise<void> {
    const provider = (req.query.provider as 'google_official' | 'third_party') || 'google_official';
    try {
      await GeminiService.clearAllKeys(provider);

      // Log admin action
      await query(
        `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'CLEAR_ALL_AI_KEYS', 'system', 'gemini_ai', $2, $3)`,
        [req.user?.id || null, JSON.stringify({ provider }), req.ip]
      );

      const { keyUsageMap, tokenStats } = await GeminiService.getKeyUsageStats();
      res.status(200).json({
        message: `Đã xóa toàn bộ ${provider === 'third_party' ? 'Token bên thứ 3' : 'Gemini API Keys'}.`,
        config: GeminiService.getAiConfigSummary(keyUsageMap, tokenStats),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Không thể xóa danh sách API Keys.' });
    }
  }

  /**
   * Reset all token usage statistics
   */
  static async resetAiTokenStats(req: Request, res: Response): Promise<void> {
    try {
      await GeminiService.resetTokenUsageStats();

      // Log admin action
      await query(
        `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
         VALUES ($1, 'RESET_AI_TOKEN_STATS', 'system', 'gemini_ai', '{}', $2)`,
        [req.user?.id || null, req.ip]
      );

      const { keyUsageMap, tokenStats } = await GeminiService.getKeyUsageStats();
      res.status(200).json({
        message: 'Đã đặt lại toàn bộ thống kê tiêu thụ token thành công.',
        config: GeminiService.getAiConfigSummary(keyUsageMap, tokenStats),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Không thể đặt lại thống kê token.' });
    }
  }
}
