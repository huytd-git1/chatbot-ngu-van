import crypto from 'crypto';
import { query } from '../db/pool.js';
import { GeminiService } from './gemini.service.js';
import { ParagraphService } from './paragraph.service.js';

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
  document_role: 'primary' | 'reference' | 'unclassified';
  reference_type: 'analysis' | 'context' | 'lesson_plan' | 'other' | 'qa_guide' | null;
  is_active: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  ocr_status: 'none' | 'pending' | 'completed' | 'review_needed';
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
    documentRole?: 'primary' | 'reference' | 'unclassified';
    referenceType?: 'analysis' | 'context' | 'lesson_plan' | 'other' | 'qa_guide';
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer };
    userId: string;
  }): Promise<{ documentId: string; status: string; documentRole: string }> {
    const { workId, title, docType, file, userId } = params;

    // 1. Verify work exists
    const workRes = await query(`SELECT title, grade FROM works WHERE id = $1`, [workId]);
    if (workRes.rows.length === 0) {
      throw new Error('Tác phẩm không tồn tại.');
    }

    // 2. Determine initial roles:
    // If explicitly uploaded as primary by teacher, we can stage it; if docType === 'text_primary' and no role given,
    // stage as unclassified so teacher confirms activation (or activate if explicitly requested).
    let documentRole = params.documentRole;
    let referenceType = params.referenceType;
    let isActive = false;

    if (!documentRole) {
      if (docType === 'text_primary') {
        documentRole = 'primary';
        isActive = false; // requires explicit activation or activate if no other primary exists
      } else {
        documentRole = 'reference';
        referenceType = (['analysis', 'lesson_plan', 'qa_guide'].includes(docType) ? docType : 'other') as any;
        isActive = true;
      }
    } else {
      isActive = documentRole === 'reference';
    }

    // 3. Extract preview/raw text if plain text / markdown / csv
    let rawContent: string | null = null;
    if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      rawContent = file.buffer.toString('utf-8');
    }

    // 4. Create or reuse Gemini File Search Store for this work
    const storeDisplayName = `work_${workId}_store`;
    const storeName = await GeminiService.createFileSearchStore(storeDisplayName);

    // 5. Save document record (if rawContent exists like TXT, it is immediately ready for RAG)
    const initialStatus = rawContent ? 'ready' : 'indexing';
    const ocrStatus = file.originalname.toLowerCase().endsWith('.pdf') ? 'review_needed' : 'none';

    // If document is set as active primary immediately, demote any existing active primary for this work
    if (documentRole === 'primary' && isActive) {
      await query(
        `UPDATE documents SET is_active = false WHERE work_id = $1 AND document_role = 'primary' AND is_active = true`,
        [workId]
      );
    }

    const docRes = await query<DocumentRow>(
      `INSERT INTO documents (
         work_id, title, doc_type, document_role, reference_type, is_active, ocr_status,
         file_name, file_search_store_name, file_size_bytes, mime_type, status, version, raw_content, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13, $14)
       RETURNING id, status, document_role`,
      [
        workId,
        title,
        docType,
        documentRole,
        referenceType || null,
        isActive,
        ocrStatus,
        file.originalname,
        storeName,
        file.size,
        file.mimetype,
        initialStatus,
        rawContent,
        userId,
      ]
    );
    const documentId = docRes.rows[0].id;

    // 6. If raw content is available, extract paragraphs into work_paragraphs
    if (rawContent) {
      await ParagraphService.extractAndSaveParagraphs({
        documentId,
        workId,
        version: 1,
        rawText: rawContent,
      });
    }

    // 7. Send file to Gemini File Search Store asynchronously
    try {
      const { operationName, geminiFileName } = await GeminiService.uploadToFileSearchStore(
        storeName,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      await query(
        `INSERT INTO indexing_jobs (document_id, operation_name, status)
         VALUES ($1, $2, 'running')`,
        [documentId, operationName]
      );

      await query(
        `UPDATE documents SET gemini_file_name = $1 WHERE id = $2`,
        [geminiFileName, documentId]
      );

      if (initialStatus !== 'ready') {
        this.pollJob(documentId, operationName).catch(() => {});
      }

      return { documentId, status: initialStatus, documentRole };
    } catch (err: any) {
      if (!rawContent) {
        await query(
          `UPDATE documents SET status = 'failed' WHERE id = $1`,
          [documentId]
        );
        throw err;
      }
      return { documentId, status: 'ready', documentRole };
    }
  }

  /**
   * Atomically activates a document as the sole primary text for a work
   */
  static async activatePrimaryDocument(params: {
    workId: string;
    documentId: string;
    userId: string;
  }): Promise<DocumentRow> {
    const { workId, documentId, userId } = params;

    const docRes = await query<DocumentRow>(
      `SELECT * FROM documents WHERE id = $1 AND work_id = $2`,
      [documentId, workId]
    );

    if (docRes.rows.length === 0) {
      throw new Error('Tài liệu không tồn tại hoặc không thuộc tác phẩm này.');
    }

    const doc = docRes.rows[0];

    // Transaction to ensure atomicity
    await query('BEGIN');
    try {
      // 1. Demote any current active primary for this work
      await query(
        `UPDATE documents
         SET is_active = false
         WHERE work_id = $1 AND document_role = 'primary' AND is_active = true`,
        [workId]
      );

      // 2. Promote target document
      const newVersion = (doc.version || 1) + 1;
      const updatedRes = await query<DocumentRow>(
        `UPDATE documents
         SET document_role = 'primary',
             is_active = true,
             reviewed_by = $1,
             reviewed_at = NOW(),
             version = $2,
             status = 'ready'
         WHERE id = $3
         RETURNING *`,
        [userId, newVersion, documentId]
      );

      // 3. Ensure paragraphs are extracted and saved for the new version
      if (doc.raw_content) {
        await ParagraphService.extractAndSaveParagraphs({
          documentId,
          workId,
          version: newVersion,
          rawText: doc.raw_content,
        });
      }

      await query('COMMIT');
      return updatedRes.rows[0];
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  /**
   * Updates document classification (role, reference_type, is_active)
   */
  static async updateDocumentClassification(params: {
    documentId: string;
    documentRole: 'primary' | 'reference' | 'unclassified';
    referenceType?: 'analysis' | 'context' | 'lesson_plan' | 'other' | 'qa_guide' | null;
    userId: string;
  }): Promise<DocumentRow> {
    const { documentId, documentRole, referenceType, userId } = params;

    const docRes = await query<DocumentRow>(`SELECT * FROM documents WHERE id = $1`, [documentId]);
    if (docRes.rows.length === 0) {
      throw new Error('Tài liệu không tồn tại.');
    }
    const doc = docRes.rows[0];

    if (documentRole === 'primary') {
      return this.activatePrimaryDocument({
        workId: doc.work_id,
        documentId,
        userId,
      });
    }

    const isActive = documentRole === 'reference';
    const updated = await query<DocumentRow>(
      `UPDATE documents
       SET document_role = $1,
           reference_type = $2,
           is_active = $3,
           reviewed_by = $4,
           reviewed_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [documentRole, referenceType || null, isActive, userId, documentId]
    );

    return updated.rows[0];
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
}
