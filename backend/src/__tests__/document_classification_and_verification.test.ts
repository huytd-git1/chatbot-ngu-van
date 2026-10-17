import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { query } from '../db/pool.js';
import { DocumentService } from '../services/document.service.js';
import { ParagraphService } from '../services/paragraph.service.js';
import { GeminiService } from '../services/gemini.service.js';

describe('Document Classification & Quote Verification Suite', () => {
  let testUserId = '';
  let testWorkId = '';

  const samplePrimaryText = `
VĂN BẢN TÁC PHẨM GỐC: LẶNG LẼ SA PA
Tác giả: Nguyễn Thành Long

[Trang 1]
Bác lái xe bóp còi một hồi dài rồi dừng xe lại bên đường. Bác quay lại bảo với ông họa sĩ và cô kĩ sư:
- Tôi sắp giới thiệu với bác một người cô độc nhất thế gian. Thế nào bác cũng thích vẽ hắn.
Chiếc xe dừng lại trước một trạm khí tượng trên đỉnh Yên Sơn cao hai nghìn sáu trăm mét. Một chàng trai tầm hai mươi bảy tuổi, tầm vóc nhỏ bé, nét mặt rạng rỡ từ trong nhà chạy ra.

[Trang 2]
Anh thanh niên niềm nở đón khách và sôi nổi kể về công việc của mình:
- Khi ta làm việc, ta với công việc là đôi, sao gọi là một mình được? Huống chi việc của cháu gắn liền với việc của bao anh em, đồng chí dưới kia. Gian khổ nhất là lần ghi và báo về lúc một giờ sáng. Nửa đêm đang nằm trong chăn, nghe chuông đồng hồ reo, chỉ muốn trùm chăn ngủ tiếp. Nhưng nghĩ đến nhiệm vụ phục vụ sản xuất, phục vụ chiến đấu thì lại vùng dậy xách đèn ra vườn khí tượng.
`;

  const sampleReferenceText = `
TÀI LIỆU PHÂN TÍCH CHUYÊN SÂU: LẶNG LẼ SA PA
Tác giả tài liệu: Cô Dương

1. Nhận định của giáo viên về chủ đề:
Hình tượng anh thanh niên tiêu biểu cho thế hệ trẻ Việt Nam thời kỳ chống Mỹ cứu nước, giàu lý tưởng và đức hy sinh thầm lặng.

2. Lời bình luận độc quyền của tài liệu tham khảo:
"Anh thanh niên là bông hoa ngát hương giữa đại ngàn Tây Bắc hùng vĩ, tỏa sáng bằng ngọn lửa nhiệt huyết thanh xuân."
`;

  beforeAll(async () => {
    await runMigrations();

    // Create a test user
    const userRes = await query<{ id: string }>(
      `INSERT INTO users (username, full_name, role, password_hash)
       VALUES ('teacher_doc_test', 'Cô Dương Giáo Viên', 'teacher', 'mockhash')
       ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`
    );
    testUserId = userRes.rows[0].id;

    // Create a test work
    const workRes = await query<{ id: string }>(
      `INSERT INTO works (title, author, grade, description, created_by)
       VALUES ('Lặng lẽ Sa Pa - Kiểm thử nguồn', 'Nguyễn Thành Long', 9, 'Tác phẩm kiểm thử phân loại tài liệu và trích dẫn', $1)
       RETURNING id`,
      [testUserId]
    );
    testWorkId = workRes.rows[0].id;
  });

  it('enforces database constraint: cannot have two active primary documents for the same work', async () => {
    // 1. Upload first document as primary
    const doc1 = await DocumentService.uploadDocument({
      workId: testWorkId,
      title: 'Văn bản gốc Bản 1',
      docType: 'text_primary',
      documentRole: 'primary',
      file: {
        originalname: 'ban_goc_1.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(samplePrimaryText),
        buffer: Buffer.from(samplePrimaryText, 'utf-8'),
      },
      userId: testUserId,
    });

    // Explicitly activate doc1
    const activatedDoc1 = await DocumentService.activatePrimaryDocument({
      workId: testWorkId,
      documentId: doc1.documentId,
      userId: testUserId,
    });
    expect(activatedDoc1.is_active).toBe(true);
    expect(activatedDoc1.document_role).toBe('primary');

    // 2. Upload second document
    const doc2 = await DocumentService.uploadDocument({
      workId: testWorkId,
      title: 'Văn bản gốc Bản 2',
      docType: 'text_primary',
      documentRole: 'unclassified',
      file: {
        originalname: 'ban_goc_2.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(samplePrimaryText),
        buffer: Buffer.from(samplePrimaryText, 'utf-8'),
      },
      userId: testUserId,
    });

    // 3. Atomically activate doc2 as primary -> doc1 must be demoted
    const activatedDoc2 = await DocumentService.activatePrimaryDocument({
      workId: testWorkId,
      documentId: doc2.documentId,
      userId: testUserId,
    });
    expect(activatedDoc2.is_active).toBe(true);
    expect(activatedDoc2.version).toBeGreaterThan(1);

    // Verify doc1 is no longer active
    const checkDoc1 = await query<{ is_active: boolean }>(
      `SELECT is_active FROM documents WHERE id = $1`,
      [doc1.documentId]
    );
    expect(checkDoc1.rows[0].is_active).toBe(false);

    // Verify exactly ONE active primary document exists for this work in DB
    const activePrimaries = await query(
      `SELECT id FROM documents WHERE work_id = $1 AND document_role = 'primary' AND is_active = true`,
      [testWorkId]
    );
    expect(activePrimaries.rows.length).toBe(1);
    expect(activePrimaries.rows[0].id).toBe(doc2.documentId);
  });

  it('correctly extracts and saves paragraphs with page numbers and normalization', async () => {
    const activePrimaryRes = await query<{ id: string }>(
      `SELECT id FROM documents WHERE work_id = $1 AND document_role = 'primary' AND is_active = true`,
      [testWorkId]
    );
    const primaryDocId = activePrimaryRes.rows[0].id;

    const paragraphs = await ParagraphService.getParagraphsForDocument(primaryDocId);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);

    // Verify page detection
    const page1Para = paragraphs.find((p) => p.page_number === 1);
    expect(page1Para).toBeDefined();
    expect(page1Para?.content).toContain('Bác lái xe bóp còi một hồi dài');

    const page2Para = paragraphs.find((p) => p.page_number === 2);
    expect(page2Para).toBeDefined();
    expect(page2Para?.content).toContain('Khi ta làm việc, ta với công việc là đôi');

    // Verify normalized content preserves Vietnamese diacritics but normalizes whitespace
    expect(page2Para?.normalized_content).toContain('Khi ta làm việc, ta với công việc là đôi');
  });

  it('quote verification: accepts authentic quote from primary original text', async () => {
    const primaryParagraphs = await ParagraphService.getParagraphsForActivePrimary(testWorkId);

    const validQuote = 'Khi ta làm việc, ta với công việc là đôi, sao gọi là một mình được?';
    const result = ParagraphService.verifyQuote({
      quote: validQuote,
      primaryParagraphs,
    });

    expect(result.verified).toBe(true);
    expect(result.matchedParagraph).toBeDefined();
    expect(result.matchedParagraph?.page_number).toBe(2);
  });

  it('quote verification: handles whitespace and line breaks normalization without modifying Vietnamese diacritics', async () => {
    const primaryParagraphs = await ParagraphService.getParagraphsForActivePrimary(testWorkId);

    // Quote with extra whitespace and tabs
    const noisyQuote = '   Khi   ta    làm  việc,   ta với   công   việc là đôi   ';
    const result = ParagraphService.verifyQuote({
      quote: noisyQuote,
      primaryParagraphs,
    });

    expect(result.verified).toBe(true);
  });

  it('quote verification: rejects quote if words or diacritics are altered', async () => {
    const primaryParagraphs = await ParagraphService.getParagraphsForActivePrimary(testWorkId);

    // Altered quote: changed "công việc" to "nhiệm vụ"
    const alteredQuote = 'Khi ta làm việc, ta với nhiệm vụ là đôi, sao gọi là một mình được?';
    const result = ParagraphService.verifyQuote({
      quote: alteredQuote,
      primaryParagraphs,
    });

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('không khớp');
  });

  it('quote verification: rejects quote that only exists in reference document and flags foundInReferenceOnly', async () => {
    const primaryParagraphs = await ParagraphService.getParagraphsForActivePrimary(testWorkId);
    const refSnippets = [
      {
        title: 'Tài liệu phân tích chuyên sâu',
        text: sampleReferenceText,
      },
    ];

    // Quote that only appears in teacher analysis commentary
    const teacherAnalysisQuote = 'Anh thanh niên là bông hoa ngát hương giữa đại ngàn Tây Bắc hùng vĩ';
    const result = ParagraphService.verifyQuote({
      quote: teacherAnalysisQuote,
      primaryParagraphs,
      referenceSnippets: refSnippets,
    });

    expect(result.verified).toBe(false);
    expect(result.foundInReferenceOnly).toBe(true);
    expect(result.reason).toContain('chỉ xuất hiện trong tài liệu tham khảo/phân tích');
  });

  it('generates teacher document diff and alignment report', async () => {
    // Upload reference doc
    await DocumentService.uploadDocument({
      workId: testWorkId,
      title: 'Tài liệu phân tích chuyên sâu',
      docType: 'analysis',
      documentRole: 'reference',
      referenceType: 'analysis',
      file: {
        originalname: 'phan_tich.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(sampleReferenceText),
        buffer: Buffer.from(sampleReferenceText, 'utf-8'),
      },
      userId: testUserId,
    });

    const report = await ParagraphService.generateDocumentDiffReport(testWorkId);
    expect(report.hasActivePrimary).toBe(true);
    expect(report.primaryDoc).toBeDefined();
    expect(report.referenceDocsCount).toBeGreaterThan(0);
    expect(report.items.length).toBeGreaterThan(0);
  });

  it('end-to-end RAG query: separates primary citations and reference citations cleanly', async () => {
    const activePrimaryRes = await query<{ id: string; title: string; version: number; raw_content: string | null }>(
      `SELECT id, title, version, raw_content FROM documents WHERE work_id = $1 AND document_role = 'primary' AND is_active = true`,
      [testWorkId]
    );
    const primaryDocRow = activePrimaryRes.rows[0];
    const primaryParagraphs = await ParagraphService.getParagraphsForDocument(primaryDocRow.id);

    const refDocsRes = await query<{ id: string; title: string; reference_type: string | null; raw_content: string | null }>(
      `SELECT id, title, reference_type, raw_content FROM documents WHERE work_id = $1 AND document_role = 'reference' AND is_active = true`,
      [testWorkId]
    );

    const ragResult = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'qa',
      studentQuestion: 'Anh thanh niên nói gì về công việc của mình trên đỉnh Yên Sơn?',
      fileSearchStoreNames: ['fileSearchStores/work_test'],
      authorizedDocumentTitles: [primaryDocRow.title],
      primaryDoc: {
        id: primaryDocRow.id,
        title: primaryDocRow.title,
        version: primaryDocRow.version,
        rawContent: primaryDocRow.raw_content,
        paragraphs: primaryParagraphs,
      },
      referenceDocs: refDocsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        referenceType: r.reference_type,
        rawContent: r.raw_content,
      })),
    });

    expect(ragResult.isNoSource).toBe(false);
    expect(ragResult.hasCitations).toBe(true);
    expect(ragResult.primaryCitations).toBeDefined();
    expect(ragResult.primaryCitations?.length).toBeGreaterThan(0);
    expect(ragResult.primaryCitations![0].verified).toBe(true);
    expect(ragResult.primaryCitations![0].documentTitle).toBe(primaryDocRow.title);
    expect(ragResult.referenceCitations).toBeDefined();
    expect(ragResult.referenceCitations?.length).toBeGreaterThan(0);
  });
});
