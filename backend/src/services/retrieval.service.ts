import { query } from '../db/pool.js';
import { DocumentService } from './document.service.js';
import { ChunkService, DocumentChunkRow } from './chunk.service.js';
import { MetadataService } from './metadata.service.js';

export interface RetrievedChunk {
  code: string; // e.g. R1, R2 hoặc P1, P2
  chunkId: string;
  documentId: string;
  documentTitle: string;
  role: 'primary' | 'reference';
  order: number;
  content: string;
  tokenCount: number;
  relevanceScore: number;
  sectionTitle?: string | null;
  pageNumber?: number | null;
}

export interface RetrievalResult {
  referenceChunks: RetrievedChunk[];
  primaryChunks: RetrievedChunk[];
  allSelectedChunks: RetrievedChunk[];
  excludedChunks: Array<{ chunkId: string; role: string; reason: string }>;
  tokenBreakdown: {
    system: number;
    history: number;
    reference: number;
    primary: number;
    question: number;
    totalInputEstimated: number;
  };
  promptContextText: string;
  lackOfSource: boolean;
  notes: string[];
}

export class RetrievalService {
  /**
   * Ngân sách token mặc định cho câu hỏi thông thường (Tổng input: ~9.000 - 12.000 tokens)
   */
  static readonly BUDGET = {
    SYSTEM: 1500,
    HISTORY: 1000,
    REFERENCE: 4200,
    PRIMARY: 3300,
    QUESTION: 500,
    TOTAL_MAX: 12000,
  };

  /**
   * Thực hiện Pre-Retrieval hoàn chỉnh trước khi gọi LLM
   */
  static async retrieveAndBuildPrompt(params: {
    workId: string;
    question: string;
    learningMode: string;
    history?: Array<{ role: string; content: string }>;
  }): Promise<RetrievalResult> {
    const { workId, question, learningMode, history = [] } = params;
    const notes: string[] = [];

    // 1. Kiểm tra tài liệu active của tác phẩm
    const { rows: activeDocs } = await query<{
      id: string;
      title: string;
      document_role: string;
      doc_type: string;
    }>(
      `SELECT id, title, document_role, doc_type 
       FROM documents 
       WHERE work_id = $1 AND is_active = true`,
      [workId]
    );

    const primaryDoc = activeDocs.find((d) => d.document_role === 'primary');
    const referenceDocs = activeDocs.filter((d) => d.document_role === 'reference');

    if (!primaryDoc && referenceDocs.length === 0) {
      return {
        referenceChunks: [],
        primaryChunks: [],
        allSelectedChunks: [],
        excludedChunks: [],
        tokenBreakdown: {
          system: 1000,
          history: 0,
          reference: 0,
          primary: 0,
          question: ChunkService.estimateVietnameseTokens(question),
          totalInputEstimated: 1000 + ChunkService.estimateVietnameseTokens(question),
        },
        promptContextText: '',
        lackOfSource: true,
        notes: ['Tác phẩm chưa có tài liệu nguyên tác hoặc tài liệu tham khảo nào đang hoạt động.'],
      };
    }

    // 2. Lấy tất cả chunks của tác phẩm
    const allChunks = await ChunkService.getChunksForWork(workId);
    const refChunksAll = allChunks.filter((c) => c.chunk_role === 'reference');
    const primaryChunksAll = allChunks.filter((c) => c.chunk_role === 'primary');

    // 3. Tính điểm liên quan (Relevance Scoring) cho Reference Chunks
    const scoredRefChunks = await this.scoreAndRankChunks({
      chunks: refChunksAll,
      question,
      workId,
    });

    // 4. Lựa chọn Reference Chunks theo ngân sách (~4.200 tokens)
    const selectedRefChunks: RetrievedChunk[] = [];
    const excludedChunks: Array<{ chunkId: string; role: string; reason: string }> = [];
    let currentRefTokens = 0;
    let refCounter = 1;

    for (const item of scoredRefChunks) {
      const tokens = item.chunk.token_count || ChunkService.estimateVietnameseTokens(item.chunk.content);
      if (currentRefTokens + tokens <= this.BUDGET.REFERENCE) {
        selectedRefChunks.push({
          code: `R${refCounter++}`,
          chunkId: item.chunk.id,
          documentId: item.chunk.document_id,
          documentTitle: (item.chunk as any).document_title || 'Tài liệu tham khảo',
          role: 'reference',
          order: item.chunk.chunk_order,
          content: item.chunk.content,
          tokenCount: tokens,
          relevanceScore: item.score,
          sectionTitle: item.chunk.section_title,
          pageNumber: item.chunk.page_number,
        });
        currentRefTokens += tokens;
      } else {
        excludedChunks.push({
          chunkId: item.chunk.id,
          role: 'reference',
          reason: 'Vượt ngân sách token cho tài liệu tham khảo',
        });
      }
    }

    // 5. Tìm kiếm Primary Chunks (nguyên tác) hỗ trợ câu hỏi & nội dung tham khảo đã chọn
    // Tổng hợp từ khóa từ câu hỏi và các đoạn tham khảo đã chọn
    const combinedQuery = question + ' ' + selectedRefChunks.map((r) => r.content.substring(0, 100)).join(' ');
    const scoredPrimaryChunks = await this.scoreAndRankChunks({
      chunks: primaryChunksAll,
      question: combinedQuery,
      workId,
    });

    const selectedPrimaryChunks: RetrievedChunk[] = [];
    let currentPrimaryTokens = 0;
    let primaryCounter = 1;

    for (const item of scoredPrimaryChunks) {
      const tokens = item.chunk.token_count || ChunkService.estimateVietnameseTokens(item.chunk.content);
      if (currentPrimaryTokens + tokens <= this.BUDGET.PRIMARY) {
        selectedPrimaryChunks.push({
          code: `P${primaryCounter++}`,
          chunkId: item.chunk.id,
          documentId: item.chunk.document_id,
          documentTitle: (item.chunk as any).document_title || 'Tác phẩm nguyên tác',
          role: 'primary',
          order: item.chunk.chunk_order,
          content: item.chunk.content,
          tokenCount: tokens,
          relevanceScore: item.score,
          sectionTitle: item.chunk.section_title,
          pageNumber: item.chunk.page_number,
        });
        currentPrimaryTokens += tokens;
      } else {
        excludedChunks.push({
          chunkId: item.chunk.id,
          role: 'primary',
          reason: 'Vượt ngân sách token cho văn bản nguyên tác',
        });
      }
    }

    // 6. Xử lý lịch sử (history) với giới hạn ngân sách (~1.000 tokens)
    const filteredHistory: string[] = [];
    let historyTokens = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const t = ChunkService.estimateVietnameseTokens(msg.content);
      if (historyTokens + t <= this.BUDGET.HISTORY) {
        filteredHistory.unshift(`${msg.role === 'user' ? 'Học sinh' : 'Cô Dương'}: ${msg.content}`);
        historyTokens += t;
      } else {
        break;
      }
    }

    // 7. Dựng ngữ cảnh Prompt theo định dạng chuẩn hóa
    const refContextLines = selectedRefChunks.map(
      (r) => `[${r.code}] (${r.documentTitle}${r.sectionTitle ? ' - ' + r.sectionTitle : ''}):\n${r.content}`
    );

    const primaryContextLines = selectedPrimaryChunks.map(
      (p) => `[${p.code}] (${p.documentTitle}${p.pageNumber ? ' - Trang ' + p.pageNumber : ''}):\n${p.content}`
    );

    let promptContextText = '';

    if (refContextLines.length > 0) {
      promptContextText += `--- TÀI LIỆU THAM KHẢO (Định hướng phân tích, luận điểm, kiến thức) ---\n` +
        refContextLines.join('\n\n') + '\n\n';
    }

    if (primaryContextLines.length > 0) {
      promptContextText += `--- VĂN BẢN NGUYÊN TÁC (Chỉ dùng lấy dẫn chứng trích dẫn nguyên văn) ---\n` +
        primaryContextLines.join('\n\n') + '\n\n';
    }

    if (filteredHistory.length > 0) {
      promptContextText += `--- LỊCH SỬ TRAO ĐỔI GẦN ĐÂY ---\n` +
        filteredHistory.join('\n') + '\n\n';
    }

    const questionTokens = ChunkService.estimateVietnameseTokens(question);
    const systemTokens = 1200;
    const totalInputEstimated = systemTokens + historyTokens + currentRefTokens + currentPrimaryTokens + questionTokens;

    const lackOfSource = selectedRefChunks.length === 0 && selectedPrimaryChunks.length === 0;

    return {
      referenceChunks: selectedRefChunks,
      primaryChunks: selectedPrimaryChunks,
      allSelectedChunks: [...selectedRefChunks, ...selectedPrimaryChunks],
      excludedChunks,
      tokenBreakdown: {
        system: systemTokens,
        history: historyTokens,
        reference: currentRefTokens,
        primary: currentPrimaryTokens,
        question: questionTokens,
        totalInputEstimated,
      },
      promptContextText,
      lackOfSource,
      notes,
    };
  }

  /**
   * Tính điểm và xếp hạng chunks theo câu hỏi
   */
  private static async scoreAndRankChunks(params: {
    chunks: DocumentChunkRow[];
    question: string;
    workId: string;
  }): Promise<Array<{ chunk: DocumentChunkRow; score: number }>> {
    const { chunks, question, workId } = params;
    const normalizedQuestion = DocumentService.normalizeText(question);
    const terms = normalizedQuestion
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((w) => w.toLowerCase());

    const scored: Array<{ chunk: DocumentChunkRow; score: number }> = [];

    for (const chunk of chunks) {
      let score = 0;
      const contentLower = chunk.normalized_content.toLowerCase();

      // Khớp từ khóa trực tiếp
      for (const term of terms) {
        if (contentLower.includes(term)) {
          score += 10;
        }
      }

      // Khớp cụm từ nguyên văn
      if (contentLower.includes(normalizedQuestion.toLowerCase())) {
        score += 50;
      }

      // Khớp tiêu đề mục
      if (chunk.section_title) {
        const titleNorm = DocumentService.normalizeText(chunk.section_title).toLowerCase();
        for (const term of terms) {
          if (titleNorm.includes(term)) {
            score += 15;
          }
        }
      }

      // Ưu tiên đoạn có câu hỏi nếu người dùng đang hỏi bài
      if (chunk.metadata?.hasQuestion) {
        score += 10;
      }

      scored.push({ chunk, score });
    }

    // Xếp hạng giảm dần theo điểm; nếu điểm bằng nhau xếp theo thứ tự đoạn
    scored.sort((a, b) => b.score - a.score || a.chunk.chunk_order - b.chunk.chunk_order);

    // Nếu điểm cao nhất bằng 0 (không khớp keyword nào), vẫn lấy các đoạn mở đầu theo thứ tự
    if (scored.length > 0 && scored[0].score === 0) {
      return scored.slice(0, 10).map((s, idx) => ({ ...s, score: 1 }));
    }

    // Lọc lấy các đoạn có score > 0
    return scored.filter((s) => s.score > 0);
  }
}
