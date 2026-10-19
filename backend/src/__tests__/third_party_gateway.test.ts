import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { GeminiService } from '../services/gemini.service.js';

describe('Third-Party API Gateway (RouteAPI / OpenRouter / Custom)', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('provides default third-party presets including RevidAPI, RouteAPI, and OpenRouter', () => {
    const presets = GeminiService.getThirdPartyPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);

    const revidApi = presets.find((p) => p.id === 'revidapi');
    expect(revidApi).toBeDefined();
    expect(revidApi?.baseUrl).toBe('https://revidapi.com/v1');
    expect(revidApi?.suggestedModels.some((m) => m.id === 'gemini-3.6-flash')).toBe(true);

    const routeApi = presets.find((p) => p.id === 'routeapi');
    expect(routeApi).toBeDefined();
    expect(routeApi?.baseUrl).toBe('https://api.routeapi.ai/v1');
    expect(routeApi?.suggestedModels.length).toBeGreaterThan(0);

    const openRouter = presets.find((p) => p.id === 'openrouter');
    expect(openRouter).toBeDefined();
    expect(openRouter?.baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('normalizes model candidates across prefix formats', () => {
    // google/gemini-3.5-flash -> fallback to gemini-3.5-flash
    const c1 = GeminiService.getCandidateModelNames('google/gemini-3.5-flash');
    expect(c1).toEqual(['google/gemini-3.5-flash', 'gemini-3.5-flash']);

    // gemini-3.6-flash -> fallback to google/gemini-3.6-flash
    const c2 = GeminiService.getCandidateModelNames('gemini-3.6-flash');
    expect(c2).toEqual(['gemini-3.6-flash', 'google/gemini-3.6-flash']);

    // openai/gpt-4o-mini -> fallback to gpt-4o-mini
    const c3 = GeminiService.getCandidateModelNames('openai/gpt-4o-mini');
    expect(c3).toEqual(['openai/gpt-4o-mini', 'gpt-4o-mini']);

    // gpt-4o-mini -> fallback to openai/gpt-4o-mini
    const c4 = GeminiService.getCandidateModelNames('gpt-4o-mini');
    expect(c4).toEqual(['gpt-4o-mini', 'openai/gpt-4o-mini']);
  });

  it('detects model access or not found error signals', () => {
    expect(GeminiService.isModelAccessOrNotFoundError(403, 'This token has no access to model google/gemini-3.5-flash')).toBe(true);
    expect(GeminiService.isModelAccessOrNotFoundError(400, "Không bán model 'google/gemini-3.6-flash'")).toBe(true);
    expect(GeminiService.isModelAccessOrNotFoundError(404, 'Not found')).toBe(true);
    expect(GeminiService.isModelAccessOrNotFoundError(429, 'Rate limit exceeded')).toBe(false);
  });

  it('updates AI config with third_party provider and multiple tokens pool', async () => {
    await GeminiService.updateAiConfig({
      providerType: 'third_party',
      customBaseUrl: 'https://api.routeapi.ai/v1',
      customApiKey: 'sk-route-key1_11111111\nsk-route-key2_22222222',
      customModelName: 'google/gemini-2.5-flash',
    });

    const summary = GeminiService.getAiConfigSummary();
    expect(summary.providerType).toBe('third_party');
    expect(summary.customBaseUrl).toBe('https://api.routeapi.ai/v1');
    expect(summary.customModelName).toBe('google/gemini-2.5-flash');
    expect(summary.hasCustomApiKey).toBe(true);
    expect(summary.customKeyCount).toBe(2);
    expect(summary.customKeyPool).toHaveLength(2);
    expect(summary.customKeyPool[0].maskedKey).toContain('sk-rou...1111');
    expect(summary.customKeyPool[1].maskedKey).toContain('sk-rou...2222');
  });

  it('correctly deletes a third-party token by index and clears all third-party tokens', async () => {
    await GeminiService.updateAiConfig({
      providerType: 'third_party',
      customApiKey: 'sk-token-A_aaaa\nsk-token-B_bbbb\nsk-token-C_cccc',
    });

    let summary = GeminiService.getAiConfigSummary();
    expect(summary.customKeyCount).toBe(3);

    // Remove token #2 (sk-token-B)
    await GeminiService.removeKeyByIndex(2, 'third_party');
    summary = GeminiService.getAiConfigSummary();
    expect(summary.customKeyCount).toBe(2);
    expect(summary.customKeyPool[0].maskedKey).toContain('sk-tok...aaaa');
    expect(summary.customKeyPool[1].maskedKey).toContain('sk-tok...cccc');

    // Clear all third-party tokens
    await GeminiService.clearAllKeys('third_party');
    summary = GeminiService.getAiConfigSummary();
    expect(summary.customKeyCount).toBe(0);
    expect(summary.hasCustomApiKey).toBe(false);
  });

  it('preserves strict pedagogical quote verification logic regardless of provider', () => {
    const primaryDoc = {
      id: 'doc-1',
      title: 'Vợ nhặt',
      author: 'Kim Lân',
      grade: 12,
      paragraphs: [
        {
          id: 'p-1',
          document_id: 'doc-1',
          paragraph_order: 1,
          section_heading: 'Mở đầu',
          content: 'Tràng dắt thị về nhà trong buổi chiều chập choạng hoàng hôn.',
        },
      ],
    };

    // Valid quote exists in primaryDoc
    const responseWithValidQuote = `Tràng đưa vợ về nhà.\n> "Tràng dắt thị về nhà trong buổi chiều chập choạng hoàng hôn."\nĐây là chi tiết đắt giá.`;
    const resultValid = GeminiService.verifyAndBuildRagResult({
      fullResponseText: responseWithValidQuote,
      primaryDoc: primaryDoc as any,
      tokenCount: 150,
      workTitle: 'Vợ nhặt',
    });
    expect(resultValid.primaryCitations).toHaveLength(1);
    expect(resultValid.hasCitations).toBe(true);
    expect(resultValid.text).toContain('Tràng dắt thị về nhà trong buổi chiều chập choạng hoàng hôn');

    // Fabricated quote does NOT exist in primaryDoc
    const responseWithFakeQuote = `Nhà văn miêu tả:\n> "Tràng nắm tay thị đi giữa đường làng vắng vẻ không một bóng người."\nCâu văn rất thơ.`;
    const resultFake = GeminiService.verifyAndBuildRagResult({
      fullResponseText: responseWithFakeQuote,
      primaryDoc: primaryDoc as any,
      tokenCount: 150,
      workTitle: 'Vợ nhặt',
    });
    expect(resultFake.primaryCitations).toHaveLength(0);
    expect(resultFake.isNoSource).toBe(true);
  });
});
