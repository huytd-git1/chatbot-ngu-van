import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { GeminiService } from '../services/gemini.service.js';

describe('RAG & Grounding Verification', () => {
  const controlledDocText = `
TÀI LIỆU BIÊN SOẠN CHUYÊN SÂU: LẶNG LẼ SA PA
Biên soạn bởi: Cô Dương
1. Hình tượng anh thanh niên làm công tác khí tượng kiêm vật lý địa cầu trên đỉnh Yên Sơn cao 2600 mét.
2. Chi tiết độc quyền kiểm thử RAG: Máy đo gió của anh thanh niên được bọc bằng túi nỉ nhung màu xanh lá đậm có thêu chữ Sa Pa 2600m.
3. Tinh thần cống hiến thầm lặng và đức tính khiêm tốn của người lao động.
`;

  beforeAll(async () => {
    await runMigrations();
  });

  it('retrieves controlled synthetic fact with authentic file citations', async () => {
    const result = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'qa',
      studentQuestion: 'Chiếc máy đo gió của anh thanh niên được bọc bằng gì trong tài liệu giáo viên?',
      fileSearchStoreNames: ['fileSearchStores/work_test_store'],
      authorizedDocumentTitles: ['Tài liệu Cô Dương biên soạn'],
      mockDocumentSnippets: [controlledDocText],
    });

    expect(result.isNoSource).toBe(false);
    expect(result.hasCitations).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0].fileName).toBe('Tài liệu Cô Dương biên soạn');
    expect(result.text).toContain('túi nỉ nhung màu xanh lá đậm');
    expect(result.toolActuallyUsed).toBe(true);
  });

  it('strictly refuses and does NOT fabricate sources when document has no answer', async () => {
    const result = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'qa',
      studentQuestion: 'Anh thanh niên có lái xe tăng quân sự bắn tên lửa không?',
      fileSearchStoreNames: ['fileSearchStores/work_test_store'],
      authorizedDocumentTitles: ['Tài liệu Cô Dương biên soạn'],
      mockDocumentSnippets: [controlledDocText],
    });

    expect(result.isNoSource).toBe(true);
    expect(result.hasCitations).toBe(false);
    expect(result.citations.length).toBe(0);
    expect(result.text).toContain('chưa tìm thấy căn cứ');
  });

  it('enforces character analysis 4-step structure (Luận điểm -> Dẫn chứng -> Phân tích -> Nhận xét)', async () => {
    const result = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'character_analysis',
      studentQuestion: 'Phân tích vẻ đẹp người lao động thầm lặng của anh thanh niên?',
      fileSearchStoreNames: ['fileSearchStores/work_test_store'],
      authorizedDocumentTitles: ['Tài liệu Cô Dương biên soạn'],
      mockDocumentSnippets: [controlledDocText],
    });

    expect(result.text).toContain('Luận điểm');
    expect(result.text).toContain('Dẫn chứng');
    expect(result.text).toContain('Phân tích');
    expect(result.text).toContain('Nhận xét');
  });

  it('enforces outline suggestion without writing entire full essay', async () => {
    const result = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'outline',
      studentQuestion: 'Lập dàn ý phân tích nhân vật anh thanh niên',
      fileSearchStoreNames: ['fileSearchStores/work_test_store'],
      authorizedDocumentTitles: ['Tài liệu Cô Dương biên soạn'],
      mockDocumentSnippets: [controlledDocText],
    });

    expect(result.text).toContain('Mở bài');
    expect(result.text).toContain('Thân bài');
    expect(result.text).toContain('Kết bài');
    expect(result.text).toContain('cô không viết thay');
  });

  it('enforces Contextual RAG with exact verbatim quotes in blockquotes', async () => {
    const result = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'qa',
      studentQuestion: 'Điều này chứng minh vẻ đẹp tư tưởng sâu sắc mà tác giả muốn truyền tải gì hả cô?',
      fileSearchStoreNames: ['fileSearchStores/work_test_store'],
      authorizedDocumentTitles: ['Tài liệu Cô Dương biên soạn'],
      mockDocumentSnippets: [controlledDocText],
    });

    expect(result.isNoSource).toBe(false);
    expect(result.hasCitations).toBe(true);
    // Verifies markdown blockquote with exact quotation marks
    expect(result.text).toMatch(/>\s*"[^"]+"/);
    expect(result.text).toContain('Tài liệu Cô Dương biên soạn');
    expect(result.text).toContain('tư tưởng');
  });

  it('cites all authorized documents when teacher provides multiple materials for a work', async () => {
    const doc1 = 'VĂN BẢN NGUYÊN TÁC: LẶNG LẼ SA PA\nNguyễn Thành Long\nAnh thanh niên làm việc trên đỉnh Yên Sơn.';
    const doc2 = 'GIÁO ÁN BÀI GIẢNG: LẶNG LẼ SA PA\nPhân tích tinh thần cống hiến thầm lặng của thế hệ trẻ.';
    const doc3 = 'TÀI LIỆU ÔN TẬP & ĐỀ CƯƠNG: LẶNG LẼ SA PA\nBộ câu hỏi đọc hiểu và hướng dẫn phân tích nhân vật.';

    const result = await GeminiService.executeRagQuery({
      workTitle: 'Lặng lẽ Sa Pa',
      learningMode: 'qa',
      studentQuestion: 'Ý nghĩa tư tưởng của tác phẩm Lặng lẽ Sa Pa là gì hả cô?',
      fileSearchStoreNames: ['fileSearchStores/work_test_store'],
      authorizedDocumentTitles: [
        'Văn bản nguyên tác Lặng lẽ Sa Pa',
        'Giáo án bài giảng Lặng lẽ Sa Pa',
        'Tài liệu ôn tập & Đề cương',
      ],
      mockDocumentSnippets: [doc1, doc2, doc3],
    });

    expect(result.isNoSource).toBe(false);
    expect(result.hasCitations).toBe(true);
    expect(result.citations.length).toBe(3);
    expect(result.citations.map((c) => c.fileName)).toEqual([
      'Văn bản nguyên tác Lặng lẽ Sa Pa',
      'Giáo án bài giảng Lặng lẽ Sa Pa',
      'Tài liệu ôn tập & Đề cương',
    ]);
  });
});
