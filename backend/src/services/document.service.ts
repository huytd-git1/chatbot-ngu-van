import { query } from '../db/pool.js';
import { GeminiService } from './gemini.service.js';

export interface WorkRow {
  id: string;
  title: string;
  author: string;
  grade: number;
  description: string;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  work_id: string;
  title: string;
  doc_type: 'text_primary' | 'analysis' | 'lesson_plan' | 'qa_guide';
  file_name: string;
  file_search_store_name: string;
  gemini_file_name: string | null;
  file_size_bytes: number;
  mime_type: string;
  status: 'pending' | 'indexing' | 'ready' | 'failed' | 'archived';
  version: number;
  raw_content: string | null;
  created_by: string;
  created_at: string;
}

export class DocumentService {
  /**
   * Allowed MIME types and extensions for RAG documents
   */
  static readonly ALLOWED_MIME_TYPES = [
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
  ];

  static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  /**
   * Validates uploaded file
   */
  static validateFile(file: { mimetype: string; size: number; originalname: string }): { valid: boolean; error?: string } {
    if (file.size > this.MAX_FILE_SIZE) {
      return { valid: false, error: 'Dung lượng file vượt quá giới hạn 50MB.' };
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['txt', 'md', 'pdf', 'docx', 'csv'].includes(ext ?? '');
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype) && !isAllowedExt) {
      return { valid: false, error: 'Định dạng file không được hỗ trợ. Chỉ chấp nhận TXT, MD, PDF, DOCX, CSV.' };
    }
    return { valid: true };
  }

  /**
   * Uploads and initiates indexing for a document
   */
  static async uploadDocument(params: {
    workId: string;
    title: string;
    docType: 'text_primary' | 'analysis' | 'lesson_plan' | 'qa_guide';
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer };
    userId: string;
  }): Promise<{ documentId: string; status: string }> {
    const { workId, title, docType, file, userId } = params;

    // 1. Verify work exists
    const workRes = await query(`SELECT title, grade FROM works WHERE id = $1`, [workId]);
    if (workRes.rows.length === 0) {
      throw new Error('Tác phẩm không tồn tại.');
    }
    const work = workRes.rows[0];

    // 2. Extract preview/raw text if plain text / markdown / csv
    let rawContent: string | null = null;
    if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      rawContent = file.buffer.toString('utf-8');
    }

    // 3. Create or reuse Gemini File Search Store for this work
    // Name convention: work_<workId>
    const storeDisplayName = `work_${workId}_store`;
    const storeName = await GeminiService.createFileSearchStore(storeDisplayName);

    // 4. Save document record (if rawContent exists like TXT, it is immediately ready for RAG)
    const initialStatus = rawContent ? 'ready' : 'indexing';
    const docRes = await query<DocumentRow>(
      `INSERT INTO documents (work_id, title, doc_type, file_name, file_search_store_name, file_size_bytes, mime_type, status, raw_content, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, status`,
      [workId, title, docType, file.originalname, storeName, file.size, file.mimetype, initialStatus, rawContent, userId]
    );
    const documentId = docRes.rows[0].id;

    // 5. Send file to Gemini File Search Store asynchronously
    try {
      const { operationName, geminiFileName } = await GeminiService.uploadToFileSearchStore(
        storeName,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      // Save indexing job
      await query(
        `INSERT INTO indexing_jobs (document_id, operation_name, status)
         VALUES ($1, $2, 'running')`,
        [documentId, operationName]
      );

      await query(
        `UPDATE documents SET gemini_file_name = $1 WHERE id = $2`,
        [geminiFileName, documentId]
      );

      // Asynchronously trigger check if not already ready
      if (initialStatus !== 'ready') {
        this.pollJob(documentId, operationName).catch(() => {});
      }

      return { documentId, status: initialStatus };
    } catch (err: any) {
      if (!rawContent) {
        await query(
          `UPDATE documents SET status = 'failed' WHERE id = $1`,
          [documentId]
        );
        throw err;
      }
      return { documentId, status: 'ready' };
    }
  }

  /**
   * Polls an indexing job until ready or failed
   */
  static async pollJob(documentId: string, operationName: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 4s = 120s max

    const check = async () => {
      attempts++;
      const res = await GeminiService.checkIndexingOperation(operationName);

      if (res.done) {
        if (res.error) {
          await query(
            `UPDATE indexing_jobs SET status = 'failed', error_message = $1, last_checked_at = NOW() WHERE document_id = $2`,
            [res.error, documentId]
          );
          await query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [documentId]);
        } else {
          await query(
            `UPDATE indexing_jobs SET status = 'completed', last_checked_at = NOW() WHERE document_id = $1`,
            [documentId]
          );
          await query(`UPDATE documents SET status = 'ready' WHERE id = $1`, [documentId]);
        }
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(check, 4000);
      } else {
        await query(
          `UPDATE indexing_jobs SET status = 'failed', error_message = 'Indexing timed out', last_checked_at = NOW() WHERE document_id = $1`,
          [documentId]
        );
        await query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [documentId]);
      }
    };

    setTimeout(check, 2000);
  }

  /**
   * Reconciles all pending/running indexing jobs on server startup
   */
  static async reconcilePendingJobs(): Promise<void> {
    console.log('[DocumentService] Reconciling unfinished indexing jobs...');
    const { rows } = await query<{ document_id: string; operation_name: string }>(
      `SELECT document_id, operation_name FROM indexing_jobs WHERE status = 'running'`
    );

    for (const job of rows) {
      console.log(`[DocumentService] Resuming job for document ${job.document_id}`);
      this.pollJob(job.document_id, job.operation_name).catch(() => {});
    }
  }

  /**
   * Safely deletes a document
   */
  static async deleteDocument(documentId: string): Promise<void> {
    await query(`DELETE FROM documents WHERE id = $1`, [documentId]);
  }
}
