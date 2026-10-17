import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { QuotaService } from '../services/quota.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { DocumentService } from '../services/document.service.js';

const askSchema = z.object({
  workId: z.string().uuid('ID tác phẩm không hợp lệ.'),
  question: z.string().trim().min(2, 'Vui lòng nhập câu hỏi có ít nhất 2 ký tự.').max(1000, 'Câu hỏi quá dài (tối đa 1000 ký tự).'),
  learningMode: z.enum(['qa', 'character_analysis', 'outline', 'reading_comprehension', 'essay_feedback', 'prep_and_review']).default('qa'),
  idempotencyKey: z.string().min(8, 'Idempotency key không hợp lệ.').max(128),
  history: z.array(z.object({
    sender: z.enum(['user', 'ai']),
    text: z.string().max(4000),
  })).optional().default([]),
});

export class StudentController {
  /**
   * Lists works accessible to the student
   */
  static async getAssignedWorks(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    let worksQuery = '';
    let params: any[] = [];

    if (req.user.role === 'admin' || req.user.is_test_teacher) {
      // Admin and teacher_test can see all active works
      worksQuery = `
        SELECT w.id, w.title, w.author, w.grade, w.description, w.status,
               COUNT(d.id) as ready_docs_count
        FROM works w
        LEFT JOIN documents d ON w.id = d.work_id AND d.status = 'ready'
        WHERE w.status = 'active'
        GROUP BY w.id, w.title, w.author, w.grade, w.description, w.status
        ORDER BY w.grade, w.title
      `;
    } else {
      // Find student's class
      const stRes = await query<{ class_id: string }>(
        `SELECT class_id FROM students WHERE user_id = $1`,
        [req.user.id]
      );
      if (stRes.rows.length === 0) {
        res.status(403).json({ error: 'Học sinh chưa được phân vào lớp học nào.' });
        return;
      }
      const classId = stRes.rows[0].class_id;

      worksQuery = `
        SELECT w.id, w.title, w.author, w.grade, w.description, w.status,
               COUNT(d.id) as ready_docs_count
        FROM works w
        JOIN class_work_access cwa ON w.id = cwa.work_id
        LEFT JOIN documents d ON w.id = d.work_id AND d.status = 'ready'
        WHERE cwa.class_id = $1 AND w.status = 'active'
        GROUP BY w.id, w.title, w.author, w.grade, w.description, w.status
        ORDER BY w.grade, w.title
      `;
      params = [classId];
    }

    const { rows } = await query(worksQuery, params);
    res.status(200).json({ works: rows });
  }

  /**
   * Retrieves quota info for the current user
   */
  static async getQuota(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const quotaInfo = await QuotaService.getUserQuotaInfo(req.user);
    res.status(200).json({ quota: quotaInfo });
  }

  /**
   * Handles student RAG inquiry
   */
  static async askQuestion(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const parse = askSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
      return;
    }

    const { workId, question, learningMode, idempotencyKey } = parse.data;

    // 1. Verify access to the work
    const workRes = await query<{ id: string; title: string; author: string }>(
      `SELECT id, title, author FROM works WHERE id = $1 AND status = 'active'`,
      [workId]
    );
    if (workRes.rows.length === 0) {
      res.status(404).json({ error: 'Tác phẩm không tồn tại hoặc đã bị lưu trữ.' });
      return;
    }
    const work = workRes.rows[0];

    let classId: string | null = null;
    if (req.user.role === 'student') {
      const studentRes = await query<{ class_id: string }>(
        `SELECT class_id FROM students WHERE user_id = $1`,
        [req.user.id]
      );
      if (studentRes.rows.length === 0) {
        res.status(403).json({ error: 'Học sinh chưa được gán lớp.' });
        return;
      }
      classId = studentRes.rows[0].class_id;

      // Check class_work_access
      const accessRes = await query(
        `SELECT id FROM class_work_access WHERE class_id = $1 AND work_id = $2`,
        [classId, workId]
      );
      if (accessRes.rows.length === 0) {
        res.status(403).json({ error: 'Lớp học của em chưa được giáo viên cấp quyền truy cập tác phẩm này.' });
        return;
      }
    }

    // 2. Atomically reserve quota
    const reservation = await QuotaService.reserveQuota(
      req.user,
      workId,
      question,
      learningMode,
      idempotencyKey
    );

    // If duplicate idempotent retry
    if (reservation.existingResponse) {
      res.status(200).json({
        answer: reservation.existingResponse,
        citations: reservation.citationsMeta || [],
        isNoSource: false,
        isCached: true,
      });
      return;
    }

    if (!reservation.allowed) {
      res.status(429).json({ error: reservation.reason || 'Không đủ hạn mức.' });
      return;
    }

    // 3. Retrieve ready documents for this work
    const docsRes = await query<{
      id: string;
      title: string;
      doc_type: string;
      file_search_store_name: string;
      raw_content: string | null;
    }>(
      `SELECT id, title, doc_type, file_search_store_name, raw_content
       FROM documents
       WHERE work_id = $1 AND status = 'ready'`,
      [workId]
    );

    if (docsRes.rows.length === 0) {
      // No ready documents -> return polite refusal, record no_source (does NOT deduct student quota)
      const refusalMsg = `Hiện tại chưa có tài liệu chính thức nào sẵn sàng cho tác phẩm "${work.title}". Em hãy báo giáo viên phụ trách cập nhật tài liệu bài học nhé!`;
      await QuotaService.recordNoSource(req.user.id, idempotencyKey, refusalMsg);
      res.status(200).json({
        answer: refusalMsg,
        citations: [],
        isNoSource: true,
        toolConfigured: false,
        message: 'Chưa có tài liệu sẵn sàng.',
      });
      return;
    }

    // Extract unique file_search_store_names
    const storeNames = Array.from(new Set(docsRes.rows.map(d => d.file_search_store_name)));
    const docTitles = docsRes.rows.map(d => d.title);
    const mockSnippets = docsRes.rows
      .filter(d => (d.raw_content || '').trim().length > 0)
      .map(d => {
        const typeLabel =
          d.doc_type === 'text_primary'
            ? 'Văn bản nguyên tác'
            : d.doc_type === 'analysis'
            ? 'Tài liệu phân tích chuyên sâu'
            : d.doc_type === 'lesson_plan'
            ? 'Giáo án bài giảng'
            : 'Hướng dẫn hỏi đáp đọc hiểu';
        return `[TÀI LIỆU CHÍNH THỨC: "${d.title}" | PHÂN LOẠI: ${typeLabel}]:\n${d.raw_content}`;
      });

    // 4. Retrieve teacher learning settings if prep_and_review mode
    let prepReviewSettings: { prepQuestions?: string; reviewQuestions?: string; learningGoals?: string } | undefined;
    if (learningMode === 'prep_and_review' && classId) {
      const lsRes = await query<{ prep_questions: string; review_questions: string; learning_goals: string }>(
        `SELECT prep_questions, review_questions, learning_goals
         FROM learning_settings WHERE class_id = $1 AND work_id = $2`,
        [classId, workId]
      );
      if (lsRes.rows.length > 0) {
        prepReviewSettings = {
          prepQuestions: lsRes.rows[0].prep_questions,
          reviewQuestions: lsRes.rows[0].review_questions,
          learningGoals: lsRes.rows[0].learning_goals,
        };
      }
    }

    // 5. Execute RAG query via Gemini Service
    try {
      const ragResult = await GeminiService.executeRagQuery({
        workTitle: work.title,
        learningMode,
        studentQuestion: question,
        fileSearchStoreNames: storeNames,
        prepReviewSettings,
        authorizedDocumentTitles: docTitles,
        mockDocumentSnippets: mockSnippets,
        chatHistory: parse.data.history,
      });

      if (ragResult.isNoSource) {
        // Record as no_source -> quota refunded/not deducted
        await QuotaService.recordNoSource(req.user.id, idempotencyKey, ragResult.text);
        res.status(200).json({
          answer: ragResult.text,
          citations: ragResult.citations,
          isNoSource: true,
          toolConfigured: ragResult.toolConfigured,
          toolActuallyUsed: ragResult.toolActuallyUsed,
          modelUsed: ragResult.modelUsed || GeminiService.getAiConfigSummary().activeModel,
          isLiveAi: ragResult.isLiveAi ?? GeminiService.isLiveApiConfigured(),
        });
        return;
      }

      // Record as success -> quota deducted once per user question
      await QuotaService.recordSuccess(
        req.user.id,
        idempotencyKey,
        ragResult.text,
        ragResult.citations,
        ragResult.tokenCount
      );

      res.status(200).json({
        answer: ragResult.text,
        citations: ragResult.citations,
        isNoSource: false,
        toolConfigured: ragResult.toolConfigured,
        toolActuallyUsed: ragResult.toolActuallyUsed,
        modelUsed: ragResult.modelUsed || GeminiService.getAiConfigSummary().activeModel,
        isLiveAi: ragResult.isLiveAi ?? GeminiService.isLiveApiConfigured(),
      });
    } catch (err: any) {
      console.error('[StudentController] RAG query failed:', err);
      // Refund quota upon technical failure
      await QuotaService.recordFailure(req.user.id, idempotencyKey, err.message || 'Lỗi xử lý câu hỏi');
      res.status(500).json({ error: 'Đã xảy ra lỗi khi kết nối với AI. Lượt hỏi của em đã được bảo lưu nguyên vẹn, vui lòng thử lại sau.' });
    }
  }

  /**
   * Retrieves chat history for current user
   */
  static async getHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    const { rows } = await query(
      `SELECT cr.id, cr.work_id, w.title as work_title, cr.learning_mode, cr.status,
              cr.grounding_status, cr.citations_meta, cr.response_text, cr.created_at
       FROM chat_requests cr
       JOIN works w ON cr.work_id = w.id
       WHERE cr.user_id = $1
       ORDER BY cr.created_at DESC
       LIMIT 30`,
      [req.user.id]
    );

    res.status(200).json({ history: rows });
  }

  /**
   * Clears chat history for current user
   */
  static async clearHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }

    await query(`DELETE FROM chat_requests WHERE user_id = $1`, [req.user.id]);
    res.status(200).json({ message: 'Đã xóa toàn bộ lịch sử hỏi đáp của tài khoản này.' });
  }
}
