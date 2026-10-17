import crypto from 'crypto';
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

    // Index normalized passages for deterministic verification
    if (rawContent) {
      try {
        await this.indexPassages(documentId, workId, docType, rawContent);
      } catch (err) {
        console.warn('[DocumentService] Failed to index initial passages:', err);
      }
    }

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

  /**
   * Normalizes text for exact deterministic matching:
   * Unicode NFC, whitespace normalization, trim.
   * Preserves Vietnamese diacritics.
   */
  static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFC')
      .replace(/[\r\t\f\v]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts distinct verifiable passages from raw document text
   */
  static extractPassages(
    rawContent: string,
    documentId: string,
    workId: string,
    docType: string
  ): Array<{
    documentId: string;
    workId: string;
    passageIndex: number;
    passageId: string;
    sourceType: string;
    content: string;
    normalizedContent: string;
    contentHash: string;
  }> {
    if (!rawContent || !rawContent.trim()) return [];

    const rawParagraphs = rawContent
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const passages: Array<any> = [];
    let idx = 0;

    for (const para of rawParagraphs) {
      if (para.length > 1500) {
        const sentences = para.split(/(?<=[.?!;:\n])\s+/);
        let chunk = '';
        for (const s of sentences) {
          if ((chunk + ' ' + s).length > 1000 && chunk.length > 0) {
            const normalized = this.normalizeText(chunk);
            const hash = crypto.createHash('sha256').update(normalized).digest('hex');
            passages.push({
              documentId,
              workId,
              passageIndex: idx,
              passageId: `${documentId}_p${idx}`,
              sourceType: docType,
              content: chunk,
              normalizedContent: normalized,
              contentHash: hash,
            });
            idx++;
            chunk = s;
          } else {
            chunk = chunk ? chunk + ' ' + s : s;
          }
        }
        if (chunk.trim()) {
          const normalized = this.normalizeText(chunk);
          const hash = crypto.createHash('sha256').update(normalized).digest('hex');
          passages.push({
            documentId,
            workId,
            passageIndex: idx,
            passageId: `${documentId}_p${idx}`,
            sourceType: docType,
            content: chunk,
            normalizedContent: normalized,
            contentHash: hash,
          });
          idx++;
        }
      } else {
        const normalized = this.normalizeText(para);
        const hash = crypto.createHash('sha256').update(normalized).digest('hex');
        passages.push({
          documentId,
          workId,
          passageIndex: idx,
          passageId: `${documentId}_p${idx}`,
          sourceType: docType,
          content: para,
          normalizedContent: normalized,
          contentHash: hash,
        });
        idx++;
      }
    }

    return passages;
  }

  /**
   * Indexes and persists passages into document_passages
   */
  static async indexPassages(
    documentId: string,
    workId: string,
    docType: string,
    rawContent: string
  ): Promise<number> {
    const passages = this.extractPassages(rawContent, documentId, workId, docType);
    if (passages.length === 0) return 0;

    try {
      await query(`DELETE FROM document_passages WHERE document_id = $1`, [documentId]);
      for (const p of passages) {
        await query(
          `INSERT INTO document_passages (document_id, work_id, passage_index, passage_id, source_type, content, normalized_content, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (document_id, passage_index) DO UPDATE
           SET content = EXCLUDED.content,
               normalized_content = EXCLUDED.normalized_content,
               content_hash = EXCLUDED.content_hash`,
          [p.documentId, p.workId, p.passageIndex, p.passageId, p.sourceType, p.content, p.normalizedContent, p.contentHash]
        );
      }
    } catch (err) {
      console.warn('[DocumentService] Failed to persist document passages:', err);
    }

    return passages.length;
  }

  /**
   * Retrieves all authorized passages for a work and student class
   */
  static async getAuthorizedPassages(workId: string, classId?: string | null): Promise<Array<{
    id: string;
    documentId: string;
    workId: string;
    documentTitle: string;
    passageId: string;
    sourceType: string;
    content: string;
    normalizedContent: string;
    contentHash: string;
  }>> {
    let sql = `
      SELECT dp.id, dp.document_id, dp.work_id, d.title as document_title,
             dp.passage_id, dp.source_type, dp.content, dp.normalized_content, dp.content_hash
      FROM document_passages dp
      JOIN documents d ON dp.document_id = d.id
      WHERE dp.work_id = $1 AND d.status = 'ready'
    `;
    const params: any[] = [workId];

    if (classId) {
      sql += ` AND EXISTS (SELECT 1 FROM class_work_access cwa WHERE cwa.work_id = dp.work_id AND cwa.class_id = $2)`;
      params.push(classId);
    }

    sql += ` ORDER BY dp.document_id, dp.passage_index ASC`;

    const { rows } = await query(sql, params);
    return rows;
  }
}
