import { query } from '../db/pool.js';
import { DocumentService } from './document.service.js';

export interface ParagraphRow {
  id: string;
  document_id: string;
  work_id: string;
  version: number;
  paragraph_order: number;
  page_number: number | null;
  content: string;
  normalized_content: string;
  created_at: string;
}

export interface QuoteVerificationResult {
  verified: boolean;
  matchedParagraph?: ParagraphRow;
  matchedExcerpt?: string;
  foundInReferenceOnly?: boolean;
  referenceDocTitle?: string;
  reason?: string;
}

export interface DocumentDiffItem {
  referenceDocTitle: string;
  quoteCandidate: string;
  foundInPrimary: boolean;
  matchedParagraphOrder?: number;
  notes: string;
}

export interface DocumentDiffReport {
  workId: string;
  hasActivePrimary: boolean;
  primaryDoc?: {
    id: string;
    title: string;
    version: number;
    paragraphCount: number;
  };
  referenceDocsCount: number;
  discrepanciesCount: number;
  items: DocumentDiffItem[];
  generatedAt: string;
}

export class ParagraphService {
  /**
   * Extracts paragraphs from raw text and saves them into work_paragraphs
   */
  static async extractAndSaveParagraphs(params: {
    documentId: string;
    workId: string;
    version: number;
    rawText: string;
  }): Promise<{ count: number; paragraphs: ParagraphRow[] }> {
    const { documentId, workId, version, rawText } = params;

    // Delete any existing paragraphs for this document
    await query(`DELETE FROM work_paragraphs WHERE document_id = $1`, [documentId]);

    if (!rawText || rawText.trim().length === 0) {
      return { count: 0, paragraphs: [] };
    }

    const lines = rawText.split(/\r?\n/);
    const paragraphsData: Array<{ order: number; pageNumber: number | null; text: string }> = [];

    let currentPage: number | null = null;
    let currentParagraphLines: string[] = [];
    let orderCounter = 1;

    const flushCurrentParagraph = () => {
      if (currentParagraphLines.length > 0) {
        const fullPara = currentParagraphLines.join('\n').trim();
        if (fullPara.length > 0) {
          paragraphsData.push({
            order: orderCounter++,
            pageNumber: currentPage,
            text: fullPara,
          });
        }
        currentParagraphLines = [];
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Detect page markers like [Trang 1], --- Trang 2 ---, [Page 3], Trang 4:
      const pageMatch = line.match(/^\[?(?:Trang|Page)\s+(\d+)\]?:?/i) || line.match(/^---\s*(?:Trang|Page)\s+(\d+)\s*---/i);
      if (pageMatch) {
        flushCurrentParagraph();
        currentPage = parseInt(pageMatch[1], 10);
        continue;
      }

      if (line.length === 0) {
        // Blank line indicates paragraph boundary
        flushCurrentParagraph();
      } else {
        currentParagraphLines.push(rawLine);
      }
    }
    flushCurrentParagraph();

    // Insert paragraphs into DB
    const savedParagraphs: ParagraphRow[] = [];
    for (const p of paragraphsData) {
      const normalized = DocumentService.normalizeText(p.text);
      const { rows } = await query<ParagraphRow>(
        `INSERT INTO work_paragraphs (document_id, work_id, version, paragraph_order, page_number, content, normalized_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [documentId, workId, version, p.order, p.pageNumber, p.text, normalized]
      );
      if (rows[0]) {
        savedParagraphs.push(rows[0]);
      }
    }

    // Sync to document_chunks for RAG v2
    try {
      const { rows: docRows } = await query<{ document_role: string }>(
        `SELECT document_role FROM documents WHERE id = $1`,
        [documentId]
      );
      const role = (docRows[0]?.document_role === 'primary' ? 'primary' : 'reference') as 'primary' | 'reference';
      const { ChunkService } = await import('./chunk.service.js');
      await ChunkService.extractAndSaveChunks({
        documentId,
        workId,
        version,
        role,
        rawText,
      });
    } catch (chunkErr) {
      console.warn('[ParagraphService] Warning syncing to document_chunks:', chunkErr);
    }

    return { count: savedParagraphs.length, paragraphs: savedParagraphs };
  }

  /**
   * Gets paragraphs for a specific document
   */
  static async getParagraphsForDocument(documentId: string): Promise<ParagraphRow[]> {
    const { rows } = await query<ParagraphRow>(
      `SELECT * FROM work_paragraphs WHERE document_id = $1 ORDER BY paragraph_order ASC`,
      [documentId]
    );
    return rows;
  }

  /**
   * Gets paragraphs for the currently active primary document of a work
   */
  static async getParagraphsForActivePrimary(workId: string): Promise<ParagraphRow[]> {
    const { rows } = await query<ParagraphRow>(
      `SELECT wp.*
       FROM work_paragraphs wp
       JOIN documents d ON wp.document_id = d.id
       WHERE d.work_id = $1 AND d.document_role = 'primary' AND d.is_active = true
       ORDER BY wp.paragraph_order ASC`,
      [workId]
    );
    return rows;
  }

  /**
   * Verifies a quote against primary paragraphs and reference snippets
   */
  static verifyQuote(params: {
    quote: string;
    primaryParagraphs: ParagraphRow[];
    referenceSnippets?: Array<{ title: string; text: string }>;
  }): QuoteVerificationResult {
    const { quote, primaryParagraphs, referenceSnippets = [] } = params;

    const rawCleanQuote = quote.replace(/^["“'”]+|["“'”]+$/g, '').trim();
    const normalizedQuote = DocumentService.normalizeText(rawCleanQuote);

    if (normalizedQuote.length < 5) {
      return {
        verified: false,
        reason: 'Câu trích quá ngắn để kiểm chứng độ xác thực.',
      };
    }

    // Check with ellipsis handling: [...] or ... or …
    const hasEllipsis = normalizedQuote.includes('[...]') || normalizedQuote.includes('...') || normalizedQuote.includes('…');
    const quoteParts = hasEllipsis
      ? normalizedQuote.split(/\[\.\.\.\]|\.{3}|…/).map((p) => p.trim()).filter((p) => p.length >= 3)
      : [normalizedQuote];

    for (const p of primaryParagraphs) {
      const pNorm = p.normalized_content || DocumentService.normalizeText(p.content || '');
      if (!hasEllipsis) {
        if (pNorm.includes(normalizedQuote)) {
          return {
            verified: true,
            matchedParagraph: p,
            matchedExcerpt: p.content,
          };
        }
      } else {
        // All parts must be present in consecutive order
        let lastIdx = 0;
        let matched = true;
        for (const part of quoteParts) {
          const idx = pNorm.indexOf(part, lastIdx);
          if (idx === -1) {
            matched = false;
            break;
          }
          lastIdx = idx + part.length;
        }
        if (matched) {
          return {
            verified: true,
            matchedParagraph: p,
            matchedExcerpt: p.content,
          };
        }
      }
    }

    // If not matched in primary text, check if it came from reference materials!
    for (const ref of referenceSnippets) {
      const normRef = DocumentService.normalizeText(ref.text);
      if (normRef.includes(normalizedQuote)) {
        return {
          verified: false,
          foundInReferenceOnly: true,
          referenceDocTitle: ref.title,
          reason: `Câu này chỉ xuất hiện trong tài liệu tham khảo/phân tích "${ref.title}", không phải nguyên văn tác phẩm gốc.`,
        };
      }
    }

    return {
      verified: false,
      foundInReferenceOnly: false,
      reason: 'Câu trích không khớp với bất kỳ đoạn văn nào trong văn bản tác phẩm gốc.',
    };
  }

  /**
   * Generates a diff & alignment report between reference documents and active primary text
   */
  static async generateDocumentDiffReport(workId: string): Promise<DocumentDiffReport> {
    const primaryDocsRes = await query<{ id: string; title: string; version: number }>(
      `SELECT id, title, version FROM documents WHERE work_id = $1 AND document_role = 'primary' AND is_active = true`,
      [workId]
    );

    const hasActivePrimary = primaryDocsRes.rows.length > 0;
    const primaryDoc = primaryDocsRes.rows[0];

    const primaryParagraphs = hasActivePrimary
      ? await this.getParagraphsForActivePrimary(workId)
      : [];

    const refDocsRes = await query<{ id: string; title: string; raw_content: string | null }>(
      `SELECT id, title, raw_content FROM documents WHERE work_id = $1 AND document_role = 'reference' AND is_active = true`,
      [workId]
    );

    const items: DocumentDiffItem[] = [];
    let discrepanciesCount = 0;

    for (const refDoc of refDocsRes.rows) {
      if (!refDoc.raw_content) continue;

      // Extract quoted phrases in double quotes or blockquotes
      const quotes = Array.from(refDoc.raw_content.matchAll(/["“]([^"”\n]{10,120})["”]/g)).map((m) => m[1].trim());

      for (const q of quotes.slice(0, 8)) { // Sample up to 8 quotes per reference doc
        const vResult = this.verifyQuote({ quote: q, primaryParagraphs });
        if (vResult.verified) {
          items.push({
            referenceDocTitle: refDoc.title,
            quoteCandidate: q,
            foundInPrimary: true,
            matchedParagraphOrder: vResult.matchedParagraph?.paragraph_order,
            notes: `Khớp nguyên tác (Đoạn #${vResult.matchedParagraph?.paragraph_order}${vResult.matchedParagraph?.page_number ? `, Trang ${vResult.matchedParagraph.page_number}` : ''})`,
          });
        } else {
          discrepanciesCount++;
          items.push({
            referenceDocTitle: refDoc.title,
            quoteCandidate: q,
            foundInPrimary: false,
            notes: 'Không tìm thấy trong văn bản tác phẩm gốc (Có thể là nhận định của giáo viên hoặc dị bản khác)',
          });
        }
      }
    }

    return {
      workId,
      hasActivePrimary,
      primaryDoc: primaryDoc
        ? {
            id: primaryDoc.id,
            title: primaryDoc.title,
            version: primaryDoc.version,
            paragraphCount: primaryParagraphs.length,
          }
        : undefined,
      referenceDocsCount: refDocsRes.rows.length,
      discrepanciesCount,
      items,
      generatedAt: new Date().toISOString(),
    };
  }
}
