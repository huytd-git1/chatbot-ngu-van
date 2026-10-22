import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { query } from '../db/pool.js';
import { ChunkService } from '../services/chunk.service.js';
import { RetrievalService } from '../services/retrieval.service.js';
import { MetadataService } from '../services/metadata.service.js';
import { GeminiService } from '../services/gemini.service.js';

describe('RAG Optimization v2 Suite', () => {
  let workId: string;
  let primaryDocId: string;
  let referenceDocId: string;
  let userId: string;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    // 1. Tạo tác phẩm test
    const { rows: workRows } = await query<{ id: string }>(
      `INSERT INTO works (title, author, grade, status)
       VALUES ('Vợ chồng A Phủ', 'Tô Hoài', 12, 'active')
       RETURNING id`
    );
    workId = workRows[0].id;

    // 2. Tạo tài liệu nguyên tác (Primary Doc)
    const primaryText = `Ai ở xa về, có việc vào nhà thống lý Pá Tra thường nghe nói: “Đẹp như con gái nhà thống lý Pá Tra cũng bằng thừa”.
Mị là con dâu gạt nợ nhà thống lý Pá Tra. Mị ngồi quay sợi gai bên tảng đá trước cửa, cạnh tàu ngựa.
Lúc nào cũng vậy, dù quay sợi, thái cỏ ngựa, dệt vải, chẻ củi hay đi cõng nước dưới khe suối lên, cô ấy cũng cúi mặt, mặt biếc và buồn rười rượi.
--- Trang 2 ---
Ngày Tết ở Hồng Ngài năm ấy đến giữa lúc gió thổi vào cỏ gianh vàng ửng.
Mị lén lấy hũ rượu, uống ực từng bát. Rồi say, Mị lịm mặt ngồi đấy nhìn mọi người nhảy đồng, người hát.
Lòng Mị đang sống về ngày trước. Mị thấy mình còn trẻ, Mị còn muốn đi chơi.`;

    const { rows: priRows } = await query<{ id: string }>(
      `INSERT INTO documents (
        work_id, title, doc_type, file_name, file_search_store_name,
        file_size_bytes, mime_type, status, document_role, is_active, raw_content
      ) VALUES ($1, 'Vợ chồng A Phủ - Nguyên tác', 'text_primary', 'vo_chong_a_phu.txt', 'store_pri',
        1000, 'text/plain', 'ready', 'primary', true, $2)
       RETURNING id`,
      [workId, primaryText]
    );
    primaryDocId = priRows[0].id;

    // 3. Tạo tài liệu tham khảo (Reference Doc)
    const refText = `# PHÂN TÍCH SỨC SỐNG TIỀM TÀNG CỦA MỊ
Câu 1: Phân tích tâm trạng của Mị trong đêm tình mùa xuân.
Đáp án: Sức sống tiềm tàng của Mị được đánh thức bởi tiếng sáo gọi bạn tình và men rượu ngày xuân. Men rượu đưa Mị thoát khỏi thực tại u ám, hồi sinh ý thức về tuổi trẻ và khát vọng tự do.

# GIÁ TRỊ NHÂN ĐẠO CỦA TÁC PHẨM
Tô Hoài đồng cảm sâu sắc với số phận người phụ nữ miền núi dưới ách thống trị của phong kiến và thực dân. Tác giả phát hiện và ca ngợi vẻ đẹp tâm hồn cùng sức sống quật khởi của người lao động.`;

    const { rows: refRows } = await query<{ id: string }>(
      `INSERT INTO documents (
        work_id, title, doc_type, file_name, file_search_store_name,
        file_size_bytes, mime_type, status, document_role, is_active, raw_content
      ) VALUES ($1, 'Giáo án chuyên sâu Vợ chồng A Phủ', 'analysis', 'giao_an.txt', 'store_ref',
        800, 'text/plain', 'ready', 'reference', true, $2)
       RETURNING id`,
      [workId, refText]
    );
    referenceDocId = refRows[0].id;

    // 4. Tạo test user với unique username
    const uniqueUname = 'teacher_rag_' + Math.random().toString(36).substring(2, 9);
    const { rows: userRows } = await query<{ id: string }>(
      `INSERT INTO users (username, role, full_name, password_hash)
       VALUES ($1, 'teacher', 'Giáo viên RAG', 'hash')
       RETURNING id`,
      [uniqueUname]
    );
    userId = userRows[0].id;
  });

  it('ChunkService extracts and stores chunks with accurate offsets, role, and Vietnamese token estimates', async () => {
    const { rows: doc } = await query<{ raw_content: string }>(
      `SELECT raw_content FROM documents WHERE id = $1`,
      [primaryDocId]
    );

    const result = await ChunkService.extractAndSaveChunks({
      documentId: primaryDocId,
      workId,
      version: 1,
      role: 'primary',
      rawText: doc[0].raw_content,
    });

    expect(result.count).toBeGreaterThan(0);
    const chunk = result.chunks[0];
    expect(chunk.chunk_role).toBe('primary');
    expect(chunk.start_offset).toBe(0);
    expect(chunk.end_offset).toBeGreaterThan(0);
    expect(chunk.token_count).toBeGreaterThan(0);
    expect(chunk.content_hash).toBeDefined();
    expect(chunk.token_method).toContain('estimated_vi');
  });

  it('RetrievalService retrieves reference chunks for analysis and primary chunks for quote evidence under token budget', async () => {
    // Trích xuất chunks trước cho cả 2 tài liệu
    const { rows: priDoc } = await query<{ raw_content: string }>(`SELECT raw_content FROM documents WHERE id = $1`, [primaryDocId]);
    const { rows: refDoc } = await query<{ raw_content: string }>(`SELECT raw_content FROM documents WHERE id = $1`, [referenceDocId]);

    await ChunkService.extractAndSaveChunks({
      documentId: primaryDocId,
      workId,
      version: 1,
      role: 'primary',
      rawText: priDoc[0].raw_content,
    });

    await ChunkService.extractAndSaveChunks({
      documentId: referenceDocId,
      workId,
      version: 1,
      role: 'reference',
      rawText: refDoc[0].raw_content,
    });

    const retrieval = await RetrievalService.retrieveAndBuildPrompt({
      workId,
      question: 'Phân tích tâm trạng của Mị trong đêm mùa xuân khi uống rượu',
      learningMode: 'character_analysis',
    });

    expect(retrieval.lackOfSource).toBe(false);
    expect(retrieval.referenceChunks.length).toBeGreaterThan(0);
    expect(retrieval.referenceChunks[0].code).toMatch(/^R\d+$/);
    expect(retrieval.primaryChunks.length).toBeGreaterThan(0);
    expect(retrieval.primaryChunks[0].code).toMatch(/^P\d+$/);

    // Kiểm tra tổng ngân sách token không vượt quá ngưỡng tối đa
    expect(retrieval.tokenBreakdown.totalInputEstimated).toBeLessThanOrEqual(RetrievalService.BUDGET.TOTAL_MAX);
    expect(retrieval.promptContextText).toContain('[R1]');
    expect(retrieval.promptContextText).toContain('[P1]');
  });

  it('MetadataService triggers background job, generates structured metadata, and supports approval workflow', async () => {
    const { job, isExisting } = await MetadataService.triggerMetadataRegeneration({
      documentId: referenceDocId,
      userId,
    });

    expect(job).toBeDefined();
    expect(job.status).toBe('pending');
    expect(isExisting).toBe(false);

    // Chờ background execution hoàn tất
    await new Promise((r) => setTimeout(r, 200));

    const latestMeta = await MetadataService.getLatestMetadata(referenceDocId);
    expect(latestMeta).toBeDefined();
    expect(latestMeta?.summary).toBeDefined();
    expect(latestMeta?.themes).toBeInstanceOf(Array);
    expect(latestMeta?.keywords).toBeInstanceOf(Array);
    expect(latestMeta?.status).toBe('draft');

    // Duyệt và kích hoạt metadata
    if (latestMeta) {
      const approved = await MetadataService.approveAndActivateMetadata({
        metadataId: latestMeta.id,
        userId,
      });
      expect(approved.status).toBe('active');
      expect(approved.reviewed_by).toBe(userId);
    }
  });

  it('GeminiService.executeRagQuery records full RAG trace into rag_traces', async () => {
    const res = await GeminiService.executeRagQuery({
      workTitle: 'Vợ chồng A Phủ',
      learningMode: 'character_analysis',
      studentQuestion: 'Mị có khát vọng sống như thế nào?',
      fileSearchStoreNames: [],
      authorizedDocumentTitles: ['Vợ chồng A Phủ - Nguyên tác'],
      workId,
      userId,
      traceSource: 'admin_lab',
    });

    expect(res).toBeDefined();
    expect(res.traceId).toBeDefined();

    // Kiểm tra trong database có bản ghi trace
    const { rows: traceRows } = await query<{
      id: string;
      query_text: string;
      trace_source: string;
      processing_method: string;
    }>(
      `SELECT * FROM rag_traces WHERE id = $1`,
      [res.traceId]
    );

    expect(traceRows.length).toBe(1);
    expect(traceRows[0].query_text).toContain('Mị có khát vọng sống');
    expect(traceRows[0].trace_source).toBe('admin_lab');
  });
});
