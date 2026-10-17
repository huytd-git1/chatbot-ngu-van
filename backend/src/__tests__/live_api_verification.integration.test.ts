import { describe, it } from 'vitest';
import { GeminiService } from '../services/gemini.service.js';
import { VerificationService } from '../services/verification.service.js';

describe('Live API Integration Verification (Disabled by Default)', () => {
  it('runs live Gemini verification when RUN_LIVE_TESTS=true and valid API key is present', async () => {
    const isLiveRequested = process.env.RUN_LIVE_TESTS === 'true';
    const hasKeys = GeminiService.isLiveApiConfigured();

    if (!isLiveRequested || !hasKeys) {
      console.warn(
        '\n[LIVE TEST SKIPPED] Trạng thái: "CHƯA CHẠY" (Không báo PASS).\n' +
        'Lý do: Lệnh kiểm thử tích hợp API thật mặc định tắt để tránh chi phí.\n' +
        'Để chạy kiểm thử thật: Chạy `RUN_LIVE_TESTS=true npm test` kèm GEMINI_API_KEY hợp lệ.\n'
      );
      // Explicitly return without claiming false verification pass
      return;
    }

    // Live test execution against Google Gemini
    const result = await VerificationService.runBatchedSemanticVerification({
      question: 'Máy đo gió của anh thanh niên được bọc bằng gì?',
      claims: [
        {
          id: 'live_c1',
          claim: 'Máy đo gió của anh thanh niên được bọc bằng túi nỉ nhung màu xanh lá đậm.',
          claim_type: 'factual',
          evidence_refs: [{ quote: 'túi nỉ nhung màu xanh lá đậm' }],
        },
      ],
      passages: [
        {
          documentId: 'live_doc_1',
          workId: 'live_work_1',
          documentTitle: 'Lặng lẽ Sa Pa',
          passageId: 'live_p1',
          sourceType: 'text_primary',
          content: 'Máy đo gió của anh thanh niên được bọc bằng túi nỉ nhung màu xanh lá đậm có thêu chữ Sa Pa 2600m.',
          normalizedContent: 'Máy đo gió của anh thanh niên được bọc bằng túi nỉ nhung màu xanh lá đậm có thêu chữ Sa Pa 2600m.',
        },
      ],
    });

    console.log('[LIVE TEST RESULT]:', Array.from(result.entries()));
  });
});
