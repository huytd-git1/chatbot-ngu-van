import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AuthService } from '../services/auth.service.js';
import { GeminiService } from '../services/gemini.service.js';

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
    const summary = GeminiService.getAiConfigSummary();
    res.status(200).json(summary);
  }

  /**
   * Update Gemini AI Configuration (API Key & Model)
   */
  static async updateAiSettings(req: Request, res: Response): Promise<void> {
    const schema = z.object({
      apiKey: z.string().optional(),
      modelName: z.string().optional(),
      embeddingModel: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dữ liệu cấu hình AI không hợp lệ.' });
      return;
    }

    const { apiKey, modelName, embeddingModel } = parsed.data;
    await GeminiService.updateAiConfig({ apiKey, modelName, embeddingModel });

    // Log admin action
    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, 'UPDATE_AI_CONFIG', 'system', 'gemini_ai', $2, $3)`,
      [
        req.user?.id || null,
        JSON.stringify({
          modelName,
          hasNewApiKey: !!(apiKey && apiKey.trim() !== ''),
        }),
        req.ip,
      ]
    );

    res.status(200).json({
      message: 'Đã cập nhật cấu hình Google Gemini AI thành công.',
      config: GeminiService.getAiConfigSummary(),
    });
  }

  /**
   * Test connection to Gemini API with selected model
   */
  static async testAiConnection(req: Request, res: Response): Promise<void> {
    const { apiKey, modelName } = req.body;
    const result = await GeminiService.testConnection(apiKey, modelName);
    res.status(result.success ? 200 : 400).json(result);
  }
}
