import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { DocumentService } from './document.service.js';

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  work_id: string;
  chunk_order: number;
  chunk_role: 'primary' | 'reference';
  section_title: string | null;
  page_number: number | null;
  start_offset: number;
  end_offset: number;
  content: string;
  normalized_content: string;
  content_hash: string;
  token_count: number;
  token_method: string;
  metadata: Record<string, any>;
  version: number;
  created_at: string;
}

export interface ChunkingOptions {
  documentId: string;
  workId: string;
  version: number;
  role: 'primary' | 'reference';
  rawText: string;
  docType?: string;
  maxChunkChars?: number;
}

export class ChunkService {
  /**
   * Ước lượng số token cho văn bản tiếng Việt
   * Trung bình: 1 từ tiếng Việt ~ 1.35 token trên các model hiện đại (Gemini / BPE)
   */
  static estimateVietnameseTokens(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words * 1.35));
  }

  /**
   * Tính mã băm SHA256 cho nội dung
   */
  static hashContent(content: string): string {
    return crypto.createHash('sha256').update(content.trim(), 'utf8').digest('hex');
  }

  /**
   * Phân đoạn văn bản tài liệu theo cấu trúc ngữ nghĩa (thơ, đoạn văn, câu hỏi-đáp án, luận điểm)
   * Giữ chính xác vị trí start_offset và end_offset trên văn bản gốc
   */
  static async extractAndSaveChunks(options: ChunkingOptions): Promise<{ count: number; chunks: DocumentChunkRow[] }> {
    const { documentId, workId, version, role, rawText, maxChunkChars = 1500 } = options;

    // Xóa các chunk cũ của tài liệu này
    await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

    if (!rawText || rawText.trim().length === 0) {
      return { count: 0, chunks: [] };
    }

    const chunksToInsert: Array<{
      order: number;
      role: 'primary' | 'reference';
      sectionTitle: string | null;
      pageNumber: number | null;
      startOffset: number;
      endOffset: number;
      content: string;
      normalizedContent: string;
      contentHash: string;
      tokenCount: number;
      tokenMethod: string;
      metadata: Record<string, any>;
    }> = [];

    let orderCounter = 1;
    let currentPage: number | null = null;
    let currentSectionTitle: string | null = null;

    const lines = rawText.split('\n');
    let bufferLines: string[] = [];
    let bufferStartOffset = 0;
    let inPoemBlock = false;

    const flushBuffer = () => {
      if (bufferLines.length === 0) return;
      const content = bufferLines.join('\n').trim();
      if (content.length > 0) {
        const normalizedContent = DocumentService.normalizeText(content);
        const tokenCount = ChunkService.estimateVietnameseTokens(content);
        const contentHash = ChunkService.hashContent(normalizedContent);
        const endOffset = bufferStartOffset + bufferLines.join('\n').length;

        chunksToInsert.push({
          order: orderCounter++,
          role,
          sectionTitle: currentSectionTitle,
          pageNumber: currentPage,
          startOffset: bufferStartOffset,
          endOffset,
          content,
          normalizedContent,
          contentHash,
          tokenCount,
          tokenMethod: 'estimated_vi_word_1.35',
          metadata: {
            lineCount: bufferLines.length,
            isPoem: inPoemBlock,
            hasQuestion: /^(?:câu\s+\d+|hỏi:|bài\s+tập)/i.test(content),
          },
        });
      }
      bufferLines = [];
    };

    let lineOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineWithEnd = lines[i];
      const trimmedLine = lineWithEnd.trim();
      const currentLineStart = lineOffset;
      lineOffset += lineWithEnd.length + 1; // +1 cho ký tự newline \n

      // Phát hiện đánh dấu trang: [Trang 1], Page 2, --- Trang 3 ---
      const pageMatch = trimmedLine.match(/^\[?(?:Trang|Page)\s+(\d+)\]?:?/i) || trimmedLine.match(/^---\s*(?:Trang|Page)\s+(\d+)\s*---/i);
      if (pageMatch) {
        flushBuffer();
        currentPage = parseInt(pageMatch[1], 10);
        bufferStartOffset = lineOffset;
        continue;
      }

      // Phát hiện tiêu đề mục lớn trong tài liệu tham khảo: #, ##, I., II., Phần 1
      const headingMatch = trimmedLine.match(/^(?:#{1,4}\s+|[I|V|X]+\.\s+|Phần\s+\d+[:\.]\s*)(.+)/i);
      if (headingMatch && role === 'reference') {
        flushBuffer();
        currentSectionTitle = headingMatch[1].trim();
        bufferStartOffset = currentLineStart;
      }

      // Phát hiện câu hỏi - đáp án trong tài liệu tham khảo
      const isQuestionStart = /^(?:Câu\s+\d+[:\.]|Hỏi\s*[:\.]|\d+\.\s+Hỏi)/i.test(trimmedLine);
      if (isQuestionStart && role === 'reference' && bufferLines.length > 0) {
        flushBuffer();
        bufferStartOffset = currentLineStart;
      }

      if (trimmedLine.length === 0) {
        // Dòng trống: nếu là văn xuôi thì kết thúc đoạn, nếu là thơ thì kết thúc khổ
        if (bufferLines.length > 0) {
          const currentBufferLength = bufferLines.join('\n').length;
          if (currentBufferLength > 150 || !inPoemBlock) {
            flushBuffer();
            bufferStartOffset = lineOffset;
          }
        }
      } else {
        if (bufferLines.length === 0) {
          bufferStartOffset = currentLineStart;
        }

        bufferLines.push(lineWithEnd);

        // Kiểm tra xem đoạn hiện tại có quá dài không
        const currentBufferChars = bufferLines.join('\n').length;
        if (currentBufferChars >= maxChunkChars) {
          flushBuffer();
          bufferStartOffset = lineOffset;
        }
      }
    }
    flushBuffer();

    // Lưu vào database
    const savedChunks: DocumentChunkRow[] = [];
    for (const item of chunksToInsert) {
      const { rows } = await query<DocumentChunkRow>(
        `INSERT INTO document_chunks (
          document_id, work_id, chunk_order, chunk_role, section_title,
          page_number, start_offset, end_offset, content, normalized_content,
          content_hash, token_count, token_method, metadata, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          documentId,
          workId,
          item.order,
          item.role,
          item.sectionTitle,
          item.pageNumber,
          item.startOffset,
          item.endOffset,
          item.content,
          item.normalizedContent,
          item.contentHash,
          item.tokenCount,
          item.tokenMethod,
          JSON.stringify(item.metadata),
          version,
        ]
      );
      if (rows[0]) {
        savedChunks.push(rows[0]);
      }
    }

    return { count: savedChunks.length, chunks: savedChunks };
  }

  /**
   * Lấy danh sách chunks của một tài liệu
   */
  static async getChunksForDocument(documentId: string): Promise<DocumentChunkRow[]> {
    const { rows } = await query<DocumentChunkRow>(
      `SELECT * FROM document_chunks WHERE document_id = $1 ORDER BY chunk_order ASC`,
      [documentId]
    );
    return rows;
  }

  /**
   * Lấy danh sách chunks cho tác phẩm, lọc theo vai trò
   */
  static async getChunksForWork(workId: string, role?: 'primary' | 'reference'): Promise<DocumentChunkRow[]> {
    let sql = `
      SELECT c.*, d.title as document_title, d.file_name, d.version as document_version
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.work_id = $1 AND d.is_active = true
    `;
    const params: any[] = [workId];

    if (role) {
      sql += ` AND c.chunk_role = $2`;
      params.push(role);
    }

    sql += ` ORDER BY c.chunk_role ASC, c.document_id, c.chunk_order ASC`;

    const { rows } = await query<DocumentChunkRow>(sql, params);
    return rows;
  }

  /**
   * Tìm kiếm keyword trong các chunks
   */
  static async searchChunks(params: {
    workId: string;
    role?: 'primary' | 'reference';
    queryText: string;
    limit?: number;
  }): Promise<DocumentChunkRow[]> {
    const { workId, role, queryText, limit = 10 } = params;
    const normalized = DocumentService.normalizeText(queryText);
    const keywords = normalized.split(/\s+/).filter((w) => w.length >= 2);

    if (keywords.length === 0) {
      return this.getChunksForWork(workId, role);
    }

    const likeClauses = keywords.map((_, idx) => `c.normalized_content ILIKE $${idx + 3}`);
    const likeParams = keywords.map((k) => `%${k}%`);

    let sql = `
      SELECT c.*, d.title as document_title
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.work_id = $1 AND d.is_active = true
    `;
    const queryParams: any[] = [workId, limit, ...likeParams];

    if (role) {
      sql += ` AND c.chunk_role = '${role}'`;
    }

    if (likeClauses.length > 0) {
      sql += ` AND (${likeClauses.join(' OR ')})`;
    }

    sql += ` ORDER BY c.chunk_order ASC LIMIT $2`;

    const { rows } = await query<DocumentChunkRow>(sql, queryParams);
    return rows;
  }
}
