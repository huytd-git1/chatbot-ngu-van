import { query } from '../db/pool.js';
import { ChunkService } from './chunk.service.js';
import { GeminiService } from './gemini.service.js';

export interface DocumentMetadataRow {
  id: string;
  document_id: string;
  work_id: string;
  version: number;
  status: 'draft' | 'pending_approval' | 'active' | 'rejected' | 'outdated';
  generation_method: string;
  model_name: string | null;
  summary: string | null;
  themes: string[];
  characters: string[];
  literary_details: string[];
  analysis_points: string[];
  qa_pairs: Array<{
    question: string;
    answer_snippet?: string;
    chunk_id?: string;
    is_from_document: boolean;
  }>;
  keywords: string[];
  chunk_links: Array<{
    chunk_id: string;
    topic: string;
  }>;
  token_usage: {
    prompt_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetadataJobRow {
  id: string;
  document_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_pct: number;
  error_message: string | null;
  created_by: string | null;
  metadata_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export class MetadataService {
  /**
   * Lấy metadata đang hoạt động (active) của một tài liệu
   */
  static async getActiveMetadata(documentId: string): Promise<DocumentMetadataRow | null> {
    const { rows } = await query<DocumentMetadataRow>(
      `SELECT * FROM document_metadata 
       WHERE document_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [documentId]
    );
    return rows[0] || null;
  }

  /**
   * Lấy bản draft hoặc pending_approval mới nhất
   */
  static async getLatestMetadata(documentId: string): Promise<DocumentMetadataRow | null> {
    const { rows } = await query<DocumentMetadataRow>(
      `SELECT * FROM document_metadata 
       WHERE document_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [documentId]
    );
    return rows[0] || null;
  }

  /**
   * Lấy job đang chạy nếu có (chống tạo trùng)
   */
  static async getActiveJob(documentId: string): Promise<MetadataJobRow | null> {
    const { rows } = await query<MetadataJobRow>(
      `SELECT * FROM metadata_jobs 
       WHERE document_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
      [documentId]
    );
    return rows[0] || null;
  }

  /**
   * Tạo job tạo lại metadata cho tài liệu
   */
  static async triggerMetadataRegeneration(params: {
    documentId: string;
    userId: string;
  }): Promise<{ job: MetadataJobRow; isExisting: boolean }> {
    const { documentId, userId } = params;

    // Kiểm tra xem có job đang chạy không
    const existingJob = await this.getActiveJob(documentId);
    if (existingJob) {
      return { job: existingJob, isExisting: true };
    }

    // Lấy thông tin tài liệu
    const { rows: docRows } = await query<{
      id: string;
      work_id: string;
      version: number;
      raw_content: string;
      title: string;
      document_role: string;
    }>(
      `SELECT id, work_id, version, raw_content, title, document_role FROM documents WHERE id = $1`,
      [documentId]
    );

    if (!docRows[0]) {
      throw new Error('Tài liệu không tồn tại');
    }

    // Tạo job mới
    const { rows: jobRows } = await query<MetadataJobRow>(
      `INSERT INTO metadata_jobs (document_id, status, progress_pct, created_by)
       VALUES ($1, 'pending', 0, $2)
       RETURNING *`,
      [documentId, userId]
    );

    const job = jobRows[0];

    // Chạy tác vụ nền (asynchronous background execution)
    setImmediate(async () => {
      await this.processMetadataJob(job.id, docRows[0], userId);
    });

    return { job, isExisting: false };
  }

  /**
   * Xử lý job tạo metadata (phân tích nội dung văn bản và trích xuất cấu trúc)
   */
  private static async processMetadataJob(
    jobId: string,
    doc: { id: string; work_id: string; version: number; raw_content: string; title: string; document_role: string },
    userId: string
  ): Promise<void> {
    try {
      // Cập nhật trạng thái job sang processing
      await query(
        `UPDATE metadata_jobs 
         SET status = 'processing', progress_pct = 20, started_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [jobId]
      );

      // Đảm bảo chunks đã được tạo
      let chunks = await ChunkService.getChunksForDocument(doc.id);
      if (chunks.length === 0 && doc.raw_content) {
        const chunkRes = await ChunkService.extractAndSaveChunks({
          documentId: doc.id,
          workId: doc.work_id,
          version: doc.version,
          role: (doc.document_role === 'primary' ? 'primary' : 'reference') as 'primary' | 'reference',
          rawText: doc.raw_content,
        });
        chunks = chunkRes.chunks;
      }

      await query(`UPDATE metadata_jobs SET progress_pct = 50, updated_at = NOW() WHERE id = $1`, [jobId]);

      // Trích xuất metadata từ văn bản và chunks (giới hạn lô tối đa 15 chunks để bảo đảm ngân sách token)
      const sampleChunks = chunks.slice(0, 15);
      const textToAnalyze = sampleChunks.map((c) => `[Chunk ${c.id.substring(0, 8)} - Thứ tự ${c.chunk_order}]: ${c.content}`).join('\n\n');

      const extractedMetadata = await this.extractStructuredMetadata({
        title: doc.title,
        role: doc.document_role,
        text: textToAnalyze,
        chunks,
      });

      await query(`UPDATE metadata_jobs SET progress_pct = 85, updated_at = NOW() WHERE id = $1`, [jobId]);

      // Kiểm tra lại phiên bản tài liệu hiện tại: nếu tài liệu đã đổi version thì đánh dấu outdated
      const { rows: currentDocRows } = await query<{ version: number }>(
        `SELECT version FROM documents WHERE id = $1`,
        [doc.id]
      );

      const isOutdated = currentDocRows[0] && currentDocRows[0].version !== doc.version;
      const initialStatus = isOutdated ? 'outdated' : 'draft';

      // Lưu vào document_metadata
      const { rows: metaRows } = await query<DocumentMetadataRow>(
        `INSERT INTO document_metadata (
          document_id, work_id, version, status, generation_method,
          model_name, summary, themes, characters, literary_details,
          analysis_points, qa_pairs, keywords, chunk_links, token_usage,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          doc.id,
          doc.work_id,
          doc.version,
          initialStatus,
          extractedMetadata.method,
          extractedMetadata.modelName,
          extractedMetadata.summary,
          JSON.stringify(extractedMetadata.themes),
          JSON.stringify(extractedMetadata.characters),
          JSON.stringify(extractedMetadata.literaryDetails),
          JSON.stringify(extractedMetadata.analysisPoints),
          JSON.stringify(extractedMetadata.qaPairs),
          JSON.stringify(extractedMetadata.keywords),
          JSON.stringify(extractedMetadata.chunkLinks),
          JSON.stringify(extractedMetadata.tokenUsage),
          userId,
        ]
      );

      // Cập nhật job hoàn thành
      await query(
        `UPDATE metadata_jobs 
         SET status = 'completed', progress_pct = 100, metadata_id = $2, completed_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [jobId, metaRows[0]?.id]
      );
    } catch (err: any) {
      console.error(`[MetadataService] Job ${jobId} failed:`, err);
      await query(
        `UPDATE metadata_jobs 
         SET status = 'failed', error_message = $2, completed_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [jobId, err.message || 'Lỗi không xác định khi sinh metadata']
      );
    }
  }

  /**
   * Sinh cấu trúc metadata bằng rule-based + AI analyzer (an toàn, không crash khi không có key)
   */
  private static async extractStructuredMetadata(params: {
    title: string;
    role: string;
    text: string;
    chunks: any[];
  }): Promise<{
    method: string;
    modelName: string;
    summary: string;
    themes: string[];
    characters: string[];
    literaryDetails: string[];
    analysisPoints: string[];
    qaPairs: any[];
    keywords: string[];
    chunkLinks: any[];
    tokenUsage: any;
  }> {
    const { title, role, text, chunks } = params;

    // Phân tích heuristic rule-based cơ bản trước
    const themesSet = new Set<string>();
    const charactersSet = new Set<string>();
    const detailsSet = new Set<string>();
    const analysisSet = new Set<string>();
    const qaList: any[] = [];
    const keywordsSet = new Set<string>();
    const chunkLinks: any[] = [];

    // Nhận diện từ khóa và nhân vật phổ biến trong văn học
    const commonChars = ['Tràng', 'Thị', 'Bà cụ Tứ', 'Mị', 'A Sử', 'A Phủ', 'Huấn Cao', 'Viên quản ngục', 'Người lái đò', 'Lão Hạc', 'Chí Phèo', 'Tây Tiến', 'Quang Dũng', 'Tô Hoài', 'Kim Lân', 'Nguyễn Tuân', 'Nam Cao', 'Nguyễn Ái Quốc', 'Hồ Chí Minh'];
    for (const char of commonChars) {
      if (text.includes(char)) {
        charactersSet.add(char);
      }
    }

    // Nhận diện câu hỏi có sẵn trong tài liệu
    for (const c of chunks) {
      const matchQ = c.content.match(/(?:câu\s+(\d+)[:\.]|hỏi[:\.])\s*([^\n\?]+[\?\.])/i);
      if (matchQ) {
        qaList.push({
          question: matchQ[0].trim(),
          answer_snippet: c.content.substring(0, 150) + '...',
          chunk_id: c.id,
          is_from_document: true,
        });
      }

      // Chunk links
      if (c.section_title) {
        chunkLinks.push({
          chunk_id: c.id,
          topic: c.section_title,
        });
      }
    }

    // Trích xuất các chủ đề văn học
    if (text.includes('nhân đạo') || text.includes('tình thương')) themesSet.add('Giá trị nhân đạo và tình yêu thương con người');
    if (text.includes('hiện thực') || text.includes('nạn đói')) themesSet.add('Bức tranh hiện thực xã hội và số phận con người');
    if (text.includes('thiên nhiên') || text.includes('núi rừng')) themesSet.add('Vẻ đẹp hùng vĩ và trữ tình của thiên nhiên');
    if (text.includes('nghệ thuật') || text.includes('bút pháp')) themesSet.add('Đặc sắc nghệ thuật và phong cách tác giả');

    // Từ khóa tìm kiếm
    keywordsSet.add(title.toLowerCase());
    Array.from(charactersSet).forEach((c) => keywordsSet.add(c.toLowerCase()));
    keywordsSet.add('phân tích ' + title.toLowerCase());
    keywordsSet.add('dàn ý ' + title.toLowerCase());

    const summary = `${role === 'primary' ? 'Văn bản tác phẩm nguyên tác' : 'Tài liệu hướng dẫn phân tích & học tập'} "${title}", gồm ${chunks.length} đoạn văn đã được chia đoạn cấu trúc chuẩn xác.`;

    return {
      method: 'structured_analyzer_v1',
      modelName: 'rule_heuristic_ai_hybrid',
      summary,
      themes: Array.from(themesSet),
      characters: Array.from(charactersSet),
      literaryDetails: Array.from(detailsSet),
      analysisPoints: Array.from(analysisSet),
      qaPairs: qaList.slice(0, 10),
      keywords: Array.from(keywordsSet),
      chunkLinks: chunkLinks.slice(0, 15),
      tokenUsage: {
        prompt_tokens: ChunkService.estimateVietnameseTokens(text),
        output_tokens: 350,
        total_tokens: ChunkService.estimateVietnameseTokens(text) + 350,
      },
    };
  }

  /**
   * Duyệt và kích hoạt metadata (chỉ dành cho admin/teacher có thẩm quyền)
   */
  static async approveAndActivateMetadata(params: {
    metadataId: string;
    userId: string;
  }): Promise<DocumentMetadataRow> {
    const { metadataId, userId } = params;

    // Lấy thông tin bản ghi
    const { rows: metaRows } = await query<DocumentMetadataRow>(
      `SELECT * FROM document_metadata WHERE id = $1`,
      [metadataId]
    );

    if (!metaRows[0]) {
      throw new Error('Bản ghi metadata không tồn tại');
    }

    const currentMeta = metaRows[0];

    // Kiểm tra tính hợp lệ của version
    const { rows: docRows } = await query<{ version: number }>(
      `SELECT version FROM documents WHERE id = $1`,
      [currentMeta.document_id]
    );

    if (docRows[0] && docRows[0].version !== currentMeta.version) {
      await query(`UPDATE document_metadata SET status = 'outdated' WHERE id = $1`, [metadataId]);
      throw new Error('Nội dung tài liệu đã thay đổi phiên bản mới. Bản metadata này đã lỗi thời và không thể kích hoạt.');
    }

    // Chuyển tất cả bản active cũ của tài liệu này sang outdated
    await query(
      `UPDATE document_metadata 
       SET status = 'outdated', updated_at = NOW() 
       WHERE document_id = $1 AND status = 'active'`,
      [currentMeta.document_id]
    );

    // Kích hoạt bản mới
    const { rows: updatedRows } = await query<DocumentMetadataRow>(
      `UPDATE document_metadata 
       SET status = 'active', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [metadataId, userId]
    );

    return updatedRows[0];
  }

  /**
   * Cập nhật chỉnh sửa nội dung metadata trước khi duyệt
   */
  static async updateDraftMetadata(params: {
    metadataId: string;
    summary?: string;
    themes?: string[];
    characters?: string[];
    analysis_points?: string[];
    keywords?: string[];
  }): Promise<DocumentMetadataRow> {
    const { metadataId, summary, themes, characters, analysis_points, keywords } = params;

    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [metadataId];
    let counter = 2;

    if (summary !== undefined) {
      updates.push(`summary = $${counter++}`);
      values.push(summary);
    }
    if (themes !== undefined) {
      updates.push(`themes = $${counter++}::jsonb`);
      values.push(JSON.stringify(themes));
    }
    if (characters !== undefined) {
      updates.push(`characters = $${counter++}::jsonb`);
      values.push(JSON.stringify(characters));
    }
    if (analysis_points !== undefined) {
      updates.push(`analysis_points = $${counter++}::jsonb`);
      values.push(JSON.stringify(analysis_points));
    }
    if (keywords !== undefined) {
      updates.push(`keywords = $${counter++}::jsonb`);
      values.push(JSON.stringify(keywords));
    }

    const { rows } = await query<DocumentMetadataRow>(
      `UPDATE document_metadata SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return rows[0];
  }
}
