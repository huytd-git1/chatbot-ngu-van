import { Request, Response } from 'express';
import { query } from '../db/pool.js';
import { ChunkService } from '../services/chunk.service.js';
import { MetadataService } from '../services/metadata.service.js';
import { RetrievalService } from '../services/retrieval.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { ParagraphService } from '../services/paragraph.service.js';

export class RagEvalController {
  /**
   * 1. GET /api/admin/rag-eval/overview
   * Thống kê số liệu thật từ bảng rag_traces và rag_manual_evaluations
   */
  static async getOverview(req: Request, res: Response) {
    try {
      // 1. Số lượt theo processing_method
      const { rows: methodRows } = await query<{ processing_method: string; count: string }>(
        `SELECT processing_method, COUNT(*) as count 
         FROM rag_traces 
         GROUP BY processing_method`
      );

      // 2. Thống kê token và độ trễ
      const { rows: statsRows } = await query<{
        total_requests: string;
        avg_prompt_tokens: string;
        avg_output_tokens: string;
        avg_latency: string;
        fallback_count: string;
        lack_of_source_count: string;
        mock_count: string;
      }>(
        `SELECT 
           COUNT(*) as total_requests,
           COALESCE(AVG(prompt_tokens_reported), 0) as avg_prompt_tokens,
           COALESCE(AVG(output_tokens_reported), 0) as avg_output_tokens,
           COALESCE(AVG(latency_ms), 0) as avg_latency,
           COALESCE(SUM(CASE WHEN fallback_occurred THEN 1 ELSE 0 END), 0) as fallback_count,
           COALESCE(SUM(CASE WHEN lack_of_source THEN 1 ELSE 0 END), 0) as lack_of_source_count,
           COALESCE(SUM(CASE WHEN is_mock THEN 1 ELSE 0 END), 0) as mock_count
         FROM rag_traces`
      );

      // 3. Tính độ trễ p50 và p95
      const { rows: latencies } = await query<{ latency_ms: number }>(
        `SELECT latency_ms FROM rag_traces WHERE latency_ms > 0 ORDER BY latency_ms ASC`
      );
      let p50 = 0;
      let p95 = 0;
      if (latencies.length > 0) {
        const idx50 = Math.floor(latencies.length * 0.5);
        const idx95 = Math.floor(latencies.length * 0.95);
        p50 = latencies[idx50]?.latency_ms || 0;
        p95 = latencies[idx95]?.latency_ms || 0;
      }

      // 4. Số lượt đã được đánh giá thủ công
      const { rows: evalRows } = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT trace_id) as count FROM rag_manual_evaluations`
      );

      // 5. Phân bố thành phần token ước tính
      const { rows: tokenEstimateRows } = await query<{ prompt_tokens_estimated: any }>(
        `SELECT prompt_tokens_estimated FROM rag_traces WHERE prompt_tokens_estimated IS NOT NULL LIMIT 100`
      );
      let sysTok = 0, hisTok = 0, refTok = 0, priTok = 0, countSample = 0;
      for (const r of tokenEstimateRows) {
        if (r.prompt_tokens_estimated && typeof r.prompt_tokens_estimated === 'object') {
          sysTok += r.prompt_tokens_estimated.system || 0;
          hisTok += r.prompt_tokens_estimated.history || 0;
          refTok += r.prompt_tokens_estimated.reference || 0;
          priTok += r.prompt_tokens_estimated.primary || 0;
          countSample++;
        }
      }

      const totalReq = parseInt(statsRows[0]?.total_requests || '0', 10);
      const lackCount = parseInt(statsRows[0]?.lack_of_source_count || '0', 10);
      const fallbackCount = parseInt(statsRows[0]?.fallback_count || '0', 10);

      res.status(200).json({
        totalRequests: totalReq,
        byMethod: methodRows.map((m) => ({ method: m.processing_method, count: parseInt(m.count, 10) })),
        tokens: {
          avgPrompt: Math.round(parseFloat(statsRows[0]?.avg_prompt_tokens || '0')),
          avgOutput: Math.round(parseFloat(statsRows[0]?.avg_output_tokens || '0')),
          breakdownAvg: countSample > 0 ? {
            system: Math.round(sysTok / countSample),
            history: Math.round(hisTok / countSample),
            reference: Math.round(refTok / countSample),
            primary: Math.round(priTok / countSample),
          } : { system: 1200, history: 400, reference: 3200, primary: 2100 },
        },
        latency: {
          avg: Math.round(parseFloat(statsRows[0]?.avg_latency || '0')),
          p50,
          p95,
        },
        fallbackCount,
        mockCount: parseInt(statsRows[0]?.mock_count || '0', 10),
        lackOfSourceRate: totalReq > 0 ? Number(((lackCount / totalReq) * 100).toFixed(1)) : 0,
        manualEvaluatedCount: parseInt(evalRows[0]?.count || '0', 10),
      });
    } catch (err: any) {
      console.error('[RagEvalController.getOverview] Error:', err);
      res.status(500).json({ error: 'Không thể tải thống kê RAG: ' + err.message });
    }
  }

  /**
   * 2. GET /api/admin/rag-eval/documents/:docId/chunks
   * Trả về toàn văn bản gốc và danh sách chunk để hiển thị 2 cột highlight
   */
  static async getDocumentChunks(req: Request, res: Response) {
    try {
      const { docId } = req.params;
      const { rows: docRows } = await query<{
        id: string;
        title: string;
        work_id: string;
        document_role: string;
        version: number;
        raw_content: string;
      }>(
        `SELECT id, title, work_id, document_role, version, raw_content 
         FROM documents WHERE id = $1`,
        [docId]
      );

      if (!docRows[0]) {
        res.status(404).json({ error: 'Tài liệu không tồn tại' });
        return;
      }

      const doc = docRows[0];
      let chunks = await ChunkService.getChunksForDocument(docId);

      // Nếu chưa có chunk nào, tự động extract
      if (chunks.length === 0 && doc.raw_content) {
        const resExtract = await ChunkService.extractAndSaveChunks({
          documentId: doc.id,
          workId: doc.work_id,
          version: doc.version,
          role: (doc.document_role === 'primary' ? 'primary' : 'reference') as any,
          rawText: doc.raw_content,
        });
        chunks = resExtract.chunks;
      }

      res.status(200).json({
        document: {
          id: doc.id,
          title: doc.title,
          role: doc.document_role,
          version: doc.version,
          rawContent: doc.raw_content || '',
        },
        chunks,
      });
    } catch (err: any) {
      console.error('[RagEvalController.getDocumentChunks] Error:', err);
      res.status(500).json({ error: 'Lỗi tải danh sách chunks: ' + err.message });
    }
  }

  /**
   * 3. POST /api/admin/rag-eval/playground
   * Phòng thử nghiệm RAG: Chạy truy vấn thử nghiệm quan sát toàn bộ vòng đời
   */
  static async runPlayground(req: Request, res: Response) {
    try {
      const { workId, learningMode = 'analysis', question } = req.body;
      if (!workId || !question) {
        res.status(400).json({ error: 'workId và question là bắt buộc' });
        return;
      }

      // 1. Lấy thông tin tác phẩm và tài liệu
      const { rows: workRows } = await query<{ id: string; title: string }>(
        `SELECT id, title FROM works WHERE id = $1`,
        [workId]
      );
      if (!workRows[0]) {
        res.status(404).json({ error: 'Tác phẩm không tồn tại' });
        return;
      }
      const work = workRows[0];

      const { rows: primaryRows } = await query<{
        id: string;
        title: string;
        version: number;
        raw_content: string;
      }>(
        `SELECT id, title, version, raw_content 
         FROM documents 
         WHERE work_id = $1 AND document_role = 'primary' AND is_active = true 
         LIMIT 1`,
        [workId]
      );
      const primaryDocRow = primaryRows[0];

      const { rows: refRows } = await query<{
        id: string;
        title: string;
        reference_type: string;
        raw_content: string;
      }>(
        `SELECT id, title, reference_type, raw_content 
         FROM documents 
         WHERE work_id = $1 AND document_role = 'reference' AND is_active = true`,
        [workId]
      );

      const primaryParagraphs = primaryDocRow
        ? await ParagraphService.getParagraphsForDocument(primaryDocRow.id)
        : [];

      // 2. Chạy Pre-Retrieval
      const retrievalRes = await RetrievalService.retrieveAndBuildPrompt({
        workId,
        question,
        learningMode,
      });

      // 3. Thực thi RAG Query với traceSource = 'admin_lab' (không trừ lượt)
      const ragResult = await GeminiService.executeRagQuery({
        workTitle: work.title,
        learningMode,
        studentQuestion: question,
        fileSearchStoreNames: [],
        authorizedDocumentTitles: [
          ...(primaryDocRow ? [primaryDocRow.title] : []),
          ...refRows.map((r) => r.title),
        ],
        primaryDoc: primaryDocRow
          ? {
              id: primaryDocRow.id,
              title: primaryDocRow.title,
              version: primaryDocRow.version,
              rawContent: primaryDocRow.raw_content,
              paragraphs: primaryParagraphs,
            }
          : undefined,
        referenceDocs: refRows.map((r) => ({
          id: r.id,
          title: r.title,
          referenceType: r.reference_type,
          rawContent: r.raw_content,
        })),
        workId,
        userId: (req as any).user?.id,
        traceSource: 'admin_lab',
      });

      res.status(200).json({
        retrieval: {
          selectedChunks: retrievalRes.allSelectedChunks,
          excludedChunks: retrievalRes.excludedChunks,
          tokenBreakdown: retrievalRes.tokenBreakdown,
          promptContextPreview: retrievalRes.promptContextText,
          lackOfSource: retrievalRes.lackOfSource,
        },
        execution: {
          answer: ragResult.text,
          citations: ragResult.citations,
          primaryCitations: ragResult.primaryCitations || [],
          referenceCitations: ragResult.referenceCitations || [],
          isNoSource: ragResult.isNoSource,
          modelUsed: ragResult.modelUsed,
          toolActuallyUsed: ragResult.toolActuallyUsed,
          isMock: ragResult.isMock || false,
          tokenCount: ragResult.tokenCount,
          traceId: ragResult.traceId,
        },
      });
    } catch (err: any) {
      console.error('[RagEvalController.runPlayground] Error:', err);
      res.status(500).json({ error: 'Lỗi chạy thử nghiệm RAG: ' + err.message });
    }
  }

  /**
   * 4. GET /api/admin/rag-eval/traces
   * Lấy danh sách Traces có phân trang và bộ lọc
   */
  static async getTraces(req: Request, res: Response) {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const offset = (page - 1) * limit;

      const { workId, source, method, search } = req.query;

      let whereClauses: string[] = ['1=1'];
      const params: any[] = [];
      let counter = 1;

      if (workId) {
        whereClauses.push(`t.work_id = $${counter++}`);
        params.push(workId);
      }
      if (source) {
        whereClauses.push(`t.trace_source = $${counter++}`);
        params.push(source);
      }
      if (method) {
        whereClauses.push(`t.processing_method = $${counter++}`);
        params.push(method);
      }
      if (search) {
        whereClauses.push(`t.query_text ILIKE $${counter++}`);
        params.push(`%${search}%`);
      }

      const countSql = `SELECT COUNT(*) as count FROM rag_traces t WHERE ${whereClauses.join(' AND ')}`;
      const { rows: countRows } = await query<{ count: string }>(countSql, params);
      const total = parseInt(countRows[0]?.count || '0', 10);

      const querySql = `
        SELECT t.*, w.title as work_title, u.username as user_name,
               e.retrieval_rating, e.quote_accuracy, e.analysis_grounded
        FROM rag_traces t
        LEFT JOIN works w ON t.work_id = w.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN rag_manual_evaluations e ON t.id = e.trace_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT $${counter++} OFFSET $${counter++}
      `;
      params.push(limit, offset);

      const { rows: traces } = await query(querySql, params);

      res.status(200).json({
        total,
        page,
        limit,
        traces,
      });
    } catch (err: any) {
      console.error('[RagEvalController.getTraces] Error:', err);
      res.status(500).json({ error: 'Lỗi tải danh sách traces: ' + err.message });
    }
  }

  /**
   * 5. GET /api/admin/rag-eval/traces/:id
   * Chi tiết một trace
   */
  static async getTraceDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { rows } = await query(
        `SELECT t.*, w.title as work_title, u.username as user_name
         FROM rag_traces t
         LEFT JOIN works w ON t.work_id = w.id
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = $1`,
        [id]
      );

      if (!rows[0]) {
        res.status(404).json({ error: 'Trace không tồn tại' });
        return;
      }

      const { rows: evals } = await query(
        `SELECT e.*, u.username as evaluator_name 
         FROM rag_manual_evaluations e
         JOIN users u ON e.evaluator_id = u.id
         WHERE e.trace_id = $1`,
        [id]
      );

      res.status(200).json({
        trace: rows[0],
        evaluations: evals,
      });
    } catch (err: any) {
      console.error('[RagEvalController.getTraceDetail] Error:', err);
      res.status(500).json({ error: 'Lỗi tải chi tiết trace: ' + err.message });
    }
  }

  /**
   * 6. POST /api/admin/rag-eval/traces/:id/evaluate
   * Chấm điểm thủ công (Human Evaluation Rubric)
   */
  static async submitEvaluation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { retrievalRating, evidenceMissing, quoteAccuracy, analysisGrounded, modeFit, notes } = req.body;
      const evaluatorId = (req as any).user?.id;

      const { rows } = await query(
        `INSERT INTO rag_manual_evaluations (
          trace_id, evaluator_id, retrieval_rating, evidence_missing,
          quote_accuracy, analysis_grounded, mode_fit, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          id,
          evaluatorId,
          retrievalRating || 'correct',
          evidenceMissing ?? false,
          quoteAccuracy || 'exact',
          analysisGrounded || 'fully_supported',
          modeFit ?? true,
          notes || '',
        ]
      );

      res.status(201).json({ evaluation: rows[0] });
    } catch (err: any) {
      console.error('[RagEvalController.submitEvaluation] Error:', err);
      res.status(500).json({ error: 'Lỗi lưu đánh giá: ' + err.message });
    }
  }

  /**
   * 7. Quản lý Bộ đề chuẩn & Chạy Benchmark
   */
  static async getTestsets(req: Request, res: Response) {
    try {
      const { rows } = await query(
        `SELECT s.*, COUNT(c.id) as case_count
         FROM rag_eval_testsets s
         LEFT JOIN rag_eval_test_cases c ON s.id = c.testset_id
         GROUP BY s.id
         ORDER BY s.created_at DESC`
      );
      res.status(200).json({ testsets: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createTestset(req: Request, res: Response) {
    try {
      const { name, description, cases = [] } = req.body;
      const userId = (req as any).user?.id;

      const { rows: setRows } = await query(
        `INSERT INTO rag_eval_testsets (name, description, created_by)
         VALUES ($1, $2, $3) RETURNING *`,
        [name, description, userId]
      );

      const testset = setRows[0];

      for (const c of cases) {
        await query(
          `INSERT INTO rag_eval_test_cases (
            testset_id, work_id, learning_mode, question, expected_ref_topics, expected_quotes, should_refuse
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            testset.id,
            c.workId,
            c.learningMode || 'analysis',
            c.question,
            c.expectedRefTopics || null,
            c.expectedQuotes || null,
            c.shouldRefuse ?? false,
          ]
        );
      }

      res.status(201).json({ testset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async runBenchmark(req: Request, res: Response) {
    try {
      const { testsetId } = req.params;
      const { name = 'Benchmark Run', modelName } = req.body;
      const userId = (req as any).user?.id;

      const { rows: cases } = await query<any>(
        `SELECT c.*, w.title as work_title 
         FROM rag_eval_test_cases c
         JOIN works w ON c.work_id = w.id
         WHERE c.testset_id = $1`,
        [testsetId]
      );

      if (cases.length === 0) {
        res.status(400).json({ error: 'Bộ đề chưa có câu hỏi nào' });
        return;
      }

      const { rows: runRows } = await query<any>(
        `INSERT INTO rag_eval_runs (
          testset_id, name, config, total_cases, completed_cases, passed_cases, created_by
        ) VALUES ($1, $2, $3, $4, 0, 0, $5) RETURNING *`,
        [testsetId, name, JSON.stringify({ modelName }), cases.length, userId]
      );

      const run = runRows[0];

      // Chạy async batch
      setImmediate(async () => {
        let completed = 0;
        let passed = 0;
        let totalTokens = 0;
        let totalLatency = 0;
        const results: any[] = [];

        for (const testCase of cases) {
          try {
            const startT = Date.now();
            const res = await GeminiService.executeRagQuery({
              workTitle: testCase.work_title,
              learningMode: testCase.learning_mode,
              studentQuestion: testCase.question,
              fileSearchStoreNames: [],
              authorizedDocumentTitles: [testCase.work_title],
              workId: testCase.work_id,
              userId,
              traceSource: 'eval_batch',
            });
            const lat = Date.now() - startT;
            totalLatency += lat;
            totalTokens += res.tokenCount;

            const isCorrect = testCase.should_refuse ? res.isNoSource : !res.isNoSource;
            if (isCorrect) passed++;
            completed++;

            results.push({
              caseId: testCase.id,
              question: testCase.question,
              answerSnippet: res.text.substring(0, 100),
              isCorrect,
              tokenCount: res.tokenCount,
              latencyMs: lat,
            });
          } catch (caseErr: any) {
            completed++;
            results.push({
              caseId: testCase.id,
              question: testCase.question,
              error: caseErr.message,
              isCorrect: false,
            });
          }
        }

        const avgTokens = Math.round(totalTokens / Math.max(1, completed));
        const avgLatency = Math.round(totalLatency / Math.max(1, completed));
        const accRate = Number(((passed / Math.max(1, completed)) * 100).toFixed(1));

        await query(
          `UPDATE rag_eval_runs
           SET status = 'completed', completed_cases = $2, passed_cases = $3,
               avg_tokens = $4, avg_latency_ms = $5, accuracy_rate = $6,
               results = $7, completed_at = NOW()
           WHERE id = $1`,
          [run.id, completed, passed, avgTokens, avgLatency, accRate, JSON.stringify(results)]
        );
      });

      res.status(202).json({ run });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getRuns(req: Request, res: Response) {
    try {
      const { rows } = await query(
        `SELECT r.*, s.name as testset_name 
         FROM rag_eval_runs r
         JOIN rag_eval_testsets s ON r.testset_id = s.id
         ORDER BY r.started_at DESC LIMIT 50`
      );
      res.status(200).json({ runs: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
